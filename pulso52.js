/* PULSO 5.4 — REELS MIX (posts aprovados + curadoria YouTube), ordem aleatória, Instagram oficial e perfil do uploader distintos. */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeUrl=v=>{try{const u=new URL(String(v));return u.protocol==='https:'?u.href:''}catch{return''}};
  const movieTypes=new Set(['Videoclipe','Vídeo DJ Set','Live']);
  let items=[],active=-1,opened=false,lastMedia=null,pendingScroll=false,linkedDismissed=false;
  let youtubePlayer=null,youtubeApiPromise=null,youtubeEpoch=0,youtubeMuted=true;
  // The YouTube IFrame API is used only for official embedded player commands.
  function youtubeApi(){
    if(window.YT?.Player)return Promise.resolve(window.YT);
    if(youtubeApiPromise)return youtubeApiPromise;
    youtubeApiPromise=new Promise((resolve,reject)=>{
      const previous=window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady=()=>{try{if(typeof previous==='function')previous();}finally{resolve(window.YT);}};
      // If the radio already injected the API script, share the same ready event.
      if(!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')){
        const js=document.createElement('script');js.src='https://www.youtube.com/iframe_api';js.async=true;
        js.onerror=()=>{youtubeApiPromise=null;reject(new Error('Não foi possível carregar a API do YouTube'));};
        document.head.append(js);
      }
    });
    return youtubeApiPromise;
  }
  function updateYoutubeSound(slide){
    const button=slide?.querySelector('[data-reel-action="sound"]');if(!button)return;
    button.hidden=false;button.setAttribute('aria-label',youtubeMuted?'Ativar som do YouTube':'Desativar som do YouTube');
    button.setAttribute('aria-pressed',String(!youtubeMuted));
    button.innerHTML=icon(youtubeMuted?'mute':'volume')+'<span>'+(youtubeMuted?'Ativar som':'Som ligado')+'</span>';
  }
  async function controlYoutube(frame,index,slide,status,epoch){
    let YT;try{YT=await youtubeApi();}catch(err){console.warn(err);if(epoch===youtubeEpoch)status.textContent='Vídeo carregado. Toque no player do YouTube para ouvir.';return;}
    if(!opened||active!==index||lastMedia!==frame||epoch!==youtubeEpoch)return;
    try{
      const player=new YT.Player(frame,{
        events:{
          onReady:evt=>{
            if(!opened||active!==index||epoch!==youtubeEpoch)return;
            try{evt.target.mute();evt.target.playVideo();}catch(err){console.warn('YouTube Reels:',err);}
          },
          onStateChange:evt=>{
            if(!opened||active!==index||epoch!==youtubeEpoch)return;
            if(evt.data===1)status.textContent=youtubeMuted?'Reprodução automática • toque em Ativar som':'Reproduzindo com som';
            if(evt.data===0)status.textContent='Vídeo concluído • deslize para o próximo';
          },
          onAutoplayBlocked:()=>{
            if(opened&&active===index&&epoch===youtubeEpoch)status.textContent='O navegador bloqueou a reprodução automática. Toque no vídeo para iniciar.';
          },
          onError:()=>{
            if(opened&&active===index&&epoch===youtubeEpoch)status.textContent='YouTube indisponível aqui. Toque em Assistir completo.';
          }
        }
      });
      // Always keep only one live YouTube player; cleanup() destroys the previous one.
      if(epoch===youtubeEpoch)youtubePlayer=player;
      else player.destroy?.();
    }catch(err){console.warn('YouTube Reels:',err);if(epoch===youtubeEpoch)status.textContent='Toque no player para reproduzir.';}
  }
  // Audio preference lives for the Reels session. iOS may still block unmuted autoplay after swiping.
  let soundWanted=true;
  const linkedReel=new URL(location.href).searchParams.get('reel');
  const dialog=()=>$('pulsoReelsDialog');
  const track=()=>$('p52ReelsTrack');
  const app=()=>window.PULSO_APP;
  const videoKey=p=>{const s=source(p);return s.kind==='youtube'?s.url.split('/embed/')[1]?.split('?')[0]:'url:'+safeUrl(p.url);};
  // A curated YouTube set is a link, not a fake Supabase post, so it never gains a made-up owner or likes.
  function getVideos(){
    const approved=[...(app()?.posts?.()||[])].filter(p=>p.status==='approved'&&!p.demo&&movieTypes.has(p.type)&&safeUrl(p.url));
    const curated=window.PULSO54?.sets||[];
    const unique=[],seen=new Set();
    for(const p of [...approved,...curated]){const key=videoKey(p);if(!key||seen.has(key))continue;seen.add(key);unique.push(p);}
    return unique.slice(0,180);
  }
  function shuffled(list){
    const result=[...list];
    for(let i=result.length-1;i>0;i--){let random;
      try{const bytes=new Uint32Array(1);crypto.getRandomValues(bytes);random=bytes[0]/4294967296;}
      catch{random=Math.random();}
      const j=Math.floor(random*(i+1));[result[i],result[j]]=[result[j],result[i]];
    }return result;
  }
  function icon(kind){const d={heart:'M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6z',comment:'M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9.3 9.3 0 0 1-4-.9L3 21l1.9-5.5a9.3 9.3 0 0 1-.9-4A8.5 8.5 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5z',share:'M12 3v12m0-12 5 5m-5-5L7 8M5 13v6h14v-6',user:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-5 3-7 8-7s8 2 8 7',play:'M8 5l11 7-11 7z',volume:'M4 10v4h4l5 4V6L8 10H4zm12-3a7 7 0 0 1 0 10',mute:'M4 10v4h4l5 4V6L8 10H4zm12-2 5 8m0-8-5 8'};return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="${d[kind]||d.play}"/></svg>`;}
  function source(p){
    const url=safeUrl(p.url);if(!url)return {kind:'unsupported',url:''};
    const u=new URL(url),host=u.hostname.toLowerCase().replace(/^www\./,'');
    if(/\.(mp4|mov|webm)$/i.test(u.pathname))return {kind:'direct',url};
    let id='';if(host==='youtu.be')id=u.pathname.split('/')[1]||'';
    if(['youtube.com','m.youtube.com','music.youtube.com','youtube-nocookie.com'].includes(host)){
      if(u.pathname==='/watch')id=u.searchParams.get('v')||'';
      else if(/^\/(shorts|embed|live)\//.test(u.pathname))id=u.pathname.split('/')[2]||'';
    }
    if(/^[\w-]{11}$/.test(id)){
      // Autoplay is muted for mobile browsers; sound must be enabled by an explicit tap.
      const params=new URLSearchParams({autoplay:'1',mute:'1',playsinline:'1',controls:'1',rel:'0',enablejsapi:'1',origin:location.origin});
      return {kind:'youtube',url:`https://www.youtube-nocookie.com/embed/${id}?${params}`};
    }
    if(host==='vimeo.com'||host==='player.vimeo.com'){
      const videoId=u.pathname.match(/(?:^\/|\/video\/)([0-9]{6,15})(?:\/|$)/)?.[1];
      if(videoId)return {kind:'vimeo',url:`https://player.vimeo.com/video/${videoId}?autoplay=0&muted=0&playsinline=1&controls=1`};
    }
    return {kind:'unsupported',url};
  }
  function open(requestedId=null){
    if(opened){if(requestedId){const i=items.findIndex(p=>String(p.id)===String(requestedId));if(i>=0){track().children[i]?.scrollIntoView({block:'start'});activate(i);}}return;}
    const d=dialog();if(!d)return;
    app()?.pauseForReels?.();
    window.PULSO_VIDEO?.pause?.(); // Se o usuário escolher Reels, evite áudio simultâneo.
    items=shuffled(getVideos());opened=true;render();d.showModal();document.querySelectorAll('[data-open-reels]').forEach(b=>b.setAttribute('aria-expanded','true'));
    const selected=requestedId?items.findIndex(p=>String(p.id)===String(requestedId)):-1;const start=selected>=0?selected:0;
    if(start&&track().children[start])track().scrollTop=track().children[start].offsetTop-track().offsetTop;
    activate(items.length?start:-1);
    $('mobileNav')?.classList.remove('open');$('menuToggle')?.setAttribute('aria-expanded','false');
  }
  function close(){if(dialog()?.open)dialog().close();}
  function cleanup(){
    youtubeEpoch++;
    if(youtubePlayer){try{youtubePlayer.stopVideo?.();youtubePlayer.destroy?.();}catch{}youtubePlayer=null;}
    if(lastMedia){
      if(lastMedia.tagName==='VIDEO'){lastMedia.pause();lastMedia.removeAttribute('src');lastMedia.load();}
      else lastMedia.removeAttribute('src');lastMedia.remove();lastMedia=null;
    }
    track()?.querySelectorAll('.p52-reel-media').forEach(node=>node.replaceChildren());
  }
  function onClose(){opened=false;linkedDismissed=true;cleanup();items=[];active=-1;document.querySelectorAll('[data-open-reels]').forEach(b=>b.setAttribute('aria-expanded','false'));}
  function slide(p,i){
    const art=safeUrl(p.cover);
    const cover=art?`<img src="${escape(art)}" alt="" loading="lazy">`:'<div class="p52-reel-cover-fallback">'+icon('play')+'</div>';
    const isCurated=!!p.curated;
    const like=isCurated?false:(app()?.isLiked?.(p.id)||false);
    const instagram=window.PULSO54?.djInstagram?.(p)||'';
    // A DJ is not automatically the user who uploaded the video.
    const officialLabel=isCurated?` · ${escape(p.event||'CURADORIA')} ${escape(p.year||'')}`:'';
    return `<article class="p52-reel-slide" data-reel-index="${i}" data-post-id="${escape(p.id)}" aria-label="Vídeo ${i+1}: ${escape(p.title)}">
      <div class="p52-reel-stage"><div class="p52-reel-cover">${cover}</div><div class="p52-reel-media"></div><div class="p52-reel-shade"></div>
        <div class="p52-reel-chip">${escape(p.genre||'MÚSICA ELETRÔNICA')}${isCurated?' · YOUTUBE OFICIAL':''}</div>
        <div class="p52-reel-copy"><span class="p52-reel-by">${escape(p.artist||'PULSO RADIO')}${officialLabel}</span><h3>${escape(p.title)}</h3>${p.description?`<p>${escape(String(p.description).slice(0,160))}</p>`:''}${isCurated?`<small class="p52-reel-channel">${escape(p.source_name||'Vídeo externo no YouTube')}</small>`:''}<button type="button" class="p52-reel-full" data-reel-action="original">${isCurated?'VER NO YOUTUBE ↗':'ASSISTIR COMPLETO ↗'}</button></div>
        <div class="p52-reel-actions">
          ${isCurated?'':`<button type="button" data-reel-action="like" aria-label="Curtir vídeo" aria-pressed="${like}">${icon('heart')}<span class="p52-reel-like-number">${Math.max(0,Number(p.likes_count)||0)}</span></button>
          <button type="button" data-reel-action="comments" aria-label="Comentários do vídeo">${icon('comment')}<span>Comentar</span></button>`}
          <button type="button" data-reel-action="share" aria-label="Compartilhar vídeo">${icon('share')}<span>Enviar</span></button>
          ${instagram?`<button type="button" data-reel-action="instagram" aria-label="Instagram oficial de ${escape(p.artist)}">${icon('user')}<span>DJ ↗</span></button>`:''}
          ${!isCurated&&p.owner_id?`<button type="button" data-reel-action="poster" aria-label="Perfil PULSO de quem publicou">${icon('user')}<span>Perfil PULSO</span></button>`:''}
          <button type="button" data-reel-action="sound" class="p52-reel-sound" aria-label="Ativar som">${icon('mute')}<span>Som</span></button>
        </div>
        <div class="p52-reel-status" aria-live="polite">Carregando vídeo…</div>
      </div>
    </article>`;
  }
  function render(){
    if(!opened)return;
    const el=track();
    if(!items.length){el.innerHTML='<div class="p52-reels-empty"><span>'+icon('play')+'</span><h2>Seus Reels começam aqui.</h2><p>Os vídeos aprovados e a curadoria oficial dos festivais aparecerão aqui.</p><button type="button" data-reel-action="close">Voltar ao PULSO</button></div>';}
    else el.innerHTML=items.map(slide).join('');
    updateCounter();
  }
  function updateCounter(){$('p52ReelsCounter').textContent=items.length?`${active>=0?active+1:1} / ${items.length}`:'SEM VÍDEOS';}
  function updateSoundButton(slide,video){
    if(!slide||!video)return;
    const button=slide.querySelector('[data-reel-action="sound"]');
    if(!button)return;
    const silent=video.muted;
    button.hidden=false;
    button.setAttribute('aria-label',silent?'Ativar som do Reel':'Desativar som do Reel');
    button.setAttribute('aria-pressed',String(!silent));
    button.innerHTML=icon(silent?'mute':'volume')+'<span>'+(silent?'Ativar som':'Som ligado')+'</span>';
  }
  function startVideo(video,index,status,slide){
    // Unmuted playback is attempted only if user has not requested silence.
    // Safari/iOS may reject this outside a direct tap: fall back to silent autoplay.
    const attempt=video.play();
    if(!attempt || !attempt.then){updateSoundButton(slide,video);return;}
    attempt.then(()=>{
      if(lastMedia!==video||active!==index)return;
      updateSoundButton(slide,video);
      status.textContent=video.muted?'Toque em Ativar som para ouvir':'Toque no vídeo para pausar ou reproduzir';
    }).catch(()=>{
      if(lastMedia!==video||active!==index)return;
      if(!video.muted){
        video.muted=true;
        updateSoundButton(slide,video);
        status.textContent='O iPhone bloqueou o áudio automático. Toque em Ativar som.';
        video.play().catch(()=>{
          if(lastMedia===video)status.textContent='Toque no vídeo para reproduzir e ativar o som';
        });
      }else{
        status.textContent='Toque no vídeo para iniciar';
      }
    });
  }
  function activate(index){
    if(!opened||index<0||index>=items.length)return;
    if(index===active&&lastMedia)return;
    cleanup();active=index;updateCounter();
    const slide=track().querySelector(`[data-reel-index="${index}"]`);if(!slide)return;
    track().querySelectorAll('.p52-reel-slide').forEach((n,i)=>n.classList.toggle('is-current',i===index));
    const host=slide.querySelector('.p52-reel-media'),status=slide.querySelector('.p52-reel-status'),soundButton=slide.querySelector('[data-reel-action="sound"]');
    const s=source(items[index]);
    if(s.kind==='direct'){
      const video=document.createElement('video');video.className='p52-reel-video';video.src=s.url;video.preload='metadata';video.playsInline=true;video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');video.muted=!soundWanted;video.loop=false; // O reel acompanha o vídeo até o fim; não corta em 15 segundos.video.autoplay=false;video.poster=safeUrl(items[index].cover)||'';
      video.addEventListener('loadeddata',()=>{if(active===index&&lastMedia===video){updateSoundButton(slide,video);if(!video.muted)status.textContent='Toque no vídeo para pausar ou reproduzir';}},{once:true});
      video.addEventListener('error',()=>{if(active===index&&lastMedia===video)status.textContent='Vídeo sem reprodução compatível. Prefira MP4/H.264 com áudio AAC.';});
      video.addEventListener('volumechange',()=>{if(active===index&&lastMedia===video)updateSoundButton(slide,video);});
      video.addEventListener('click',()=>{
        // Explicit video taps are user gestures: let the user enable audio here too.
        if(video.muted&&soundWanted){
          video.muted=false;
          updateSoundButton(slide,video);
          video.play().then(()=>{status.textContent='Som ativado';}).catch(()=>{video.muted=true;updateSoundButton(slide,video);status.textContent='Toque no botão Ativar som para ouvir';});
          return;
        }
        if(video.paused)video.play().catch(()=>{status.textContent='Toque em reproduzir novamente';});
        else video.pause();
      });
      host.append(video);lastMedia=video;updateSoundButton(slide,video);
      startVideo(video,index,status,slide);
    }else if(s.kind==='youtube'){
      // YouTube videos start playing inline when selected. Audio begins muted in Safari/iOS.
      const frame=document.createElement('iframe');frame.title=`Reel do YouTube: ${items[index].title}`;frame.className='p52-reel-iframe';
      frame.allow='autoplay; encrypted-media; fullscreen; picture-in-picture';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';
      frame.src=s.url;host.append(frame);lastMedia=frame;youtubeMuted=true;
      updateYoutubeSound(slide);
      status.textContent='Iniciando vídeo do YouTube • toque em Ativar som';
      controlYoutube(frame,index,slide,status,youtubeEpoch);
    }else if(s.kind==='vimeo'){
      const frame=document.createElement('iframe');frame.title=`Reel: ${items[index].title}`;frame.className='p52-reel-iframe';frame.src=s.url;frame.allow='autoplay; fullscreen; encrypted-media; picture-in-picture';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';host.append(frame);lastMedia=frame;status.textContent='Toque em reproduzir no player para assistir com som';soundButton.hidden=true;
    }else{status.textContent='Vídeo hospedado externamente. Toque em “Assistir completo”.';soundButton.hidden=true;}
    const likeButton=slide.querySelector('[data-reel-action="like"]');
    if(likeButton)likeButton.setAttribute('aria-pressed',String(app()?.isLiked?.(items[index].id)||false));
  }
  function navigate(step){if(!items.length)return;const next=Math.max(0,Math.min(items.length-1,active+step));track().children[next]?.scrollIntoView({block:'start',behavior:'smooth'});activate(next);}
  function onScroll(){if(pendingScroll||!opened)return;pendingScroll=true;requestAnimationFrame(()=>{pendingScroll=false;const parent=track();const children=[...parent.querySelectorAll('.p52-reel-slide')];if(!children.length)return;const center=parent.getBoundingClientRect().top+parent.clientHeight/2;
    let index=active>=0?active:0,dist=Infinity;for(const el of children){const rect=el.getBoundingClientRect(),d=Math.abs(rect.top+rect.height/2-center);if(d<dist){dist=d;index=Number(el.dataset.reelIndex)}}if(index!==active)activate(index);
  });}
  async function click(ev){const b=ev.target.closest('[data-reel-action]');if(!b)return;const action=b.dataset.reelAction;if(action==='close'){close();return;}
    const root=b.closest('.p52-reel-slide'),post=items[Number(root?.dataset.reelIndex)];if(!post)return;
    if(action==='like'){await app()?.likeById?.(post.id);const current=app()?.posts?.().find(p=>p.id===post.id);if(current){post.likes_count=current.likes_count;b.querySelector('.p52-reel-like-number').textContent=String(Math.max(0,Number(current.likes_count)||0));}b.setAttribute('aria-pressed',String(Boolean(app()?.isLiked?.(post.id))));}
    if(action==='comments'){lastMedia?.pause?.();await window.PULSO_SOCIAL?.openCommentsForPost?.(post);}
    if(action==='share'){const link=new URL(location.href);link.searchParams.delete('track');link.searchParams.set('reel',post.id);link.hash='';try{if(navigator.share)await navigator.share({title:`${post.title} no PULSO`,url:link.href});else if(navigator.clipboard){await navigator.clipboard.writeText(link.href);app()?.toast?.('Link do Reel copiado!');}else prompt('Copie o link:',link.href);}catch(e){if(e.name!=='AbortError')app()?.toast?.('Não foi possível compartilhar agora.');}}
    if(action==='instagram'){
      const link=window.PULSO54?.djInstagram?.(post);
      if(link){window.open(link,'_blank','noopener,noreferrer');}
      else app()?.toast?.('Instagram oficial deste DJ não confirmado.');
    }
    if(action==='poster'){
      if(post.owner_id&&window.PULSO5?.openCreator){close();window.PULSO5.openCreator(post.owner_id);}
      else app()?.toast?.('Perfil de quem publicou ainda indisponível.');
    }
    if(action==='original'){
      if(post.curated){window.open(safeUrl(post.url),'_blank','noopener,noreferrer');close();}
      else {close();app()?.playById?.(post.id);}
    }
    if(action==='sound'&&lastMedia?.tagName==='IFRAME'&&source(post).kind==='youtube'){
      // Official YouTube API playback commands, sent only following a user gesture.
      const status=root.querySelector('.p52-reel-status');
      if(!youtubePlayer){if(status)status.textContent='Aguarde o vídeo carregar ou toque no player do YouTube.';return;}
      const shouldUnmute=youtubeMuted;
      try{
        if(shouldUnmute){youtubePlayer.unMute();youtubePlayer.setVolume?.(100);youtubePlayer.playVideo();}
        else youtubePlayer.mute();
        youtubeMuted=!shouldUnmute;
        soundWanted=shouldUnmute;
        updateYoutubeSound(root);
        if(status)status.textContent=shouldUnmute?'Som solicitado • se o iPhone bloquear, toque no próprio vídeo':'Som desativado';
      }catch(err){console.warn(err);if(status)status.textContent='Use o controle de som do player do YouTube.';}
      return;
    }
    if(action==='sound'&&lastMedia?.tagName==='VIDEO'){
      const video=lastMedia;
      const enabling=video.muted;
      soundWanted=enabling;
      video.muted=!enabling;
      video.volume=1;
      updateSoundButton(root,video);
      const status=root.querySelector('.p52-reel-status');
      if(status)status.textContent=enabling?'Som ativado':'Som desativado';
      if(video.paused)video.play().catch(()=>{
        if(status)status.textContent='Toque no vídeo para iniciar o som';
      });
    }
  }
  function refresh(){
    if(!opened){if(linkedReel&&!linkedDismissed&&getVideos().some(p=>String(p.id)===linkedReel))open(linkedReel);return;}
    const currentId=items[active]?.id,latest=getVideos(),byId=new Map(latest.map(p=>[String(p.id),p]));
    const next=items.map(p=>byId.get(String(p.id))).filter(Boolean);
    const known=new Set(next.map(p=>String(p.id)));
    for(const p of latest){if(!known.has(String(p.id))){next.push(p);known.add(String(p.id));}}
    items=next;cleanup();render();let i=items.findIndex(p=>String(p.id)===String(currentId));if(i<0)i=0;
    active=-1;if(items.length){track().scrollTop=track().children[i].offsetTop-track().offsetTop;activate(i)}
  }
  document.addEventListener('DOMContentLoaded',()=>{
    document.addEventListener('click',ev=>{const b=ev.target.closest('[data-open-reels]');if(b){ev.preventDefault();open();}});
    $('p52ReelsClose')?.addEventListener('click',close);
    dialog()?.addEventListener('close',onClose);
    track()?.addEventListener('scroll',onScroll,{passive:true});
    document.addEventListener('visibilitychange',()=>{if(!opened)return;if(document.hidden){youtubePlayer?.pauseVideo?.();lastMedia?.pause?.();}else if(youtubePlayer&&lastMedia?.tagName==='IFRAME'){try{youtubePlayer.playVideo();}catch{}}});
    track()?.addEventListener('click',ev=>{click(ev).catch(err=>{console.warn('Reels:',err);app()?.toast?.('Não foi possível concluir esta ação.');})});
    document.addEventListener('keydown',ev=>{if(!opened||ev.target.closest('input,textarea,select'))return;if(ev.key==='ArrowDown'){ev.preventDefault();navigate(1)}if(ev.key==='ArrowUp'){ev.preventDefault();navigate(-1)}});
    if(new URL(location.href).searchParams.get('reels')==='1')setTimeout(()=>open(),500);
    if(linkedReel && getVideos().some(p=>String(p.id)===linkedReel))setTimeout(()=>open(linkedReel),500);
  });
  window.PULSO_REELS={open,close,refresh};
})();
