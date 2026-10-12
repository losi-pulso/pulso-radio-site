/* PULSO iOS: controles de tela bloqueada para arquivos de áudio próprios.
   A API Media Session não garante continuidade em todas as versões do iOS. */
(()=>{'use strict';
 let current=null, watchers=[];
 const session=()=>('mediaSession' in navigator?navigator.mediaSession:null);
 function clear(){
   watchers.forEach(([a,event,fn])=>a.removeEventListener(event,fn));watchers=[];current=null;
   const s=session();if(!s)return;
   ['play','pause','stop','previoustrack','nexttrack','seekbackward','seekforward','seekto'].forEach(action=>{
     try{s.setActionHandler(action,null);}catch{}
   });
   try{s.metadata=null;s.playbackState='none';}catch{}
 }
 function bind(audio,info={}){
   if(!(audio instanceof HTMLMediaElement))return;
   clear();current=audio;
   const s=session();if(!s)return;
   const cover=typeof info.cover==='string'&&/^https:\/\//.test(info.cover)?info.cover:'';
   try{s.metadata=new MediaMetadata({title:info.title||'PULSO RADIO',artist:info.artist||'LØSI',album:'PULSO RADIO × LØSI',artwork:cover?[{src:cover,sizes:'512x512'}]:[{src:new URL('icons/icon-512.png',location.href).href,sizes:'512x512',type:'image/png'}]});}catch(e){console.warn('Media Session:',e);}
   const handlers={
     play:()=>audio.play().catch(()=>{}),pause:()=>audio.pause(),
     stop:()=>{audio.pause();try{audio.currentTime=0;}catch{}},
     seekbackward:ev=>{audio.currentTime=Math.max(0,audio.currentTime-(ev?.seekOffset||15));},
     seekforward:ev=>{if(Number.isFinite(audio.duration))audio.currentTime=Math.min(audio.duration,audio.currentTime+(ev?.seekOffset||15));},
     seekto:ev=>{if(Number.isFinite(ev.seekTime)&&Number.isFinite(audio.duration))audio.currentTime=Math.min(audio.duration,Math.max(0,ev.seekTime));}
   };
   if(typeof info.previous==='function')handlers.previoustrack=info.previous;
   if(typeof info.next==='function')handlers.nexttrack=info.next;
   Object.entries(handlers).forEach(([k,fn])=>{try{s.setActionHandler(k,fn);}catch{}});
   let last=-1;
   function update(){
      if(current!==audio)return;
      try{s.playbackState=audio.paused?'paused':'playing';}catch{}
      const d=audio.duration, t=audio.currentTime;
      if(Number.isFinite(d)&&d>0&&Number.isFinite(t)&&Math.floor(t)!==last){
        last=Math.floor(t);
        try{s.setPositionState({duration:d,position:Math.min(Math.max(0,t),d),playbackRate:audio.playbackRate||1});}catch{}
      }
   }
   for(const evt of ['playing','pause','loadedmetadata','durationchange','timeupdate','seeked','ratechange']){
     audio.addEventListener(evt,update);watchers.push([audio,evt,update]);
   }
   update();
 }
 window.PULSO_BACKGROUND={bind,clear};
})();
