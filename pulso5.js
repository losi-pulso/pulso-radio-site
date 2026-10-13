/* PULSO 5.0 — Personalized discovery, DJ profiles, followers, playlists and listening progress.
   Extends the existing player; all data is stored in Supabase with per-user RLS. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const url=value=>{try{const u=new URL(String(value||''));return u.protocol==='https:'?u.href:''}catch{return''}};
const asDate=value=>{const date=new Date(value||0);return isNaN(date.getTime())?'Recente':date.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}).replace('.','')};
const audioType=p=>!['Videoclipe','Vídeo DJ Set','Live'].includes(p?.type);
const icons={play:'<path d="m9 5 11 7-11 7V5Z" fill="currentColor"/>',heart:'<path d="M20.8 4.8a5 5 0 0 0-7.1 0L12 6.5l-1.7-1.7a5 5 0 0 0-7.1 7.1L12 21l8.8-9.1a5 5 0 0 0 0-7.1Z"/>',user:'<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',disc:'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="2.5"/>',plus:'<path d="M12 5v14M5 12h14"/>',next:'<path d="M19 5v14M5 6l10 6-10 6V6Z"/>',queue:'<path d="M4 5h16M4 11h16M4 17h11M19 15v6M16 18h6"/>',spark:'<path d="m12 2 2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2Z"/>',bookmark:'<path d="M5 4h14v17l-7-5-7 5z"/>',chevron:'<path d="m9 18 6-6-6-6"/>',check:'<path d="m4 12 5 5L20 6"/>',music:'<path d="M9 18V5l12-2v12M9 9l12-2"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="15" r="3"/>',trash:'<path d="M4 7h16M8 7V4h8v3M7 7l1 14h8l1-14"/>',lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'};
function icon(name){return `<svg class="p5-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.disc}</svg>`}
let app=null, sb=null, accountId=null, profiles=[], followed=new Set(), library=new Set(), progress=[], playlists=[], playlistItems=new Map();
let currentTab='home', currentLibraryTab='favorites', selectedProfile=null, queuedIds=[], currentPlayingId=null, activeAudio=null, activeAudioCleanup=null, busy=false, renderVersion=0, refreshVersion=0, initialized=false;
const approved=()=>app?.posts?.().filter(p=>p.status==='approved'&&!p.demo)||[];
const currentUser=()=>app?.user?.()||null;
const notify=msg=>app?.toast?.(msg);
const needLogin=()=>{if(currentUser())return true;app?.login?.();notify('Entre ou crie sua conta para usar esta função.');return false;};
function img(p){const c=url(p?.cover);if(c)return c;try{const u=new URL(p?.url||'');const y=u.hostname.match(/(?:^|\.)youtube\.com$/)||u.hostname==='youtu.be';let id=y?(u.hostname==='youtu.be'?u.pathname.slice(1):u.searchParams.get('v')):null;if(id&&/^[\w-]{11}$/.test(id))return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;}catch{}return'';}
function tile(p,opts={}){let cover=img(p);return `<article class="p5-tile ${opts.small?'p5-small':''}" data-p5-id="${esc(p.id)}">
  <button type="button" class="p5-art" data-p5="play" data-id="${esc(p.id)}" aria-label="Reproduzir ${esc(p.title)}">${cover?`<img src="${esc(cover)}" alt="" loading="lazy">`:`<span class="p5-art-fallback">${icon('disc')}</span>`}<span class="p5-art-play">${icon('play')}</span></button>
  <div class="p5-tile-text"><span class="p5-tile-tag">${esc(p.genre)} · ${esc(p.type)}</span><button type="button" class="p5-title" data-p5="play" data-id="${esc(p.id)}">${esc(p.title)}</button><div class="p5-tile-artist">${esc(p.artist)}</div></div>
  <div class="p5-tile-buttons"><button type="button" title="${library.has(p.id)?'Remover dos favoritos':'Adicionar aos favoritos'}" aria-label="Favorito" data-p5="favorite" data-id="${esc(p.id)}" class="p5-icon-btn ${library.has(p.id)?'is-active':''}">${icon('heart')}</button><button type="button" title="Adicionar a playlist" aria-label="Adicionar à playlist" data-p5="choose-playlist" data-id="${esc(p.id)}" class="p5-icon-btn">${icon('plus')}</button></div></article>`;}
function profileCard(p){const n=approved().filter(post=>post.owner_id===p.user_id).length,me=currentUser()?.id===p.user_id;
 return `<article class="p5-dj"><div class="p5-dj-head">${url(p.avatar_url)?`<img src="${esc(url(p.avatar_url))}" alt="" loading="lazy">`:`<span class="p5-dj-portrait">${icon('user')}</span>`}<div class="p5-dj-metrics"><strong>${Math.max(0,Number(p.follower_count)||0)}</strong><span>seguidores</span></div></div><div class="p5-dj-name">${esc(p.display_name)}</div><small>@${esc(p.handle)} · ${n} ${n===1?'publicação':'publicações'}</small><p>${esc(p.bio||'Vivendo a frequência do PULSO.')}</p><div class="p5-dj-actions"><button class="p5-btn p5-btn-outline" type="button" data-p5="profile" data-user="${esc(p.user_id)}">Ver perfil ${icon('chevron')}</button>${me?`<button type="button" class="p5-btn p5-btn-accent" data-p5="edit-profile">Editar</button>`:`<button type="button" class="p5-btn p5-btn-accent" data-p5="follow" data-user="${esc(p.user_id)}">${followed.has(p.user_id)?'✓ Seguindo':'+ Seguir'}</button>`}</div></article>`;
}
function listRow(p,options={}){const cover=img(p);return `<div class="p5-list-row"><button class="p5-row-cover" type="button" data-p5="play" data-id="${esc(p.id)}">${cover?`<img src="${esc(cover)}" alt="">`:icon('disc')}</button><div class="p5-row-info"><strong>${esc(p.title)}</strong><span>${esc(p.artist)} · ${esc(p.genre)}</span></div><button class="p5-icon-btn" data-p5="play" data-id="${esc(p.id)}" type="button" aria-label="Reproduzir">${icon('play')}</button>${options.remove?`<button class="p5-icon-btn" type="button" title="Retirar" data-p5="remove-item" data-id="${esc(p.id)}" data-list="${esc(options.list||'')}">${icon('trash')}</button>`:''}</div>`}
function scroller(items){return items.length?`<div class="p5-scroll">${items.map(p=>tile(p)).join('')}</div>`:`<div class="p5-empty-mini">Nenhuma faixa por enquanto. Explore os DJ sets e marque seus favoritos.</div>`;}
function greeting(){const d=new Date().getHours();return d<12?'Bom dia':d<18?'Boa tarde':'Boa noite';}
function home(){const ps=approved();const saved=ps.filter(p=>library.has(p.id));const history=progress.filter(x=>x.seconds>=15&&(!x.duration_seconds||x.seconds<x.duration_seconds-25)).map(x=>ps.find(p=>p.id===x.post_id)).filter(Boolean).slice(0,8);
 const taste=new Map();for(const p of saved)taste.set(p.genre,(taste.get(p.genre)||0)+3);for(const row of progress.slice(0,25)){const p=ps.find(p=>p.id===row.post_id);if(p)taste.set(p.genre,(taste.get(p.genre)||0)+2);}
 const following=ps.filter(p=>followed.has(p.owner_id));const rec=[...ps].sort((a,b)=>{const sa=(taste.get(a.genre)||0)+(followed.has(a.owner_id)?5:0)+(a.featured?1:0),sb=(taste.get(b.genre)||0)+(followed.has(b.owner_id)?5:0)+(b.featured?1:0);return sb-sa||new Date(b.created_at)-new Date(a.created_at)}).slice(0,10);
 const newest=[...ps].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,9);
 const top=rec[0]||newest[0];const featured=img(top);
 $('p5PanelHome').innerHTML=`<div class="p5-hero"><div class="p5-hero-left"><span class="p5-overline">✳ PULSO 5.0 / SUA FREQUÊNCIA</span><h2>${currentUser()?greeting()+',':'Viva a'} <em>${currentUser()?'sua vibe.':'frequência.'}</em></h2><p>Uma seleção de música eletrônica feita para descobrir, seguir DJs e continuar exatamente de onde parou.</p><div class="p5-hero-actions"><button type="button" class="p5-btn p5-btn-accent" data-p5="discover">Explorar sons ${icon('chevron')}</button><button type="button" class="p5-btn p5-btn-outline" data-p5="radio">${icon('disc')} Ligar rádio</button></div></div><div class="p5-hero-feature">${featured?`<img src="${esc(featured)}" alt="" loading="lazy">`:icon('disc')}<div class="p5-hero-vinyl"></div><span>PRÓXIMA FREQUÊNCIA</span><strong>${esc(top?.title||'PULSO RADIO')}</strong><small>${esc(top?.artist||'LØSI')}</small>${top?`<button type="button" data-p5="play" data-id="${esc(top.id)}" aria-label="Ouvir destaque">${icon('play')}</button>`:''}</div></div>
 <div class="p5-home-stats"><span>${icon('music')} <strong>${ps.length}</strong> sons disponíveis</span><span>${icon('user')} <strong>${profiles.length}</strong> perfis na cena</span><span>${icon('heart')} Sua biblioteca, seu ritmo</span></div>
 ${history.length?`<div class="p5-row-heading"><div><span class="p5-overline">RETOME SUA SESSÃO</span><h3>Continue <em>ouvindo.</em></h3></div><button type="button" class="p5-text-btn" data-p5="tab" data-tab="library">Seu histórico ${icon('chevron')}</button></div>${scroller(history)}`:''}
 <div class="p5-row-heading"><div><span class="p5-overline">DESCOBERTA PERSONALIZADA</span><h3>Na sua <em>frequência.</em></h3></div><span class="p5-subtle">${taste.size||followed.size?'Baseado no que você curte e nos DJs que segue.':'Escolhas recentes da cena eletrônica.'}</span></div>${scroller(rec)}
 ${following.length?`<div class="p5-row-heading"><div><span class="p5-overline">PERFIS QUE VOCÊ SEGUE</span><h3>Dos seus <em>DJs.</em></h3></div></div>${scroller(following.slice(0,8))}`:''}
 <div class="p5-row-heading"><div><span class="p5-overline">RECÉM-LANÇADOS</span><h3>Acabaram de <em>chegar.</em></h3></div><button type="button" class="p5-text-btn" data-p5="discover">Ver feed ${icon('chevron')}</button></div>${scroller(newest)}`;
}
function djs(){const q=String($('p5DjSearch')?.value||'').trim().toLowerCase();const people=profiles.filter(p=>(p.display_name+' '+p.handle+' '+p.bio).toLowerCase().includes(q));
$('p5DjGrid').innerHTML=people.length?people.map(profileCard).join(''):'<div class="p5-empty-mini">Nenhum perfil encontrado. Seja o primeiro a criar seu perfil.</div>';
$('p5MyProfile').innerHTML=currentUser()?(profiles.some(p=>p.user_id===currentUser().id)?`<button type="button" class="p5-btn p5-btn-outline" data-p5="edit-profile">${icon('user')} Meu perfil</button>`:`<button type="button" class="p5-btn p5-btn-accent" data-p5="edit-profile">${icon('plus')} Criar meu perfil de DJ</button>`):'<span class="p5-subtle">Entre para criar um perfil ou seguir DJs.</span>';
}
function libraryPanel(){
 const el=$('p5PanelLibrary');
 if(!currentUser()){
   el.innerHTML=`<div class="p5-login-card">${icon('lock')}<h3>Sua biblioteca fica com você.</h3><p>Entre para guardar DJ sets em sua conta, montar playlists e sincronizar onde parou entre dispositivos.</p><button type="button" class="p5-btn p5-btn-accent" data-p5="login">Entrar / Criar conta ${icon('chevron')}</button></div>`;
   return;
 }
 const ps=approved(), favorites=ps.filter(p=>library.has(p.id));
 const seen=progress.map(row=>ps.find(p=>p.id===row.post_id)).filter(Boolean);
 let body='';
 if(currentLibraryTab==='favorites'){
   body=favorites.length?favorites.map(p=>listRow(p)).join(''):'<div class="p5-empty-mini">Sua coleção ainda está vazia. Toque no coração de um set para adicioná-lo aqui.</div>';
   body+=`<button type="button" class="p5-text-btn p5-import" data-p5="import-legacy">Importar favoritos salvos neste dispositivo ${icon('chevron')}</button>`;
 }else if(currentLibraryTab==='history'){
   body=seen.length?seen.map(p=>{const row=progress.find(r=>r.post_id===p.id);return listRow(p)+`<div class="p5-history-note">${Math.floor(row.seconds/60)} min ouvidos ${row.duration_seconds&&row.seconds<row.duration_seconds-25?'· Retomar':'· Reproduzido'}</div>`}).join(''):'<div class="p5-empty-mini">Os DJ sets que você ouvir aparecerão aqui.</div>';
 }else{
   body=playlists.length?playlists.map(pl=>`<div class="p5-playlist-card"><div class="p5-playlist-logo">${icon('queue')}</div><div><h4>${esc(pl.title)}</h4><span>${pl.visibility==='private'?'Privada':'Pública'} · ${esc(pl.description||'Sua seleção de músicas')}</span></div><button type="button" class="p5-btn p5-btn-outline" data-p5="open-playlist" data-list="${esc(pl.id)}">Abrir ${icon('chevron')}</button></div>`).join(''):'<div class="p5-empty-mini">Crie sua primeira playlist e adicione os sons que mais combinam com você.</div>';
 }
 el.innerHTML=`<div class="p5-lib-toolbar"><div><span class="p5-overline">MEMÓRIAS MUSICAIS</span><h3>Minha <em>biblioteca.</em></h3></div><button type="button" class="p5-btn p5-btn-accent" data-p5="new-playlist">${icon('plus')} Criar playlist</button></div>
 <div class="p5-lib-tabs">${[['favorites','Favoritos'],['playlists','Playlists'],['history','Histórico']].map(([id,label])=>`<button type="button" data-p5="library-tab" data-tab="${id}" class="${currentLibraryTab===id?'active':''}">${esc(label)}</button>`).join('')}</div><div id="p5LibContent">${body}</div>`;
}
function render(){if(!initialized)return;home();djs();libraryPanel();showTab(currentTab,false);}
function showTab(tab='home',scroll=true){currentTab=['home','djs','library'].includes(tab)?tab:'home';for(const [id,el] of [['home','p5PanelHome'],['djs','p5PanelDjs'],['library','p5PanelLibrary']])$(el).hidden=id!==currentTab;document.querySelectorAll('[data-p5tab]').forEach(b=>{const active=b.dataset.p5tab===currentTab;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});if(scroll){$('mobileNav')?.classList.remove('open');$('menuToggle')?.setAttribute('aria-expanded','false');$('pulso5').scrollIntoView({behavior:'smooth',block:'start'});}}
async function queryTable(table,fields='*',max=500){const {data,error}=await sb.from(table).select(fields).limit(max);if(error)throw error;return data||[];}
async function refresh(all=true){if(!initialized)return;const version=++refreshVersion;const person=currentUser();const newId=person?.id||null;try{
  const initial=all?await queryTable('pulso_dj_profiles','user_id,handle,display_name,bio,avatar_url,follower_count,created_at',250):profiles;
  if(newId){const [f,lib,hist,pls]=await Promise.all([
    sb.from('pulso_dj_follows').select('followed_id').eq('follower_id',newId).limit(500),
    sb.from('pulso_library_items').select('post_id').eq('user_id',newId).limit(1000),
    sb.from('pulso_listening_progress').select('post_id,seconds,duration_seconds,updated_at').eq('user_id',newId).order('updated_at',{ascending:false}).limit(80),
    sb.from('pulso_playlists').select('id,owner_id,title,description,visibility,created_at').eq('owner_id',newId).order('created_at',{ascending:false}).limit(150)
  ]);if([f,lib,hist,pls].some(x=>x.error))throw new Error([f,lib,hist,pls].filter(x=>x.error).map(x=>x.error.message).join('; '));
  if(version!==refreshVersion||currentUser()?.id!==newId)return;
  profiles=initial;followed=new Set(f.data.map(x=>x.followed_id));library=new Set(lib.data.map(x=>x.post_id));progress=hist.data;playlists=pls.data;accountId=newId;
  app.setSavedRemote?.([...library]);
 }else{if(version!==refreshVersion)return;profiles=initial;followed=new Set();library=new Set();progress=[];playlists=[];accountId=null;}
 render();
 }catch(error){console.warn('PULSO 5.0 dados:',error);notify('Não foi possível carregar sua biblioteca agora. Tente novamente.');}}
function doPlay(id,clearQueue=true){const p=approved().find(x=>x.id===id);if(!p){notify('Esta música não está disponível.');return;}if(clearQueue)queuedIds=[];app.playById(id);}
async function toggleFavorite(id,force=null){if(!needLogin())return;const uid=currentUser().id;const was=library.has(id),set=force??!was;if(was===set)return;const method=set?sb.from('pulso_library_items').insert({user_id:uid,post_id:id}):sb.from('pulso_library_items').delete().eq('user_id',uid).eq('post_id',id);const {error}=await method;if(error&&error.code!=='23505'){notify('Não foi possível atualizar seus favoritos.');return;}if(set)library.add(id);else library.delete(id);render();app.setSavedRemote?.([...library]);notify(set?'Salvo na sua biblioteca.':'Removido da sua biblioteca.');}
async function p51ProcessAvatar(file){
 if(file.size>12*1024*1024)throw new Error('A foto precisa ter até 12 MB.');
 const probableImage=file.type.startsWith('image/')||/\.(heic|heif|jpg|jpeg|png|webp)$/i.test(file.name);
 if(!probableImage)throw new Error('Selecione uma imagem da galeria.');
 const imgEl=new Image();const objectUrl=URL.createObjectURL(file);
 try{await new Promise((resolve,reject)=>{imgEl.onload=resolve;imgEl.onerror=()=>reject(new Error('Não foi possível abrir esta imagem. Tente JPEG/PNG.'));imgEl.src=objectUrl;});
 const max=640,scale=Math.min(1,max/Math.max(imgEl.naturalWidth,imgEl.naturalHeight));
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(imgEl.naturalWidth*scale));canvas.height=Math.max(1,Math.round(imgEl.naturalHeight*scale));
 const ctx=canvas.getContext('2d');ctx.fillStyle='#151b14';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(imgEl,0,0,canvas.width,canvas.height);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.82));if(!blob||blob.size>2*1024*1024)throw new Error('Não foi possível reduzir a foto.');return blob;
 }finally{URL.revokeObjectURL(objectUrl);}
}
async function saveProfile(form){
 if(!needLogin())return;
 const uid=currentUser().id,submit=form.querySelector('[type="submit"]');
 const handle=String(form.elements.namedItem('handle').value||'').trim().toLowerCase(),name=String(form.elements.namedItem('display_name').value||'').trim(),bio=String(form.elements.namedItem('bio').value||'').trim();
 let avatar=String(form.elements.namedItem('avatar_url').value||'').trim();
 if(!/^[a-z0-9_]{3,24}$/.test(handle))return setModalStatus('p5ProfileError','Use 3 a 24 letras minúsculas, números ou _ no nome de usuário.');
 if(name.length<2||name.length>50)return setModalStatus('p5ProfileError','Digite um nome de 2 a 50 caracteres.');
 if(avatar&&!url(avatar))return setModalStatus('p5ProfileError','A foto precisa ter uma URL HTTPS.');
 const file=form.elements.namedItem('avatar_file')?.files?.[0];
 const oldAvatar=profiles.find(p=>p.user_id===uid)?.avatar_url||'';let newUploadedPath=null;
 submit.disabled=true;submit.textContent='Salvando seu perfil…';
 try{
   if(file){
    setModalStatus('p5ProfileError','Reduzindo e enviando foto da galeria…');
    const blob=await p51ProcessAvatar(file);
    const path=`${uid}/avatars/${crypto.randomUUID()}.jpg`;newUploadedPath=path;
    const {error:uploadError}=await sb.storage.from('pulso-covers').upload(path,blob,{contentType:'image/jpeg',upsert:false,cacheControl:'86400'});
    if(uploadError)throw new Error('Falha no upload da foto: '+uploadError.message);
    avatar=sb.storage.from('pulso-covers').getPublicUrl(path).data.publicUrl;
   }
   const data={user_id:uid,handle,display_name:name,bio,avatar_url:avatar||null,updated_at:new Date().toISOString()};
   const exists=profiles.some(p=>p.user_id===uid);
   const result=exists?await sb.from('pulso_dj_profiles').update({handle,display_name:name,bio,avatar_url:avatar||null,updated_at:data.updated_at}).eq('user_id',uid):await sb.from('pulso_dj_profiles').insert(data);
   if(result.error)throw result.error;
   if(oldAvatar&&oldAvatar!==avatar){try{const u=new URL(oldAvatar);const prefix='/storage/v1/object/public/pulso-covers/';const pos=u.pathname.indexOf(prefix);if(pos>=0){const oldPath=decodeURIComponent(u.pathname.slice(pos+prefix.length));if(oldPath.startsWith(`${uid}/avatars/`))await sb.storage.from('pulso-covers').remove([oldPath]);}}catch{}}
   $('p5ProfileDialog').close();form.reset();await refresh(true);notify('Perfil e foto atualizados!');
 }catch(err){if(newUploadedPath)try{await sb.storage.from('pulso-covers').remove([newUploadedPath])}catch{}setModalStatus('p5ProfileError',err?.message||'Não foi possível salvar o perfil.');}
 finally{submit.disabled=false;submit.textContent='Salvar meu perfil →';}
}

function setModalStatus(id,text){const el=$(id);if(el)el.textContent=text;}
function editProfile(){if(!needLogin())return;const p=profiles.find(x=>x.user_id===currentUser().id);const f=$('p5ProfileForm');f.handle.value=p?.handle||'';f.display_name.value=p?.display_name||'';f.bio.value=p?.bio||'';f.avatar_url.value=p?.avatar_url||'';f.avatar_file.value='';const preview=$('p51AvatarPreview'),placeholder=$('p51AvatarPlaceholder');preview.hidden=!url(p?.avatar_url);if(!preview.hidden)preview.src=url(p.avatar_url);else preview.removeAttribute('src');placeholder.hidden=!preview.hidden;setModalStatus('p5ProfileError','');$('p5ProfileDialog').showModal();}
async function follow(uid){if(!needLogin())return;if(uid===currentUser().id)return;const exists=followed.has(uid);const action=exists?sb.from('pulso_dj_follows').delete().eq('follower_id',currentUser().id).eq('followed_id',uid):sb.from('pulso_dj_follows').insert({follower_id:currentUser().id,followed_id:uid});const {error}=await action;if(error){notify('Não foi possível atualizar seguidores.');return;}if(exists)followed.delete(uid);else followed.add(uid);await refresh();notify(exists?'Você deixou de seguir este perfil.':'Você começou a seguir este DJ.');if($('p5DjDialog').open)openProfile(uid);}
function openProfile(uid){const p=profiles.find(x=>x.user_id===uid);if(!p){notify('Perfil não encontrado.');return;}selectedProfile=uid;const ps=approved().filter(x=>x.owner_id===uid),mine=currentUser()?.id===uid;const cover=url(p.avatar_url);
$('p5DjDetail').innerHTML=`<div class="p5-detail-top"><div class="p5-detail-avatar">${cover?`<img src="${esc(cover)}" alt="">`:icon('user')}</div><div><span class="p5-overline">PERFIL DE QUEM PUBLICA</span><h3>${esc(p.display_name)}</h3><span>@${esc(p.handle)}</span><p>${esc(p.bio||'A música fala por si.')}</p><small>${Number(p.follower_count)||0} seguidores · ${ps.length} publicações</small><div class="p5-detail-actions">${mine?`<button type="button" class="p5-btn p5-btn-accent" data-p5="edit-profile">Editar perfil</button>`:`<button type="button" class="p5-btn p5-btn-accent" data-p5="follow" data-user="${esc(uid)}">${followed.has(uid)?'✓ Seguindo':'+ Seguir'}</button>`}<button type="button" class="p5-btn p5-btn-outline" data-p5="share-profile" data-handle="${esc(p.handle)}">Compartilhar ↗</button></div></div></div><div class="p5-row-heading"><div><span class="p5-overline">CURADORIA / PUBLICAÇÕES</span><h3>Sets e <em>sons.</em></h3></div></div>${ps.length?ps.map(p=>listRow(p)).join(''):'<div class="p5-empty-mini">Este perfil ainda não publicou músicas aprovadas.</div>'}`;
if(!$('p5DjDialog').open)$('p5DjDialog').showModal();}
async function createPlaylist(form){if(!needLogin())return;const title=String(form.elements.namedItem('title').value||'').trim(),description=String(form.elements.namedItem('description').value||'').trim(),visibility=form.elements.namedItem('visibility').value;if(title.length<2||title.length>70)return setModalStatus('p5PlaylistError','Digite um nome de 2 a 70 caracteres.');const {data,error}=await sb.from('pulso_playlists').insert({owner_id:currentUser().id,title,description,visibility}).select('id').single();if(error){setModalStatus('p5PlaylistError',error.message);return;}$('p5NewPlaylistDialog').close();form.reset();currentLibraryTab='playlists';await refresh(false);showTab('library');if(data?.id)await openPlaylist(data.id);}
async function openPlaylist(id){const playlist=playlists.find(x=>x.id===id);if(!playlist)return;let items=playlistItems.get(id);if(!items){const {data,error}=await sb.from('pulso_playlist_items').select('post_id,position,added_at').eq('playlist_id',id).order('position',{ascending:true}).order('added_at',{ascending:true}).limit(300);if(error){notify('Não foi possível carregar sua playlist.');return;}items=data;playlistItems.set(id,items);}const ps=items.map(x=>approved().find(p=>p.id===x.post_id)).filter(Boolean);$('p5PlaylistDetail').innerHTML=`<div class="p5-detail-list-head"><span class="p5-overline">PLAYLIST ${esc(playlist.visibility.toUpperCase())}</span><h3>${esc(playlist.title)}</h3><p>${esc(playlist.description||'A trilha sonora que você selecionou.')}</p><span>${ps.length} ${ps.length===1?'música':'músicas'}</span></div><div class="p5-modal-actions"><button type="button" class="p5-btn p5-btn-accent" data-p5="play-playlist" data-list="${esc(id)}">${icon('play')} Ouvir sequência</button><button type="button" class="p5-btn p5-btn-outline" data-p5="share-playlist" data-list="${esc(id)}">Compartilhar ↗</button>${currentUser()?.id===playlist.owner_id?`<button type="button" class="p5-btn p5-btn-outline" data-p5="delete-playlist" data-list="${esc(id)}">${icon('trash')} Excluir playlist</button>`:''}</div><div class="p5-playlist-rows">${ps.length?ps.map(p=>listRow(p,{remove:currentUser()?.id===playlist.owner_id,list:id})).join(''):'<div class="p5-empty-mini">Adicione músicas à playlist tocando no botão + de uma faixa.</div>'}</div>`;if(!$('p5PlaylistDialog').open)$('p5PlaylistDialog').showModal();}
function choosePlaylist(id){if(!needLogin())return;$('p5ChooseSongId').value=id;$('p5ChooseList').innerHTML=playlists.length?playlists.map(pl=>`<button type="button" class="p5-choose-row" data-p5="add-playlist" data-list="${esc(pl.id)}">${icon('queue')}<span>${esc(pl.title)}</span>${icon('plus')}</button>`).join(''):'<p class="p5-empty-mini">Crie sua primeira playlist para adicionar esta faixa.</p>';
$('p5ChooseDialog').showModal();}
async function addToPlaylist(id){if(!needLogin())return;const postId=$('p5ChooseSongId').value;if(!approved().some(p=>p.id===postId))return;const {error}=await sb.from('pulso_playlist_items').insert({playlist_id:id,post_id:postId,position:(playlistItems.get(id)||[]).length});if(error&&error.code!=='23505'){notify(error.message);return;}playlistItems.delete(id);$('p5ChooseDialog').close();notify('Música adicionada à playlist.');}
async function removeItem(listId,postId){const {error}=await sb.from('pulso_playlist_items').delete().eq('playlist_id',listId).eq('post_id',postId);if(error){notify(error.message);return;}playlistItems.delete(listId);openPlaylist(listId);}
async function deletePlaylist(id){if(!needLogin())return;if(!confirm('Excluir esta playlist? As músicas originais continuarão no PULSO.'))return;const {error}=await sb.from('pulso_playlists').delete().eq('id',id).eq('owner_id',currentUser().id);if(error)return notify(error.message);$('p5PlaylistDialog').close();playlistItems.delete(id);await refresh(false);notify('Playlist excluída.');}
async function playlistPlay(id){const items=playlistItems.get(id)||[];const available=items.map(it=>approved().find(p=>p.id===it.post_id)).filter(Boolean);if(!available.length)return notify('Esta playlist não tem músicas disponíveis.');queuedIds=available.map(p=>p.id);$('p5PlaylistDialog').close();doPlay(queuedIds[0],false);}
async function importLegacy(){if(!needLogin())return;let ids=[];try{ids=JSON.parse(localStorage.getItem('pulso_saved_legacy_v1')||localStorage.getItem('pulso_saved_v1')||'[]')}catch{}ids=ids.filter(id=>approved().some(p=>p.id===id));if(!ids.length)return notify('Não há favoritos antigos neste dispositivo.');if(!confirm(`Importar ${ids.length} favorito(s) guardado(s) neste dispositivo para sua conta?`))return;const rows=ids.map(post_id=>({user_id:currentUser().id,post_id}));const {error}=await sb.from('pulso_library_items').upsert(rows,{onConflict:'user_id,post_id'});if(error)return notify(error.message);await refresh(false);notify('Favoritos importados para sua conta!');}
async function shareLink(path){const share=url(path)||location.origin+location.pathname;try{if(navigator.share){await navigator.share({title:'PULSO × LØSI',url:share});return;}}catch(e){if(e.name==='AbortError')return;}try{await navigator.clipboard.writeText(share);notify('Link copiado.')}catch{notify('Copie o link: '+share);}}
async function onClick(ev){const button=ev.target.closest('[data-p5]');if(!button)return;const act=button.dataset.p5,id=button.dataset.id,list=button.dataset.list;try{
if(act==='tab')showTab(button.dataset.tab);
else if(act==='library-tab'){currentLibraryTab=button.dataset.tab;libraryPanel();}
else if(act==='discover')$('explorar').scrollIntoView({behavior:'smooth'});
else if(act==='radio')app.radio();
else if(act==='play')doPlay(id);
else if(act==='favorite')await toggleFavorite(id);
else if(act==='login')app.login();
else if(act==='profile')openProfile(button.dataset.user);
else if(act==='edit-profile'){if($('p5DjDialog').open)$('p5DjDialog').close();editProfile();}
else if(act==='follow')await follow(button.dataset.user);
else if(act==='share-profile'){const href=new URL(location.href);href.hash='';href.search='';href.searchParams.set('dj',button.dataset.handle);shareLink(href.href);}
else if(act==='new-playlist'){if(!needLogin())return;if($('p5ChooseDialog').open)$('p5ChooseDialog').close();$('p5PlaylistError').textContent='';$('p5NewPlaylistDialog').showModal();}
else if(act==='open-playlist')await openPlaylist(list);
else if(act==='play-playlist')await playlistPlay(list);
else if(act==='choose-playlist')choosePlaylist(id);
else if(act==='add-playlist')await addToPlaylist(list);
else if(act==='remove-item')await removeItem(list,id);
else if(act==='delete-playlist')await deletePlaylist(list);
else if(act==='share-playlist'){const href=new URL(location.href);href.hash='';href.search='';href.searchParams.set('playlist',list);shareLink(href.href);}
else if(act==='import-legacy')await importLegacy();
else if(act==='next-queue')nextQueue();
}catch(err){console.error('PULSO 5.0:',err);notify('Não foi possível concluir essa ação.');}}
function nextQueue(){const i=queuedIds.indexOf(currentPlayingId);if(i>=0&&i<queuedIds.length-1){const next=queuedIds[i+1];doPlay(next,false);}else notify('Você chegou ao fim da playlist.');}
function queueWidget(){const list=queuedIds.map(id=>approved().find(p=>p.id===id)).filter(Boolean);return list.length>1?`<div class="p5-queue"><div class="p5-queue-title">${icon('queue')} <strong>FILA DE REPRODUÇÃO</strong><span>${list.length} sons</span></div><div class="p5-queue-items">${list.map((p,i)=>`<button type="button" data-p5="play" data-id="${esc(p.id)}" class="${p.id===currentPlayingId?'active':''}"><span>${i+1}</span>${esc(p.title)}</button>`).join('')}</div><button type="button" class="p5-btn p5-btn-outline" data-p5="next-queue">Próxima na fila ${icon('next')}</button></div>`:'';}
function showQueue(){const root=document.querySelector('.pulso-audio-deck');if(!root)return;root.querySelector('.p5-queue')?.remove();root.insertAdjacentHTML('beforeend',queueWidget());}
function onPostOpened(post){currentPlayingId=post.id;if(queuedIds.length&&!queuedIds.includes(post.id))queuedIds=[];showQueue();}
function onAudioReady(post,audio,deck,{radio=false}={}){window.PULSO_CAPSULE?.observeNative?.(post,audio);if(activeAudioCleanup){activeAudioCleanup();activeAudioCleanup=null;}activeAudio=audio;currentPlayingId=post.id;
 let lastSaved=0,busyWrite=false;
 const save=async(force=false)=>{const u=currentUser();if(!u||!audio||!Number.isFinite(audio.currentTime))return;const elapsed=audio.currentTime,duration=audio.duration;if(elapsed<5&&!force)return;if(!force&&Date.now()-lastSaved<18000)return;if(busyWrite)return;const seconds=Number(Math.min(elapsed,86400).toFixed(2)),d=Number.isFinite(duration)?Number(Math.min(duration,86400).toFixed(2)):0;lastSaved=Date.now();busyWrite=true;
 try{const {error}=await sb.rpc('pulso_p5_save_progress',{p_post:post.id,p_seconds:seconds,p_duration:d});if(!error){const row={post_id:post.id,seconds,duration_seconds:d,updated_at:new Date().toISOString()};progress=[row,...progress.filter(p=>p.post_id!==post.id)].slice(0,100);if(currentTab==='home'||currentTab==='library')render();}}catch(e){console.debug('Progresso PULSO não salvo',e);}finally{busyWrite=false;}};
 const update=()=>save(false);
 const onPause=()=>{save(true);};
 const ended=()=>{save(true);if(!radio){const i=queuedIds.indexOf(post.id);if(i>=0&&i<queuedIds.length-1){const next=queuedIds[i+1];window.setTimeout(()=>{if(currentPlayingId===post.id)doPlay(next,false)},350);}}};
 const ready=()=>{if(radio)return;const last=progress.find(p=>p.post_id===post.id);const duration=audio.duration;if(last&&last.seconds>=20&&Number.isFinite(duration)&&last.seconds<duration-25&&audio.currentTime<3){try{audio.currentTime=last.seconds;notify(`Retomando ${post.title} de ${Math.floor(last.seconds/60)} min.`)}catch{}}};
 audio.addEventListener('timeupdate',update);audio.addEventListener('pause',onPause);audio.addEventListener('ended',ended);audio.addEventListener('loadedmetadata',ready,{once:true});audio.addEventListener('durationchange',ready,{once:true});
 const onHidden=()=>{if(document.hidden)save(true)};document.addEventListener('visibilitychange',onHidden);
 activeAudioCleanup=()=>{audio.removeEventListener('timeupdate',update);audio.removeEventListener('pause',onPause);audio.removeEventListener('ended',ended);document.removeEventListener('visibilitychange',onHidden)};
 if(deck){const extras=document.createElement('div');extras.className='p5-player-extras';extras.innerHTML=`<div class="p5-player-extra-head"><span class="p5-overline">PULSO IMMERSIVE</span><span class="p5-led">● HI-FI SESSION</span></div><div class="p5-eq" aria-label="Animação visual da reprodução">${Array.from({length:26},(_,i)=>`<i style="--i:${i};--h:${(i*13)%27+15}px"></i>`).join('')}</div><div class="p5-player-extra-actions"><button type="button" class="p5-btn p5-btn-outline" data-p5="favorite" data-id="${esc(post.id)}">${icon('heart')} Salvar</button><button type="button" class="p5-btn p5-btn-outline" data-p5="choose-playlist" data-id="${esc(post.id)}">${icon('plus')} Playlist</button></div>`;deck.appendChild(extras);showQueue();}
}
function onPlayerClosed(){activeAudioCleanup?.();activeAudioCleanup=null;activeAudio=null;}
function onSessionChanged(){if(!initialized)return;if((currentUser()?.id||null)!==accountId){playlistItems.clear();progress=[];library=new Set();followed=new Set();refresh(true)}else render();}
function onPostsChanged(){if(!initialized)return;render();}
function onLegacySave(id,saved){if(!initialized||!currentUser())return;toggleFavorite(id,Boolean(saved));}
function detectDeeplinks(){const q=new URLSearchParams(location.search);const h=q.get('dj'),playlist=q.get('playlist');if(h){const p=profiles.find(x=>x.handle===h);if(p){showTab('djs',false);openProfile(p.user_id)}}if(playlist&&/^[0-9a-f-]{36}$/i.test(playlist)){sb.from('pulso_playlists').select('id,owner_id,title,description,visibility').eq('id',playlist).maybeSingle().then(({data})=>{if(!data)return;playlists=[...playlists.filter(x=>x.id!==data.id),data];showTab('library',false);openPlaylist(data.id);});}}
function init(a){if(initialized)return;app=a;sb=a.client?.();if(!sb){$('p5PanelHome').innerHTML='<div class="p5-empty-mini">O modo de demonstração não grava playlists. Conecte o Supabase para ativar o PULSO 5.0.</div>';showTab('home',false);return;}initialized=true;
 document.body.addEventListener('error',ev=>{const image=ev.target;if(image instanceof HTMLImageElement&&(image.closest('.p5-shell')||image.closest('.p5-dialog'))){image.hidden=true;image.removeAttribute('src');}},true);
 document.body.addEventListener('click',ev=>{if(ev.target.closest('[data-p5]'))onClick(ev).catch(console.error)});
 document.body.addEventListener('click',ev=>{const b=ev.target.closest('[data-p5tab]');if(b){ev.preventDefault();showTab(b.dataset.p5tab)}});
 $('p5DjSearch').addEventListener('input',djs);
 $('p5ProfileForm').addEventListener('submit',e=>{e.preventDefault();saveProfile(e.target)});
 $('p51AvatarFile')?.addEventListener('change',ev=>{const file=ev.target.files?.[0],preview=$('p51AvatarPreview'),placeholder=$('p51AvatarPlaceholder');if(window.PULSO51_AVATAR_PREVIEW)window.PULSO51_AVATAR_PREVIEW(file,preview,placeholder);});
 $('p5NewPlaylistForm').addEventListener('submit',e=>{e.preventDefault();createPlaylist(e.target)});
 document.querySelectorAll('.p5-dialog').forEach(d=>{d.addEventListener('click',e=>{if(e.target===d)d.close()});d.querySelector('[data-p5-close]')?.addEventListener('click',()=>d.close())});
 refresh().then(()=>detectDeeplinks());}
window.PULSO5={init,refresh,onPostsChanged,onSessionChanged,onPostOpened,onAudioReady,onPlayerClosed,onLegacySave,toggleLibrary:toggleFavorite,openCreator:openProfile};
document.addEventListener('DOMContentLoaded',()=>{if(window.PULSO_APP)init(window.PULSO_APP)});
})();
