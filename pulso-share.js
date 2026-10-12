/* PULSO RADIO 5.11 — convite para amigos; compartilhamento nativo, WhatsApp e navegador. */
(()=>{
 'use strict';
 const CANONICAL='https://pulso-radio-site.pages.dev/';
 const MESSAGE='🎧 Conheça o PULSO RADIO × LØSI! DJ sets, Reels, Warung, Green Valley, Tomorrowland, Burning Man e muito mais. Você pode ouvir direto pelo navegador, sem instalar nada. Se preferir, adicione o PULSO à tela inicial do iPhone ou Android. É gratuito!';
 const byId=id=>document.getElementById(id);
 const status=(message,error=false)=>{
   const el=byId('pulsoShareStatus');if(!el)return;
   el.textContent=message;el.classList.toggle('is-error',Boolean(error));
 };
 const text=()=>MESSAGE+'\n\n'+CANONICAL;
 const copyLink=async()=>{
   try{
     if(!navigator.clipboard?.writeText)throw Error('clipboard indisponível');
     await navigator.clipboard.writeText(CANONICAL);
     status('Link copiado! Envie para seus amigos.');
   }catch(err){
     // Fallback legível para navegadores sem permissão de clipboard.
     const value=byId('pulsoShareLink');
     if(value){value.hidden=false;value.value=CANONICAL;value.focus();value.select();status('Selecione e copie o link acima para enviar aos amigos.');}
     else status('Copie este endereço: '+CANONICAL,true);
   }
 };
 const share=async()=>{
   if(typeof navigator.share==='function'){
     try{
       await navigator.share({title:'PULSO RADIO × LØSI',text:MESSAGE,url:CANONICAL});
       status('PULSO pronto para chegar a mais gente!');
     }catch(err){
       if(err?.name!=='AbortError')await copyLink();
     }
   }else{
     await copyLink();
   }
 };
 const whatsapp=()=>{
   const url='https://wa.me/?text='+encodeURIComponent(text());
   const popup=window.open(url,'_blank','noopener,noreferrer');
   if(!popup){status('Se o WhatsApp não abrir, use Copiar link e envie na conversa.');}
 };
 document.addEventListener('DOMContentLoaded',()=>{
   const shareButton=byId('pulsoShareButton');
   if(!shareButton)return;
   shareButton.addEventListener('click',share);
   byId('pulsoShareWhatsapp')?.addEventListener('click',whatsapp);
   byId('pulsoShareCopy')?.addEventListener('click',copyLink);
   byId('pulsoShareHero')?.addEventListener('click',()=>{
     const section=byId('pulsoSharePanel');
     section?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});
     section?.querySelector('#pulsoShareButton')?.focus({preventScroll:true});
   });
   byId('pulsoShareMenu')?.addEventListener('click',()=>{
     byId('mobileNav')?.classList.remove('open');
     byId('pulsoSharePanel')?.scrollIntoView({behavior:'smooth',block:'center'});
   });
 });
})();