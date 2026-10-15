/* PULSO — mobile menu controller, independent of app initialization */
(()=>{'use strict';
function setup(){
 const button=document.getElementById('menuToggle');
 const nav=document.getElementById('mobileNav');
 if(!button||!nav||button.dataset.pulsoMenuBound==='1')return;
 button.dataset.pulsoMenuBound='1';
 const close=()=>{nav.classList.remove('open');button.setAttribute('aria-expanded','false');button.setAttribute('aria-label','Abrir menu');document.body.classList.remove('pulso-menu-open');};
 const toggle=(event)=>{if(event){event.preventDefault();event.stopPropagation();}const open=button.getAttribute('aria-expanded')!=='true';nav.classList.toggle('open',open);button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',open?'Fechar menu':'Abrir menu');document.body.classList.toggle('pulso-menu-open',open);};
 button.addEventListener('click',toggle,true);
 nav.addEventListener('click',event=>{if(event.target.closest('a,button'))close();});
 window.addEventListener('hashchange',close);
 document.addEventListener('keydown',event=>{if(event.key==='Escape')close();});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
