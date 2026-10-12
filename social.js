/* PULSO SOCIAL / STORY STUDIO — integra com o feed original sem substituir a rádio. */
(() => {
  'use strict';
  let api=null, activePost=null, counts=new Map(), myDislikes=new Set(), commentCounts=new Map();
  let refreshing=false, socialBusy=false, recordedBlob=null, recordedExt='mp4', artImage=null;
  const el=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const validUrl=v=>{try{const u=new URL(v);return u.protocol==='https:'?u.href:null}catch{return null}};
  const open=id=>{if(!el(id).open)el(id).showModal()};
  const close=id=>{if(el(id).open)el(id).close()};
  const user=()=>api?.user()||null;
  const sb=()=>api?.sb||null;
  const notify=s=>api?.toast(s);
  const postLink=p=>{const u=new URL(location.href);u.hash='';u.searchParams.set('track',p.id);return u.href};
  const postCover=p=>validUrl(p.cover)||((p.url||'').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/) ? `https://img.youtube.com/vi/${RegExp.$1}/hqdefault.jpg` : null);
  function footer(p){
    if(!p||p.status!=='approved')return '';
    const d=counts.get(p.id)||0,c=commentCounts.get(p.id)||0,m=myDislikes.has(p.id);
    return `<div class="social-extra" aria-label="Interações da publicação">
      <button type="button" data-social="dislike" data-id="${esc(p.id)}" class="social-action ${m?'social-selected':''}" aria-label="${m?'Remover deslike':'Não gostei'} de ${esc(p.title)}" aria-pressed="${m}">👎 <span>${d||''}</span></button>
      <button type="button" data-social="comments" data-id="${esc(p.id)}" class="social-action" aria-label="Comentários de ${esc(p.title)}">♧ <span>COMENTÁRIOS ${c?`· ${c}`:''}</span></button>
      <button type="button" data-social="story" data-id="${esc(p.id)}" class="social-action social-story-action" aria-label="Preparar Story de ${esc(p.title)}">◈ <span>STORY</span></button>
    </div>`;
  }
  async function refresh(){
    if(!sb()||refreshing)return;
    refreshing=true;
    try{
      const req=[sb().from('pulso_dislike_totals').select('post_id,dislikes').limit(1000),
        sb().from('pulso_comments').select('post_id').eq('status','visible').limit(5000)];
      if(user())req.push(sb().from('pulso_dislikes').select('post_id').eq('user_id',user().id).limit(1000));
      const rs=await Promise.all(req);
      for(const r of rs){if(r.error)throw r.error;}
      counts=new Map((rs[0].data||[]).map(x=>[x.post_id,x.dislikes]));
      commentCounts=new Map();for(const row of (rs[1].data||[]))commentCounts.set(row.post_id,(commentCounts.get(row.post_id)||0)+1);
      myDislikes=new Set(rs[2]?.data?.map(x=>x.post_id)||[]);
      api.rerender();
    }catch(err){console.warn('PULSO SOCIAL: não foi possível carregar interações',err.message);}
    finally{refreshing=false;}
  }
  async function dislike(post){
    if(!sb()){notify('Entre na versão pública do PULSO para avaliar.');return;}
    if(!user()){api.login();notify('Entre para avaliar esta música.');return;}
    if(socialBusy)return;socialBusy=true;
    try{
      const previous=myDislikes.has(post.id);
      const r=previous?
        await sb().from('pulso_dislikes').delete().eq('post_id',post.id).eq('user_id',user().id):
        await sb().from('pulso_dislikes').insert({post_id:post.id,user_id:user().id});
      if(r.error)throw r.error;
      // Uma trigger no banco remove a curtida anterior, se houver.
      notify(previous?'Deslike removido.':'Avaliação registrada.');
      await api.resync();await refresh();
    }catch(err){notify(`Não foi possível avaliar: ${err.message}`);}
    finally{socialBusy=false;}
  }
  async function displayComments(post){
    activePost=post;
    el('socialPostTitle').textContent=`${post.title} — comentários`;
    el('socialCommentInput').value='';el('socialCommentStatus').textContent='';
    el('socialComposer').hidden=!user();el('socialLoginHint').hidden=!!user();
    open('socialDialog');
    await loadComments();
  }
  async function loadComments(){
    if(!activePost||!sb()){el('socialCommentsList').innerHTML='<p class="social-empty">Comentários disponíveis na versão pública.</p>';return;}
    const target=activePost.id;
    el('socialCommentsList').innerHTML='<p class="social-empty">Carregando conversa…</p>';
    const {data,error}=await sb().from('pulso_comments').select('id,post_id,user_id,body,status,created_at').eq('post_id',target).order('created_at',{ascending:false}).limit(120);
    if(target!==activePost?.id)return;
    if(error){el('socialCommentsList').textContent=`Erro ao carregar: ${error.message}`;return;}
    const rows=data||[];
    const ids=[...new Set(rows.map(x=>x.user_id))];
    let profiles=new Map();
    if(ids.length){const p=await sb().from('pulso_profiles').select('user_id,display_name').in('user_id',ids);if(!p.error)profiles=new Map((p.data||[]).map(x=>[x.user_id,x.display_name]));}
    el('socialCommentsList').innerHTML=rows.length?rows.map(c=>{
      const mine=user()?.id===c.user_id;
      const admin=!!api.admin();
      const nickname=profiles.get(c.user_id)||(mine?'Você':'Membro da pista');
      const date=new Date(c.created_at).toLocaleString('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
      return `<article class="social-comment" data-comment-id="${esc(c.id)}"><div class="social-comment-meta"><strong>${esc(nickname)}</strong><time>${esc(date)}</time>${c.status==='hidden'?'<span class="social-hidden">OCULTO</span>':''}</div><p>${esc(c.body)}</p><div class="social-comment-actions">${admin||mine?`<button type="button" data-comment-action="delete">Excluir</button>`:''}${admin&&c.status==='visible'?'<button type="button" data-comment-action="hide">Ocultar</button>':''}${!mine?'<button type="button" data-comment-action="report">Denunciar</button>':''}</div></article>`;
    }).join(''):'<p class="social-empty">Seja a primeira pessoa a comentar esta frequência.</p>';
  }
  async function saveNickname(){
    if(!user()){api.login();return false;}
    let name=el('socialNickname').value.trim().replace(/\s+/g,' ');
    if(name.length<2||name.length>40){notify('Apelido precisa ter entre 2 e 40 caracteres.');return false;}
    const {error}=await sb().from('pulso_profiles').upsert({user_id:user().id,display_name:name,updated_at:new Date().toISOString()});
    if(error){notify(`Apelido: ${error.message}`);return false;}return true;
  }
  async function submitComment(ev){
    ev.preventDefault();if(!user()){api.login();return;}
    const body=el('socialCommentInput').value.trim();
    if(!body||body.length>600){notify('Escreva até 600 caracteres.');return;}
    const btn=el('socialCommentSubmit');btn.disabled=true;
    try{
      if(el('socialNickname').value.trim() && !await saveNickname())return;
      const {error}=await sb().from('pulso_comments').insert({post_id:activePost.id,user_id:user().id,body});
      if(error)throw error;
      el('socialCommentInput').value='';el('socialCommentStatus').textContent='Comentário publicado.';
      await Promise.all([loadComments(),refresh()]);
    }catch(err){notify('Erro ao comentar: '+err.message);}
    finally{btn.disabled=false;}
  }
  async function onCommentClick(ev){
    const b=ev.target.closest('[data-comment-action]');if(!b||!activePost)return;
    const article=b.closest('[data-comment-id]');const id=article?.dataset.commentId;if(!id)return;
    const action=b.dataset.commentAction;
    if(action==='report'){
      if(!user()){api.login();return;}
      const reason=prompt('Motivo da denúncia (8–400 caracteres):');if(reason===null)return;
      if(reason.trim().length<8||reason.length>400){notify('Explique o motivo em 8 a 400 caracteres.');return;}
      const {error}=await sb().from('pulso_comment_reports').insert({comment_id:id,reporter_id:user().id,reason:reason.trim()});
      notify(error?error.code==='23505'?'Você já denunciou este comentário.':error.message:'Denúncia enviada para moderação.');return;
    }
    if(!confirm(action==='delete'?'Excluir este comentário?':'Ocultar este comentário para o público?'))return;
    const q=action==='delete'?sb().from('pulso_comments').delete().eq('id',id):sb().from('pulso_comments').update({status:'hidden'}).eq('id',id);
    const {error}=await q;if(error){notify(error.message);return;}
    await loadComments();await refresh();
  }
  async function showModeration(){
    if(!api.admin())return;
    open('socialModerationDialog');
    el('socialReportsList').textContent='Carregando denúncias…';
    const {data,error}=await sb().from('pulso_comment_reports').select('comment_id,reporter_id,reason,created_at').order('created_at',{ascending:false}).limit(150);
    if(error){el('socialReportsList').textContent=error.message;return;}
    const ids=[...new Set((data||[]).map(x=>x.comment_id))];
    const c=ids.length?await sb().from('pulso_comments').select('id,body,post_id,status').in('id',ids):{data:[]};
    const lookup=new Map((c.data||[]).map(x=>[x.id,x]));
    el('socialReportsList').innerHTML=(data||[]).length?(data||[]).map(r=>{
      const row=lookup.get(r.comment_id);return `<div class="social-report" data-report-comment="${esc(r.comment_id)}" data-report-user="${esc(r.reporter_id)}"><small>${esc(new Date(r.created_at).toLocaleDateString('pt-BR'))}</small><p><b>Motivo:</b> ${esc(r.reason)}</p><p>${esc(row?.body||'Comentário removido')}</p><button type="button" data-moderation="dismiss">Dispensar denúncia</button> ${row?'<button type="button" data-moderation="delete" class="danger">Excluir comentário</button>':''}</div>`;
    }).join(''):'<p class="social-empty">Nenhuma denúncia de comentário.</p>';
  }
  async function onModerationClick(ev){
    const b=ev.target.closest('[data-moderation]');if(!b||!api.admin())return;
    const root=b.closest('[data-report-comment]');if(!root)return;
    const id=root.dataset.reportComment;
    const result=b.dataset.moderation==='delete'?await sb().from('pulso_comments').delete().eq('id',id):await sb().from('pulso_comment_reports').delete().eq('comment_id',id).eq('reporter_id',root.dataset.reportUser);
    if(result.error)notify(result.error.message);else{await showModeration();await refresh();}
  }
  async function prepareArt(p){
    artImage=null;
    const u=postCover(p);
    if(!u)return;
    try{const im=new Image();im.crossOrigin='anonymous';im.src=u;await Promise.race([im.decode(),new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),5000))]);artImage=im;}catch{}
  }
  function drawStory(p,time=0,video=null){
    const canvas=el('socialStoryCanvas'),ctx=canvas.getContext('2d');if(!ctx)return;
    const W=canvas.width,H=canvas.height;
    const g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,'#142518');g.addColorStop(.5,'#090e0d');g.addColorStop(1,'#263317');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    ctx.save();ctx.globalAlpha=.13;for(let i=0;i<13;i++){ctx.strokeStyle=i%2?'#d1fb83':'#98be5c';ctx.lineWidth=2;ctx.beginPath();ctx.arc(W/2,H*.38,160+i*33+Math.sin(time*.8+i)*5,0,2*Math.PI);ctx.stroke();}ctx.restore();
    ctx.fillStyle='#c5fb72';ctx.fillRect(65,80,110,10);
    ctx.font='bold 46px system-ui';ctx.fillStyle='#f4f9ec';ctx.fillText('PULSO',65,159);
    ctx.fillStyle='#c5fb72';ctx.fillText('× LØSI',256,159);
    const x=90,y=335,size=900;
    ctx.fillStyle='#1c271e';ctx.fillRect(x-8,y-8,size+16,size+16);
    if(video && video.readyState>=2){try{ctx.drawImage(video,x,y,size,size);}catch{}}
    else if(artImage){try{const s=Math.min(artImage.naturalWidth,artImage.naturalHeight),sx=(artImage.naturalWidth-s)/2,sy=(artImage.naturalHeight-s)/2;ctx.drawImage(artImage,sx,sy,s,s,x,y,size,size);}catch{}}
    else{ctx.fillStyle='#23311e';ctx.fillRect(x,y,size,size);ctx.fillStyle='#c6fc72';ctx.font='bold 330px system-ui';ctx.textAlign='center';ctx.fillText('◉',W/2,y+590);ctx.textAlign='left';}
    ctx.fillStyle='rgba(7,11,8,.85)';ctx.fillRect(65,1320,950,360);
    ctx.fillStyle='#c9f680';ctx.font='bold 29px system-ui';ctx.fillText('NOW PLAYING  /  PULSO RADIO',100,1388);
    let title=String(p.title||'');ctx.fillStyle='#fff';ctx.font='bold 67px system-ui';while(ctx.measureText(title).width>880 && title.length>4)title=title.slice(0,-2);if(title!==p.title)title+='…';ctx.fillText(title,100,1491);
    let artist=String(p.artist||'PULSO');ctx.font='38px system-ui';while(ctx.measureText(artist).width>870&&artist.length>4)artist=artist.slice(0,-2);ctx.fillStyle='#d4ddcb';ctx.fillText(artist,100,1560);
    const width=time?Math.min(1,time/60):.28;
    ctx.fillStyle='#3c4b35';ctx.fillRect(100,1633,870,11);ctx.fillStyle='#c8ff70';ctx.fillRect(100,1633,width*870,11);
    ctx.fillStyle='#e8efe0';ctx.font='bold 29px system-ui';ctx.fillText('OUÇA NO PULSO',65,1805);
    ctx.font='25px system-ui';ctx.fillStyle='#bec8ba';ctx.fillText(location.host,65,1855);
  }
  async function openStory(p){
    activePost=p;recordedBlob=null;
    el('storyPostHeading').textContent=p.title+' — '+p.artist;
    el('storyRights').checked=false;el('storyStatus').textContent='';
    el('shareStoryVideo').disabled=true;el('downloadStoryVideo').disabled=true;
    open('storyDialog');
    await prepareArt(p);if(activePost?.id!==p.id)return;drawStory(p);
  }
  function canvasBlob(){return new Promise((resolve,reject)=>el('socialStoryCanvas').toBlob(b=>b?resolve(b):reject(new Error('Imagem indisponível.')),'image/png'));}
  async function shareFile(blob,ext){
    const file=new File([blob],`pulso-${Date.now()}.${ext}`,{type:blob.type||(ext==='png'?'image/png':'video/mp4')});
    if(navigator.share && navigator.canShare?.({files:[file]})){
      try{await navigator.share({files:[file],title:'PULSO × LØSI',text:activePost.title});return;}catch(err){if(err.name==='AbortError')return;}
    }
    const url=URL.createObjectURL(file);const a=document.createElement('a');a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    notify('Arquivo salvo. Abra o Instagram, escolha Story e selecione-o na galeria.');
  }
  async function shareImage(){if(!activePost)return;try{const blob=await canvasBlob();await shareFile(blob,'png');}catch(err){notify(err.message);}}
  async function shareLink(){
    if(!activePost)return;
    const link=postLink(activePost);
    try{if(navigator.share)await navigator.share({url:link,title:activePost.title});else {await navigator.clipboard.writeText(link);notify('Link copiado.');}}
    catch(err){if(err.name!=='AbortError')notify('Não foi possível compartilhar.');}
  }
  async function recordStory(){
    if(!activePost)return;
    if(!el('storyRights').checked){notify('Confirme que possui direitos ou autorização para compartilhar o áudio/vídeo.');return;}
    const p=activePost;const url=validUrl(p.url)||'';
    const own=/\.workers\.dev\/media\/|\.supabase\.co\/storage\/v1\/object\/public\//.test(url);
    if(!own){el('storyStatus').textContent='Áudio de SoundCloud/YouTube/Spotify não pode ser extraído automaticamente. Use uma imagem e adicione música no Instagram, se disponível.';return;}
    const canvas=el('socialStoryCanvas');
    if(!canvas.captureStream || !window.MediaRecorder){el('storyStatus').textContent='Este navegador não oferece gravação de vídeo do Canvas. Compartilhe a imagem e adicione a música no Instagram.';return;}
    const mime=['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4','video/webm;codecs=vp8,opus','video/webm'].find(x=>MediaRecorder.isTypeSupported(x));
    if(!mime){el('storyStatus').textContent='Formato de vídeo indisponível neste aparelho.';return;}
    const media=document.createElement(p.type==='Videoclipe'||p.type==='Vídeo DJ Set'||p.type==='Live'?'video':'audio');
    media.crossOrigin='anonymous';media.preload='auto';media.src=url;media.muted=false;media.playsInline=true;
    let ac=null,raf=0,stream=null,recorder=null;
    const btn=el('renderStoryVideo');btn.disabled=true;el('storyStatus').textContent='Preparando trecho de até 60 segundos. Mantenha a tela aberta…';
    try{
      await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('Tempo de carregamento excedido.')),16000);media.onloadedmetadata=()=>{clearTimeout(t);resolve()};media.onerror=()=>{clearTimeout(t);reject(new Error('Não foi possível carregar a mídia. Verifique autorização de CORS do Worker.'))};media.load();});
      let at=Number(el('storyStartSeconds').value)||0;at=Math.max(0,Math.min(at,Math.max(0,(media.duration||0)-60)));
      if(at>0){media.currentTime=at;await new Promise(r=>{media.onseeked=r;setTimeout(r,3000)});}
      const AudioCtx=window.AudioContext||window.webkitAudioContext;if(!AudioCtx)throw new Error('Captura de áudio não disponível.');
      ac=new AudioCtx();const source=ac.createMediaElementSource(media),destination=ac.createMediaStreamDestination();source.connect(destination);await ac.resume();
      stream=canvas.captureStream(20);for(const track of destination.stream.getAudioTracks())stream.addTrack(track);
      recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:1800000,audioBitsPerSecond:128000});
      const parts=[];recorder.ondataavailable=ev=>{if(ev.data?.size)parts.push(ev.data)};
      const completed=new Promise((resolve,reject)=>{recorder.onerror=ev=>reject(ev.error||new Error('Falha na gravação.'));recorder.onstop=()=>resolve(new Blob(parts,{type:mime.split(';')[0]}));});
      const started=performance.now();function frame(){drawStory(p,Math.min(60,(performance.now()-started)/1000),media.tagName==='VIDEO'?media:null);raf=requestAnimationFrame(frame);}frame();
      recorder.start(1000);await media.play();
      await Promise.race([new Promise(r=>setTimeout(r,60000)),new Promise(r=>{media.addEventListener('ended',r,{once:true})})]);recorder.stop();media.pause();cancelAnimationFrame(raf);raf=0;
      const file=await completed;if(file.size<1000)throw new Error('O trecho ficou vazio.');
      recordedBlob=file;recordedExt=mime.startsWith('video/mp4')?'mp4':'webm';
      el('storyStatus').textContent=`Vídeo gerado (${(file.size/1048576).toFixed(1)} MB, ${recordedExt.toUpperCase()}). Abra com o Instagram, se o formato for aceito.`;
      el('shareStoryVideo').disabled=false;el('downloadStoryVideo').disabled=false;
    }catch(err){el('storyStatus').textContent='Não foi possível gerar vídeo com áudio neste aparelho: '+err.message+' Compartilhe a imagem e adicione áudio no Instagram.';}
    finally{try{media.pause();media.src='';media.load()}catch{}if(raf)cancelAnimationFrame(raf);if(recorder?.state==='recording')recorder.stop();stream?.getTracks().forEach(t=>t.stop());try{await ac?.close()}catch{}btn.disabled=false;drawStory(p);}
  }
  async function downloadVideo(){if(!recordedBlob)return;await shareFile(recordedBlob,recordedExt);}
  async function onGridClick(ev){const b=ev.target.closest('[data-social]');if(!b)return;
    const p=api.posts().find(x=>String(x.id)===b.dataset.id);if(!p)return;
    const kind=b.dataset.social;
    if(kind==='dislike')await dislike(p);
    else if(kind==='comments')await displayComments(p);
    else if(kind==='story')await openStory(p);
  }
  function init(context){
    api=context;
    el('cardsGrid').addEventListener('click',onGridClick);
    el('closeSocialDialog').addEventListener('click',()=>close('socialDialog'));
    el('socialDialog').addEventListener('click',ev=>{if(ev.target===el('socialDialog'))close('socialDialog')});
    el('socialCommentForm').addEventListener('submit',submitComment);
    el('socialCommentsList').addEventListener('click',onCommentClick);
    el('socialLoginButton').addEventListener('click',()=>{close('socialDialog');api.login();});
    el('socialModOpen').addEventListener('click',showModeration);
    el('socialModClose').addEventListener('click',()=>close('socialModerationDialog'));
    el('socialReportsList').addEventListener('click',onModerationClick);
    el('storyClose').addEventListener('click',()=>close('storyDialog'));
    el('storyDialog').addEventListener('click',ev=>{if(ev.target===el('storyDialog'))close('storyDialog')});
    el('shareStoryImage').addEventListener('click',shareImage);
    el('shareStoryLink').addEventListener('click',shareLink);
    el('renderStoryVideo').addEventListener('click',recordStory);
    el('shareStoryVideo').addEventListener('click',downloadVideo);
    el('downloadStoryVideo').addEventListener('click',downloadVideo);
    // Ajusta o apelido opcional a cada login.
    el('socialNickname').addEventListener('focus',async()=>{if(!user()||el('socialNickname').value)return;const r=await sb().from('pulso_profiles').select('display_name').eq('user_id',user().id).maybeSingle();if(r.data)el('socialNickname').value=r.data.display_name;});
  }
  window.PULSO_SOCIAL={init,footer,refresh,ready:true,openCommentsForPost:displayComments,openStoryForPost:openStory};
})();
