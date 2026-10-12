/* PULSO VIDEO 5.13 — player persistente dos sets; independente do feed Reels. */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const iframeTitle='PULSO PLAYER · YouTube';
  const playerUrl='https://www.youtube-nocookie.com/embed/';
  let currentId='',currentVideoId='',expanded=true;
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
  const embedUrl=id=>{
    const options=new URLSearchParams({
      autoplay:'1',playsinline:'1',controls:'1',rel:'0',modestbranding:'1',enablejsapi:'1',origin:location.origin
    });
    return playerUrl+id+'?'+options.toString();
  };
  const dispatchYoutube=command=>{
    const frame=$('pulsoVideoIframe');
    if(!frame?.src||!currentVideoId)return;
    try{
      frame.contentWindow?.postMessage(JSON.stringify({event:'command',func:command,args:[]}), 'https://www.youtube-nocookie.com');
    }catch(err){console.info('Player PULSO:',err);}
  };
  function pause(){dispatchYoutube('pauseVideo');}
  function close(){
    const dock=$('pulsoVideoDock'),frame=$('pulsoVideoIframe');
    if(!dock||!frame)return;
    pause();
    frame.removeAttribute('src');
    dock.hidden=true;
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
    currentId=String(set.id);currentVideoId=id;
    $('pulsoVideoName').textContent=set.title||set.artist||'DJ SET';
    $('pulsoVideoArtist').textContent=[set.artist,set.event,set.year].filter(Boolean).join(' · ');
    $('pulsoVideoExternal').href=set.url;
    dock.hidden=false;
    document.body.classList.add('pulso-video-active');
    setExpanded(true);
    // Preserve timestamp and current playback if they select the same item again.
    if(!isSame){
      frame.title=iframeTitle+' — '+(set.title||'DJ set');
      frame.src=embedUrl(id);
    }else dispatchYoutube('playVideo');
    return true;
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const closeButton=$('pulsoVideoClose'),sizeButton=$('pulsoVideoSize');
    if(!closeButton||!sizeButton)return;
    closeButton.addEventListener('click',close);
    sizeButton.addEventListener('click',()=>setExpanded(!expanded));
    $('pulsoVideoPlay')?.addEventListener('click',()=>dispatchYoutube('playVideo'));
    $('pulsoVideoPause')?.addEventListener('click',pause);
    // Avoid taking over keyboard focus or page scrolling when opening a video.
    // Media remains mounted and visible when navigating sections within the SPA.
  });
  window.PULSO_VIDEO={open,close,pause,isOpen:()=>!!currentId&&!$('pulsoVideoDock')?.hidden};
})();