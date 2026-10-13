/* PULSO VIDEO 5.13 — player persistente dos sets; independente do feed Reels. */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const iframeTitle='PULSO PLAYER · YouTube';
  const playerUrl='https://www.youtube-nocookie.com/embed/';
  let currentId='',currentVideoId='',expanded=true;
  let ytPlayer=null,ytInitStarted=false,ytApiPromise=null,activeSet=null;
  let pendingRestore=null,restoredPaused=false,restoreAttempted=false;
  const playbackKey=()=>{const id=window.PULSO_APP?.user?.()?.id;return 'pulso-playback-video-v1'+(id?'-'+String(id).replace(/[^a-z0-9_-]/gi,''):'-local');};
  function savePlayback(){
    if(!currentVideoId||!activeSet)return;
    let time=0;try{time=Number(ytPlayer?.getCurrentTime?.())||0;}catch{}
    const state={videoId:currentVideoId,setId:currentId,time:Math.max(0,time),set:{id:activeSet.id,url:activeSet.url,title:activeSet.title||'',artist:activeSet.artist||'',event:activeSet.event||'',year:activeSet.year||'',cover:activeSet.cover||''},savedAt:Date.now()};
    try{localStorage.setItem(playbackKey(),JSON.stringify(state));}catch{}
  }
  function restoreSavedPlayback(){
    if(restoreAttempted)return;
    let state=null;try{state=JSON.parse(localStorage.getItem(playbackKey())||'null');}catch{}
    if(!state?.set?.url||!videoIdFromUrl(state.set.url)||!Number.isFinite(Number(state.time)))return;
    restoreAttempted=true;pendingRestore=state;restoredPaused=true;open(state.set);setExpanded(false);
  }
  function restorePlayerPosition(player,id){
    if(!pendingRestore||pendingRestore.videoId!==id)return false;
    const point=Math.max(0,Number(pendingRestore.time)||0);
    try{player.mute?.();if(point>0)player.seekTo?.(point,true);player.pauseVideo?.();pendingRestore=null;restoredPaused=true;return true;}catch{return false;}
  }
  const icon=(kind)=>{
    const d={
      shrink:'<path d="M8 3v5H3M16 21v-5h5"/><path d="m3 8 6-6M21 16l-6 6"/>',
      expand:'<path d="M8 3H3v5M16 21h5v-5"/><path d="M3 3l6 6m12 12-6-6"/>',
      close:'<path d="M5 5l14 14M19 5 5 19"/>'
    };
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+(d[kind]||d.close)+'</svg>';
  };
  const videoIdFromUrl=url=>{
    try{
      const u=new URL(url);
      if(u.protocol!=='https:')return '';
      const host=u.hostname.replace(/^www\./,'').toLowerCase();
      let id='';
      if(host==='youtu.be')id=u.pathname.split('/')[1]||'';
      else if(['youtube.com','m.youtube.com','music.youtube.com','youtube-nocookie.com'].includes(host)){
        if(u.pathname==='/watch')id=u.searchParams.get('v')||'';
        else if(/^\/(embed|shorts|live)\//.test(u.pathname))id=u.pathname.split('/')[2]||'';
      }
      return /^[a-zA-Z0-9_-]{11}$/.test(id)?id:'';
    }catch{return '';}
  };
  const embedUrl=(id,autoplay=true)=>{
    const options=new URLSearchParams({
      autoplay:autoplay?'1':'0',mute:'1',playsinline:'1',controls:'1',rel:'0',enablejsapi:'1',origin:location.origin
    });
    return playerUrl+id+'?'+options.toString();
  };

  function youtubeApi(){
    if(window.YT?.Player)return Promise.resolve(window.YT);
    if(ytApiPromise)return ytApiPromise;
    ytApiPromise=new Promise((resolve,reject)=>{
      const previous=window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady=()=>{try{if(typeof previous==='function')previous();}finally{resolve(window.YT);}};
      if(!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')){
        const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.async=true;
        script.onerror=()=>{ytApiPromise=null;reject(new Error('API do YouTube indisponível'));};
        document.head.append(script);
      }
    });
    return ytApiPromise;
  }
  async function attachController(){
    if(ytPlayer||ytInitStarted)return;
    ytInitStarted=true;
    try{
      const api=await youtubeApi();
      const frame=$('pulsoVideoIframe');
      if(!frame||!currentVideoId||$('pulsoVideoDock')?.hidden){ytInitStarted=false;return;}
      const player=new api.Player(frame,{
        events:{
          onReady:evt=>{
            if(!$('pulsoVideoDock')?.hidden&&currentVideoId){
              ytPlayer=evt.target;
              window.PULSO_CAPSULE?.observeYouTube?.(ytPlayer,activeSet);
              try{
                const data=ytPlayer.getVideoData?.();
                if(data?.video_id&&data.video_id!==currentVideoId)ytPlayer.loadVideoById(currentVideoId);
                if(!restorePlayerPosition(ytPlayer,currentVideoId)){ytPlayer.mute();ytPlayer.playVideo();}
              }catch(error){console.info('YouTube player:',error);}
            }
          },
          onStateChange:evt=>{if(evt.data===1||evt.data===2)savePlayback();window.PULSO_CAPSULE?.onYouTubeState?.(evt.data);},
          onError:()=>window.PULSO_CAPSULE?.onYouTubeState?.(-1)
        }
      });
      ytPlayer=player;
    }catch(error){
      ytInitStarted=false;
      console.warn('O vídeo pode tocar sem estatísticas do YouTube:',error);
    }
  }
  const dispatchYoutube=command=>{
    const frame=$('pulsoVideoIframe');
    if(!frame?.src||!currentVideoId)return;
    try{
      if(ytPlayer&&typeof ytPlayer[command]==='function'){ytPlayer[command]();return;}
      frame.contentWindow?.postMessage(JSON.stringify({event:'command',func:command,args:[]}), 'https://www.youtube-nocookie.com');
    }catch(err){console.info('Player PULSO:',err);}
  };
  function pause(){dispatchYoutube('pauseVideo');savePlayback();}
  function playWithSound(){
    // Um toque explícito permite pedir áudio mesmo quando o navegador bloqueia autoplay com som.
    restoredPaused=false;
    dispatchYoutube('unMute');
    dispatchYoutube('playVideo');
  }
  function close(){
    const dock=$('pulsoVideoDock'),frame=$('pulsoVideoIframe');
    if(!dock||!frame)return;
    savePlayback();
    pause();
    if(ytPlayer){try{ytPlayer.stopVideo?.();}catch{}}
    else frame.removeAttribute('src');
    window.PULSO_CAPSULE?.detachYouTube?.();
    dock.hidden=true;
    activeSet=null;
    currentId='';currentVideoId='';
    document.body.classList.remove('pulso-video-active');
  }
  function setExpanded(value){
    const dock=$('pulsoVideoDock'),button=$('pulsoVideoSize');
    if(!dock||!button)return;
    expanded=!!value;
    dock.classList.toggle('is-mini',!expanded);
    button.innerHTML=icon(expanded?'shrink':'expand');
    button.setAttribute('aria-label',expanded?'Minimizar player de vídeo':'Ampliar player de vídeo');
    button.title=expanded?'Minimizar (continua tocando)':'Ampliar player';
    button.setAttribute('aria-pressed',String(!expanded));
  }
  function open(input){
    const set=typeof input==='string'?(window.PULSO54?.sets||[]).find(s=>String(s.id)===input):input;
    if(!set||!set.url)return false;
    const id=videoIdFromUrl(set.url);
    if(!id)return false;
    const dock=$('pulsoVideoDock'),frame=$('pulsoVideoIframe');
    if(!dock||!frame)return false;
    // Keep only one PULSO audio experience when switching into the video.
    try{window.PULSO_APP?.pauseForReels?.();}catch{}
    try{window.PULSO_REELS?.close?.();}catch{}
    const isSame=currentId===String(set.id)&&currentVideoId===id&&!dock.hidden;
    const restoring=!!pendingRestore&&pendingRestore.videoId===id;
    if(!restoring)restoredPaused=false;
    currentId=String(set.id);currentVideoId=id;activeSet=set;
    $('pulsoVideoName').textContent=set.title||set.artist||'DJ SET';
    $('pulsoVideoArtist').textContent=[set.artist,set.event,set.year].filter(Boolean).join(' · ');
    $('pulsoVideoExternal').href=set.url;
    dock.hidden=false;
    document.body.classList.add('pulso-video-active');
    setExpanded(true);
    // Preserve timestamp and current playback if they select the same item again.
    if(!isSame){
      frame.title=iframeTitle+' — '+(set.title||'DJ set');
      if(ytPlayer){
        window.PULSO_CAPSULE?.observeYouTube?.(ytPlayer,set);
        try{ytPlayer.mute?.();ytPlayer.loadVideoById?.(id);}catch{frame.src=embedUrl(id);}
      }else{
        frame.src=embedUrl(id,!restoring);
        attachController();
      }
    }else dispatchYoutube('playVideo');
    return true;
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const closeButton=$('pulsoVideoClose'),sizeButton=$('pulsoVideoSize');
    if(!closeButton||!sizeButton)return;
    closeButton.addEventListener('click',close);
    sizeButton.addEventListener('click',()=>setExpanded(!expanded));
    // A URL já pede autoplay sem som; reforça o play assim que o iframe carrega.
    $('pulsoVideoIframe')?.addEventListener('load',()=>{
      if(currentVideoId&&!$('pulsoVideoDock')?.hidden){
        dispatchYoutube('mute');
        if(!restoredPaused)dispatchYoutube('playVideo');
      }
    });
    $('pulsoVideoPlay')?.addEventListener('click',playWithSound);
    $('pulsoVideoPause')?.addEventListener('click',pause);
    window.setInterval(savePlayback,2500);
    window.addEventListener('pagehide',savePlayback);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')savePlayback();});
    let restoreChecks=0;
    const restoreTimer=window.setInterval(()=>{restoreChecks++;if(window.PULSO_APP?.user?.()||restoreChecks>=12){window.clearInterval(restoreTimer);restoreSavedPlayback();}},250);
    // Media remains mounted and visible when navigating sections within the SPA.
  });
  window.PULSO_VIDEO={open,close,pause,isOpen:()=>!!currentId&&!$('pulsoVideoDock')?.hidden};
})();