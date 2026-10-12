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
   const link=document.createElement('a');
   link.href=url;
   link.target='_blank';
   link.rel='noopener noreferrer';
   link.click();
   status('Se o WhatsApp não abrir, use Copiar link e envie na conversa.');
 };
 const setupPanel=()=>{
   const trigger=byId('pulsoShareToggle');
   const panel=byId('pulsoSharePanel');
   const closeButton=byId('pulsoShareClose');
   const shareButton=byId('pulsoShareButton');
   if(!trigger||!panel||!closeButton||!shareButton)return;
   let opener=trigger;
   const close=(restoreFocus=false)=>{
     if(panel.hidden)return;
     panel.hidden=true;
     trigger.setAttribute('aria-expanded','false');
     if(restoreFocus)opener?.focus({preventScroll:true});
   };
   const open=(button)=>{
     opener=button||trigger;
     // Popovers should not compete for screen space on iPhone.
     const help=byId('p51HelpDialog'),helpButton=byId('p51HelpToggle');
     if(help&&!help.hidden){help.hidden=true;helpButton?.setAttribute('aria-expanded','false');}
     panel.hidden=false;
     trigger.setAttribute('aria-expanded','true');
     status('');
     closeButton.focus({preventScroll:true});
   };
   trigger.addEventListener('click',()=>panel.hidden?open(trigger):close(true));
   closeButton.addEventListener('click',()=>close(true));
   shareButton.addEventListener('click',share);
   byId('pulsoShareWhatsapp')?.addEventListener('click',whatsapp);
   byId('pulsoShareCopy')?.addEventListener('click',copyLink);
   byId('pulsoShareMenu')?.addEventListener('click',()=>{
     byId('mobileNav')?.classList.remove('open');
     open(trigger);
   });
   document.addEventListener('keydown',event=>{
     if(event.key==='Escape'&&!panel.hidden){event.preventDefault();close(true);}
   });
   document.addEventListener('click',event=>{
     if(panel.hidden)return;
     if(event.target.closest('#p51HelpToggle')){close(false);return;}
     if(!panel.contains(event.target)&&!trigger.contains(event.target)&&!event.target.closest('#pulsoShareMenu'))close(false);
   });
 };
 document.addEventListener('DOMContentLoaded',setupPanel);
})();
