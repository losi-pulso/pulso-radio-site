/* Página administrativa de migração de mídia legada Supabase => Cloudflare R2.
 * Sem chaves secretas; o Worker confere JWT e exige conta admin.
 */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const config = window.PULSO_CONFIG || {};
const supabaseUrl = String(config.supabaseUrl || '').replace(/\/$/, '');
const worker = String(config.r2WorkerUrl || '').replace(/\/$/, '');
const publishableKey = String(config.supabaseAnonKey || '');
const sb = window.supabase?.createClient?.(supabaseUrl, publishableKey, {auth:{persistSession:true,autoRefreshToken:true}});
let me = null;
let busy = false;
let posts = [];
const UUID = '[0-9a-f-]{36}';
const audioRoot = `${supabaseUrl}/storage/v1/object/public/pulso-audio/`;
const videoRoot = `${supabaseUrl}/storage/v1/object/public/pulso-videos/`;
const MiB = 1024 * 1024;
const CHUNK = 8 * MiB;
const MAX_AUDIO = 400 * MiB;
const MAX_VIDEO = 2 * 1024 * MiB;
const escapeHtml = t => String(t ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function notice(message, cls = '') {
  $('globalStatus').innerHTML = `<div class="notice ${cls}">${escapeHtml(message)}</div>`;
}
function locked(yes){ busy = yes; document.querySelectorAll('button,input').forEach(e => { if(e.type!=='password' && e.type!=='email' && e.id!=='rights')e.disabled = yes; }); }
function shortSize(size){return size>=MiB ? `${(size/MiB).toFixed(1).replace('.',',')} MB` : `${Math.ceil(size/1024)} KB`;}
function classify(post){
 const u=String(post.url||'');
 if(u.startsWith(`${worker}/media/`))return {kind:'r2',label:'Já armazenado no Cloudflare R2'};
 if(new RegExp(`^${audioRoot.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}${UUID}/${UUID}/manifest\\.json$`,'i').test(u))return {kind:'manifest',label:'MP3 em partes no Supabase — migração automática'};
 if(u.startsWith(audioRoot)||u.startsWith(videoRoot))return {kind:'stored',label:'Arquivo no Supabase — migração automática'};
 if(/soundcloud\.com/i.test(u))return {kind:'external',label:'SoundCloud — precisa do MP3 original'};
 if(/(?:youtu\.be|youtube\.com)/i.test(u))return {kind:'external',label:'YouTube — precisa do vídeo original'};
 return {kind:'external',label:'Link externo — precisa do arquivo original'};
}
function mediaKind(post){return /v[ií]deo|live/i.test(post.type || '') ? 'video' : 'audio';}
function fileMime(file,post){
 let mime=String(file.type||'').toLowerCase();
 if(!mime || mime==='application/octet-stream'){
  const ext=file.name.split('.').pop()?.toLowerCase();
  mime={mp3:'audio/mpeg',m4a:'audio/mp4',aac:'audio/aac',wav:'audio/wav',ogg:'audio/ogg',mp4:'video/mp4',webm:'video/webm'}[ext];
 }
 if(!mime || !(mime in {'audio/mpeg':1,'audio/mp4':1,'audio/aac':1,'audio/wav':1,'audio/ogg':1,'video/mp4':1,'video/webm':1})) throw new Error('Formato não permitido. Selecione MP3, M4A, WAV, AAC, OGG, MP4 ou WebM.');
 if(mediaKind(post)==='video' && !mime.startsWith('video/'))throw new Error('Para uma publicação de vídeo, escolha MP4 ou WebM.');
 if(mediaKind(post)==='audio' && !mime.startsWith('audio/'))throw new Error('Para uma música, escolha MP3, M4A, AAC, OGG ou WAV.');
 const max=mime.startsWith('video/')?MAX_VIDEO:MAX_AUDIO;
 if(file.size<=0||file.size>max)throw new Error(`Arquivo acima do limite permitido (${mime.startsWith('video/')?'2 GB':'400 MB'}).`);
 return mime;
}
async function workerFetch(path,options={}){
 const {data:{session}}=await sb.auth.getSession();
 if(!session?.access_token)throw new Error('Sessão expirada. Entre novamente.');
 const headers={...(options.headers||{}),Authorization:`Bearer ${session.access_token}`};
 let response;
 try{response=await fetch(`${worker}${path}`,{...options,headers,mode:'cors'});}catch{throw new Error('Falha de conexão com o Cloudflare Worker. Verifique a internet e as configurações.');}
 const body=await response.json().catch(()=>null);
 if(!response.ok)throw new Error(body?.error||`Cloudflare retornou HTTP ${response.status}`);
 return body;
}
async function getFileFromSupabase(post){
 const response=await fetch(post.url,{cache:'no-store'});
 if(!response.ok)throw new Error('Não foi possível baixar o arquivo antigo do Supabase.');
 const blob=await response.blob();
 if(blob.size<=0)throw new Error('Arquivo antigo está vazio.');
 return blob;
}
async function getManifest(post){
 const response=await fetch(post.url,{cache:'no-store'});
 if(!response.ok)throw new Error('Manifesto do MP3 antigo indisponível.');
 const m=await response.json();
 if(m?.version!==1||m.codec!=='audio/mpeg'||m.chunkBytes!==CHUNK||!Number.isSafeInteger(m.bytes)||m.bytes<=0||m.bytes>MAX_AUDIO||!Number.isInteger(m.parts)||m.parts!==Math.ceil(m.bytes/CHUNK)||m.parts>50)throw new Error('Manifesto antigo inválido.');
 return m;
}
async function loadManifestPart(post,index,size){
 const partUrl=post.url.slice(0,-'manifest.json'.length)+`${String(index).padStart(4,'0')}.mp3`;
 const response=await fetch(partUrl,{cache:'no-store'});
 if(!response.ok)throw new Error(`Parte ${index+1} do MP3 indisponível no Supabase.`);
 const data=await response.blob();
 const expected=Math.min(CHUNK,size-index*CHUNK);
 if(data.size!==expected)throw new Error(`A parte ${index+1} está incompleta (${data.size} / ${expected} bytes).`);
 return data;
}
async function retry(fn,count=3){let last;for(let attempt=0;attempt<count;attempt++){try{return await fn();}catch(e){last=e;if(attempt<count-1)await new Promise(r=>setTimeout(r,(attempt+1)*900));}}throw last;}
async function pushParts(post,src,mime,progress){
 const size=src.kind==='manifest'?src.manifest.bytes:src.blob.size;
 const start=await workerFetch('/api/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mime,size})});
 if(!start.key||!start.uploadId||start.partSize!==CHUNK)throw new Error('O Worker devolveu uma configuração inesperada.');
 const received=[];
 try{
  const total=Math.ceil(size/CHUNK);
  for(let i=0;i<total;i++){
   const partBlob=src.kind==='manifest'?await retry(()=>loadManifestPart(post,i,size)):src.blob.slice(i*CHUNK,Math.min(size,(i+1)*CHUNK));
   const query=new URLSearchParams({key:start.key,uploadId:start.uploadId,partNumber:String(i+1)});
   const part=await retry(()=>workerFetch(`/api/part?${query}`,{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:partBlob}));
   if(part?.partNumber!==i+1||!part.etag)throw new Error(`Cloudflare não confirmou a parte ${i+1}.`);
   received.push({partNumber:part.partNumber,etag:part.etag});
   progress(Math.min((i+1)*CHUNK,size),size,i+1,total);
  }
  const result=await workerFetch('/api/finish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:start.key,uploadId:start.uploadId,size,parts:received})});
  if(result.size!==size||!String(result.url||'').startsWith(`${worker}/media/`))throw new Error('O Cloudflare não confirmou corretamente o arquivo final.');
  const check=await fetch(result.url,{method:'HEAD'});
  if(!check.ok)throw new Error('O arquivo foi enviado, mas a URL final não respondeu.');
  const actualSize=Number(check.headers.get('Content-Length'));
  if(Number.isFinite(actualSize)&&actualSize>0&&actualSize!==size)throw new Error('O tamanho do arquivo no Cloudflare não confere.');
  return {url:result.url,key:start.key};
 }catch(e){
  try{await workerFetch('/api/abort',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:start.key,uploadId:start.uploadId})});}catch{}
  throw e;
 }
}
function renderCards(){
 const root=$('cards');root.replaceChildren();
 let total=0;
 for(const post of posts){
  total++;
  const source=classify(post);
  const section=document.createElement('section');section.className='item';
  const left=document.createElement('div');
  left.innerHTML=`<div class="row"><span class="pill ${source.kind==='external'?'other':''}">${escapeHtml(post.type)}</span><span class="muted">${escapeHtml(post.status==='approved'?'Aprovada':'Status: '+post.status)}</span></div><h3>${escapeHtml(post.title)}</h3><div class="sub">${escapeHtml(post.artist||'Artista não informado')}</div><div class="meta"><span class="muted">${escapeHtml(source.label)}</span></div>`;
  const progress=document.createElement('div');progress.className='progress hidden';
  progress.innerHTML='<div class="track"><div></div></div><span class="progressText"></span>';
  left.append(progress);
  const action=document.createElement('div');action.className='actions';
  if(source.kind==='r2'){
   const status=document.createElement('span');status.className='pill';status.textContent='✓ No R2';action.append(status);
  }else{
   const button=document.createElement('button');button.className='primary';button.textContent=source.kind==='external'?'Enviar arquivo original':'Migrar para o R2';
   const input=document.createElement('input');input.type='file';input.className=source.kind==='external'?'files':'hidden';
   input.accept=mediaKind(post)==='video'?'.mp4,.webm,video/mp4,video/webm':'.mp3,.m4a,.aac,.wav,.ogg,audio/*';
   if(source.kind==='external'){
     const wrap=document.createElement('div');wrap.className='files';
     const label=document.createElement('label');label.textContent='Escolher arquivo do dispositivo';wrap.append(label,input);left.append(wrap);
   }
   button.addEventListener('click',()=>migrate(post,source,input,button,progress,section));action.append(button);
  }
  section.append(left,action);root.append(section);
 }
 if(!total)root.innerHTML='<div class="notice">Não foram encontradas publicações nesta conta.</div>';
}
async function migrate(post,source,input,button,progress,section){
 if(busy)return;
 if(!$('rights').checked){notice('Confirme primeiro que possui autorização para armazenar e disponibilizar os arquivos.','error');return;}
 if(source.kind==='external'&&!input.files?.[0]){notice(`Selecione o arquivo original para “${post.title}”.`,'error');input.focus();return;}
 locked(true);progress.classList.remove('hidden');button.textContent='Migrando…';
 const bar=progress.querySelector('.track > div');const progressText=progress.querySelector('.progressText');
 const paint=(done,total,i,n)=>{const p=Math.min(100,Math.round(100*done/total));bar.style.width=p+'%';progressText.textContent=`${p}% • ${shortSize(done)} de ${shortSize(total)} • parte ${i}/${n}`;};
 let result=null;
 try{
  let src,mime;
  if(source.kind==='manifest') {src={kind:'manifest',manifest:await getManifest(post)};mime='audio/mpeg';}
  else if(source.kind==='stored') {src={kind:'blob',blob:await getFileFromSupabase(post)};mime=/\.(mp4|webm)$/i.test(new URL(post.url).pathname)?(/\.webm$/i.test(new URL(post.url).pathname)?'video/webm':'video/mp4'):/\.mp3$/i.test(post.url)?'audio/mpeg':'audio/mp4';
   const max=mime.startsWith('video/')?MAX_VIDEO:MAX_AUDIO;if(src.blob.size>max)throw new Error('O arquivo antigo ultrapassa o limite do R2.');}
  else {const file=input.files[0];mime=fileMime(file,post);src={kind:'blob',blob:file};}
  paint(0,src.kind==='manifest'?src.manifest.bytes:src.blob.size,0,Math.ceil((src.kind==='manifest'?src.manifest.bytes:src.blob.size)/CHUNK));
  result=await pushParts(post,src,mime,paint);
  progressText.textContent='Arquivo confirmado no Cloudflare. Atualizando publicação…';
  const {data,error}=await sb.from('posts').update({url:result.url,original_url:post.original_url||post.url})
    .eq('id',post.id).eq('owner_id',me.id).select('id,url,original_url').single();
  if(error||!data||data.url!==result.url)throw new Error(`O arquivo chegou ao Cloudflare, mas não foi possível atualizar a publicação: ${error?.message||'acesso negado'}.`);
  post.url=result.url;post.original_url=data.original_url;
  button.textContent='✓ Migrado';button.disabled=true;
  notice(`“${post.title}” agora está no Cloudflare R2, sem perder a publicação ou as curtidas.`,'success');
  renderCards();
 }catch(e){
  // Não apaga mídia cuja gravação no Supabase seja desconhecida.
  // O endereço antigo permanece preservado caso a atualização falhe.
  progressText.textContent=String(e.message||e);
  notice(`Falha ao migrar “${post.title}”: ${e.message||e}`,'error');button.textContent='Tentar novamente';
 }finally{busy=false;document.querySelectorAll('button,input').forEach(el=>el.disabled=false);}
}
async function load(){
 const {data:{session}}=await sb.auth.getSession();me=session?.user||null;
 if(!me){$('loginBox').classList.remove('hidden');$('migrationBox').classList.add('hidden');return;}
 const {data:members,error:adminError}=await sb.from('admin_users').select('user_id').eq('user_id',me.id).limit(1);
 if(adminError||!members?.length){$('migrationBox').classList.add('hidden');$('loginBox').classList.remove('hidden');notice('Esta página é exclusiva da conta administradora LØSI.','error');return;}
 const {data,error}=await sb.from('posts').select('id,owner_id,title,artist,type,url,original_url,status,created_at').eq('owner_id',me.id).order('created_at',{ascending:false}).limit(100);
 if(error)throw new Error(`Não foi possível consultar suas publicações: ${error.message}`);
 posts=data||[];
 $('loginBox').classList.add('hidden');$('migrationBox').classList.remove('hidden');$('hello').textContent=`${posts.length} publicações encontradas`;
 renderCards();
}
$('loginForm').addEventListener('submit',async e=>{
 e.preventDefault();notice('Entrando…');
 try{const {error}=await sb.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error)throw error;await load();$('password').value='';notice('Login realizado. Confira os arquivos que deseja migrar.','success');}
 catch(err){notice(err.message||'Não foi possível entrar.','error');}
});
$('logout').addEventListener('click',async()=>{await sb.auth.signOut();location.reload();});
if(!sb||!/^https:\/\//.test(worker)){notice('Faltam as configurações do Supabase ou Cloudflare. Confira config.js.','error');$('loginForm').querySelector('button').disabled=true;}
else load().catch(e=>notice(e.message||'Falha ao carregar as publicações.','error'));
})();
