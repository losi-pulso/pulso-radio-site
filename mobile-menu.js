/* PULSO — isolated mobile navigation controller; loaded independently from app initialization. */
(()=>{'use strict';
function setup(){
 const button=document.getElementById('menuToggle');
 const nav=document.getElementById('mobileNav');
 if(!button||!nav)return;
 const close=()=>{nav.classList.remove('open');button.setAttribute('aria-expanded','false');button.setAttribute('aria-label','Abrir menu');document.body.classList.remove('pulso-menu-open');};
 const toggle=(event)=>{event?.preventDefault();event?.stopPropagation();const open=!nav.classList.contains('open');nav.classList.toggle('open',open);button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',open?'Fechar menu':'Abrir menu');document.body.classList.toggle('pulso-menu-open',open);};
 button.addEventListener('click',toggle);
 nav.addEventListener('click',event=>{if(event.target.closest('a,button'))close();});
 window.addEventListener('hashchange',close);
 document.addEventListener('keydown',event=>{if(event.key==='Escape')close();});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();