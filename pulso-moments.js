/* PULSO MOMENTS — reuses the approved community video catalog and moderation flow. */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const videoTypes=new Set(['Videoclipe','Vídeo DJ Set','Live']);
 const safeUrl=v=>{try{const u=new URL(String(v));return u.protocol==='https:'?u.href:''}catch{return''}};
 function thumbnail(p){
   if(safeUrl(p.cover))return safeUrl(p.cover);
   const u=String(p.url||'');let id='';
   try{const x=new URL(u);if(x.hostname.includes('youtu.be'))id=x.pathname.slice(1).split('/')[0];else if(x.hostname.includes('youtube.com'))id=x.searchParams.get('v')||x.pathname.split('/').filter(Boolean).pop()||'';}catch{}
   return /^[\w-]{11}$/.test(id)?'https://i.ytimg.com/vi/'+id+'/hqdefault.jpg':'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=640&q=75';
 }
 function approvedMoments(){return (window.PULSO_APP?.posts?.()||[]).filter(p=>p&&p.status==='approved'&&!p.demo&&videoTypes.has(p.type)&&safeUrl(p.url)).slice(0,90);}
 function render(){
   const grid=$('pmomGrid');if(!grid)return;
   const items=approvedMoments();
   $('pmomCount').textContent=items.length?items.length+' VÍDEO'+(items.length===1?'':'S')+' APROVADO'+(items.length===1?'':'S'):'SEJA O PRIMEIRO A COMPARTILHAR';
   if(!items.length){grid.innerHTML='<div class="pmom-empty"><span>✳</span><strong>SEU MOMENTO PODE SER O PRIMEIRO.</strong><p>Foi a uma festa inesquecível? Compartilhe a energia com a comunidade PULSO.</p><button type="button" data-pmom-publish>PUBLICAR O PRIMEIRO VÍDEO</button></div>';return;}
   grid.innerHTML=items.slice(0,6).map(p=>'<button type="button" class="pmom-card" data-pmom-watch="'+esc(p.id)+'" aria-label="Reproduzir '+esc(p.title)+'"><img loading="lazy" src="'+esc(thumbnail(p))+'" alt=""><span class="pmom-card-badge">PULSO MOMENT</span><span class="pmom-card-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.8a1.3 1.3 0 0 1 1.96-1.12l10 6.2a1.3 1.3 0 0 1 0 2.24l-10 6.2A1.3 1.3 0 0 1 8 18.2z"/></svg></span><span class="pmom-card-copy"><span>'+esc((p.artist||'COMUNIDADE PULSO').toUpperCase())+'</span><strong>'+esc(p.title||'Momento PULSO')+'</strong><small>'+esc((p.description||p.type||'Vídeo da comunidade').slice(0,110))+'</small></span></button>').join('');
 }
 function publish(){
   const trigger=$('openComposer')||$('mobilePublish')||$('appPublishButton');
   if(!trigger){window.PULSO_APP?.toast?.('Abra a opção Publicar para enviar seu vídeo.');return;}
   trigger.click();
   const dialog=$('composerDialog');
   if(dialog?.open){
     const type=$('postType');if(type){type.value='Videoclipe';type.dispatchEvent(new Event('change',{bubbles:true}));}
     const title=$('composerTitle');if(title)title.innerHTML='PUBLICAR <em>SEU MOMENT.</em>';
     const intro=$('composerIntro');if(intro)intro.textContent='Compartilhe um momento real de uma festa, club ou festival. Escolha o vídeo do celular, coloque o nome do evento e do DJ na descrição e envie. Seu vídeo ficará aguardando aprovação antes de aparecer para a comunidade.';
     const description=$('postDescription');if(description&&!description.value)description.placeholder='Qual festa? Qual club ou festival? Quem estava tocando? Conte a vibe…';
     const titleInput=$('postTitle');if(titleInput)titleInput.placeholder='Ex.: Sábado no Warung — pista pegando fogo';
     $('postTitle')?.focus();
   }else{
     window.PULSO_APP?.toast?.('Entre na sua conta e toque em “Publicar meu momento” novamente para selecionar o vídeo.');
   }
 }
 function youtubeId(raw){
   try{const u=new URL(raw);if(u.hostname.includes('youtu.be'))return u.pathname.split('/').filter(Boolean)[0]||'';if(u.hostname.includes('youtube.com'))return u.searchParams.get('v')||u.pathname.split('/').filter(Boolean).pop()||'';}catch{}return '';
 }
 function player(){
   let d=$('pmomPlayerDialog');if(d)return d;
   d=document.createElement('dialog');d.id='pmomPlayerDialog';d.className='pmom-player-dialog';d.setAttribute('aria-label','Player PULSO Moments');
   d.innerHTML='<div class="pmom-player-head"><div class="pmom-player-brand"><span>◉ PULSO MOMENTS · AGORA NA PISTA</span><strong id="pmomPlayerTitle">Momento da comunidade</strong></div><button type="button" class="pmom-player-close" id="pmomPlayerClose" aria-label="Fechar player">×</button></div><div class="pmom-player-stage" id="pmomPlayerStage"></div><div class="pmom-player-foot"><strong>VÍDEOS REAIS. ENERGIA COMPARTILHADA.</strong><span>Respeite os criadores e compartilhe com autorização.</span></div>';
   document.body.appendChild(d);
   d.addEventListener('click',ev=>{if(ev.target===d)closePlayer();});
   $('pmomPlayerClose').addEventListener('click',closePlayer);
   d.addEventListener('close',()=>{$('pmomPlayerStage').innerHTML='';});
   return d;
 }
 function closePlayer(){const d=$('pmomPlayerDialog');if(!d)return;if(d.open)d.close();$('pmomPlayerStage').innerHTML='';}
 function watch(id=null){
   const app=window.PULSO_APP;const videos=approvedMoments();
   if(!videos.length){app?.toast?.('Ainda não há vídeos da comunidade aprovados. Seja o primeiro a publicar!');return;}
   const p=videos.find(v=>String(v.id)===String(id))||videos[0],url=safeUrl(p.url);
   if(!url){app?.toast?.('Este vídeo não possui um endereço válido.');return;}
   const d=player(),stage=$('pmomPlayerStage'),yt=youtubeId(url);
   $('pmomPlayerTitle').textContent=p.title||'Momento PULSO';
   if(yt){
     const iframe=document.createElement('iframe');iframe.src='https://www.youtube-nocookie.com/embed/'+encodeURIComponent(yt)+'?autoplay=1&playsinline=1&rel=0';iframe.title=p.title||'Vídeo PULSO';iframe.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';iframe.allowFullscreen=true;stage.appendChild(iframe);
   }else{
     const video=document.createElement('video');video.controls=true;video.autoplay=true;video.playsInline=true;video.preload='metadata';video.src=url;video.setAttribute('aria-label',p.title||'Vídeo da comunidade');stage.appendChild(video);
     const attempt=video.play();if(attempt&&typeof attempt.catch==='function')attempt.catch(()=>{});
   }
   if(!d.open){if(typeof d.showModal==='function')d.showModal();else d.setAttribute('open','');}
 }
 document.addEventListener('click',ev=>{
   if(ev.target.closest('#pmomPublish,[data-pmom-publish]')){publish();return;}
   if(ev.target.closest('#pmomWatch')){watch();return;}
   const card=ev.target.closest('[data-pmom-watch]');if(card){watch(card.dataset.pmomWatch);return;}
 });
 document.addEventListener('DOMContentLoaded',()=>{render();setTimeout(render,900);setTimeout(render,2500);const source=$('communitySetGrid');if(source){new MutationObserver(()=>render()).observe(source,{childList:true,subtree:true});}});
 window.addEventListener('pulso:posts-updated',render);
 document.addEventListener('keydown',ev=>{if(ev.key==='Escape')closePlayer();});
})();
