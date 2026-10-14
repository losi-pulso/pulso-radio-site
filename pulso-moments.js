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
   if(!items.length){grid.innerHTML='<div class="pmom-empty"><span>✳</span><strong>SEU MOMENTO PODE SER O PRIMEIRO.</strong><p>Foi a uma festa inesquecível? Compartilhe a energia com a comunidade PULSO.</p><button type="button" data-pmom-publish>PUBLICAR O PRIMEIRO VÍDEO ↗</button></div>';return;}
   grid.innerHTML=items.slice(0,6).map(p=>'<button type="button" class="pmom-card" data-pmom-watch="'+esc(p.id)+'" aria-label="Assistir '+esc(p.title)+'"><img loading="lazy" src="'+esc(thumbnail(p))+'" alt=""><span class="pmom-card-play">▶</span><span class="pmom-card-copy"><span>'+esc((p.artist||'COMUNIDADE PULSO').toUpperCase())+'</span><strong>'+esc(p.title||'Momento PULSO')+'</strong><small>'+esc((p.description||p.type||'Vídeo da comunidade').slice(0,110))+'</small></span></button>').join('');
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
 function watch(id=null){
   const app=window.PULSO_APP;const videos=approvedMoments();
   if(!videos.length){app?.toast?.('Ainda não há vídeos da comunidade aprovados. Seja o primeiro a publicar!');return;}
   if(window.PULSO_REELS?.open){window.PULSO_REELS.open(id||videos[0].id,'community');return;}
   app?.toast?.('O feed de vídeos está carregando. Tente novamente em instantes.');
 }
 document.addEventListener('click',ev=>{
   if(ev.target.closest('#pmomPublish,[data-pmom-publish]')){publish();return;}
   if(ev.target.closest('#pmomWatch')){watch();return;}
   const card=ev.target.closest('[data-pmom-watch]');if(card){watch(card.dataset.pmomWatch);return;}
 });
 document.addEventListener('DOMContentLoaded',()=>{render();setTimeout(render,900);setTimeout(render,2500);const source=$('communitySetGrid');if(source){new MutationObserver(()=>render()).observe(source,{childList:true,subtree:true});}});
 window.addEventListener('pulso:posts-updated',render);
 const observer=new MutationObserver(()=>{if(window.PULSO_APP)render();});
 document.addEventListener('DOMContentLoaded',()=>{const grid=$('pmomGrid');if(grid)observer.observe(grid,{childList:true,subtree:true});});
})();
