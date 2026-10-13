/* PULSO RADIO × LØSI — ações de mídia: tela cheia e acesso ao download offline. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
let currentPostId=null, observer=null;
const selectors=['#cardsGrid .track-card[data-id]','#p5LibContent .p5-list-row[data-id]','#p5PanelHome .p5-tile[data-p5-id]'];
function cardFor(id){for(const sel of selectors){const found=[...document.querySelectorAll(sel)].find(el=>(el.dataset.id||el.dataset.p5Id)===id);if(found)return found;}return null;}
function enterFullscreen(video){
  try{
    if(typeof video.webkitEnterFullscreen==='function'){video.webkitEnterFullscreen();return;}
    const fn=video.requestFullscreen||video.webkitRequestFullscreen;
    if(fn){const result=fn.call(video);if(result&&typeof result.catch==='function')result.catch(()=>{});return;}
    video.controls=true;
  }catch(_){video.controls=true;}
}
function addActions(){
 const dialog=$('playerDialog');if(!dialog)return;
 const video=dialog.querySelector('video');if(!video)return;
 let bar=dialog.querySelector('.pulso-media-actions');
 if(!bar){bar=document.createElement('div');bar.className='pulso-media-actions';bar.setAttribute('aria-label','Ações do vídeo');video.insertAdjacentElement('afterend',bar);}
 if(!bar.querySelector('[data-pulso-fullscreen]')){
  const full=document.createElement('button');full.type='button';full.dataset.pulsoFullscreen='1';full.textContent='⛶ Tela cheia';full.addEventListener('click',()=>enterFullscreen(video));bar.appendChild(full);
 }
 if(!bar.querySelector('[data-pulso-dialog-download]')&&currentPostId){
  const card=cardFor(currentPostId),existing=card?.querySelector('[data-pulso-download]');
  if(existing){const dl=document.createElement('button');dl.type='button';dl.dataset.pulsoDialogDownload='1';dl.textContent='↓ Baixar offline';dl.addEventListener('click',()=>{const live=cardFor(currentPostId)?.querySelector('[data-pulso-download]');if(live)live.click();else{dl.disabled=true;dl.textContent='Disponível no cartão da publicação';setTimeout(()=>{dl.disabled=false;dl.textContent='↓ Baixar offline'},2500)}});bar.appendChild(dl);}
 }
}
function init(){
 const dialog=$('playerDialog');if(!dialog)return;
 dialog.addEventListener('close',()=>{currentPostId=null;});
 if(observer)observer.disconnect();
 observer=new MutationObserver(addActions);observer.observe(dialog,{childList:true,subtree:true});
 dialog.addEventListener('click',ev=>{if(ev.target.closest('[data-pulso-fullscreen]'))return;});
}
document.addEventListener('click',ev=>{
 const play=ev.target.closest('#cardsGrid .track-card[data-id],#p5LibContent .p5-list-row[data-id],#p5PanelHome .p5-tile[data-p5-id]');
 if(play){currentPostId=play.dataset.id||play.dataset.p5Id;setTimeout(addActions,0);setTimeout(addActions,120);}
},true);
function styles(){
 if($('pulsoMediaActionsStyle'))return;
 const style=document.createElement('style');style.id='pulsoMediaActionsStyle';style.textContent=`.pulso-media-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin:10px 0 14px}.pulso-media-actions button{border:1px solid #46513a;background:#151a12;color:#d2fb63;border-radius:5px;padding:10px 14px;font-size:12px;font-weight:800;cursor:pointer}.pulso-media-actions button:focus-visible{outline:2px solid #d2fb63;outline-offset:3px}@media(max-width:600px){.pulso-media-actions button{flex:1;min-height:42px}}`;
 document.head.appendChild(style);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{styles();init()},{once:true});else{styles();init();}
})();
