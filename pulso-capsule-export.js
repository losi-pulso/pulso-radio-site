/* PULSO 5.16 | Story 9:16 e quadrado 1:1, sem dados inventados. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const URL_API=window.URL||window.webkitURL;
 let previewUrl=null,previewFile=null;
 let isBusy=false;
 const getData=()=>window.PULSO_CAPSULE?.getSnapshot?.();
 const num=v=>new Intl.NumberFormat('pt-BR').format(Math.max(0,Math.floor(Number(v)||0)));
 const time=v=>{const n=Math.max(0,Number(v)||0);return n>=3600?Math.floor(n/3600)+'h '+Math.floor(n%3600/60)+'min':Math.floor(n/60)+'min';};
 const style=(ctx,font,color)=>{ctx.font=font;ctx.fillStyle=color;ctx.textBaseline='alphabetic';};
 function t(ctx,str,x,y,font,color,maxWidth){
   style(ctx,font,color);let text=String(str||'');
   if(maxWidth){
     while(text.length>2&&ctx.measureText(text).width>maxWidth)text=text.slice(0,-2)+'…';
   }
   ctx.fillText(text,x,y);
 }
 function rect(ctx,x,y,w,h,r,color){
   ctx.fillStyle=color;ctx.beginPath();ctx.roundRect?ctx.roundRect(x,y,w,h,r):ctx.rect(x,y,w,h);ctx.fill();
 }
 function background(ctx,kind){
   const w=1080,h=kind==='story'?1920:1080;
   const grad=ctx.createLinearGradient(0,0,w,h);
   grad.addColorStop(0,'#19342c');grad.addColorStop(.42,'#0d1917');grad.addColorStop(1,'#09120f');
   ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
   const flare=ctx.createRadialGradient(900,200,0,900,200,520);
   flare.addColorStop(0,'rgba(149,255,158,0.17)');flare.addColorStop(1,'rgba(149,255,158,0)');
   ctx.fillStyle=flare;ctx.fillRect(0,0,w,720);
   ctx.strokeStyle='rgba(197,255,124,.25)';ctx.lineWidth=3;
   [155,211,271].forEach(r=>{ctx.beginPath();ctx.arc(885,215,r,0,Math.PI*2);ctx.stroke()});
   ctx.strokeStyle='rgba(216,255,169,.35)';ctx.lineWidth=2;
   for(let a=0;a<24;a++){const theta=a*Math.PI/12;
     const x=885+236*Math.cos(theta),y=215+236*Math.sin(theta);
     ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+10*Math.cos(theta),y+10*Math.sin(theta));ctx.stroke();
   }
   ctx.fillStyle='rgba(198,255,128,.08)';ctx.beginPath();ctx.arc(885,215,145,0,Math.PI*2);ctx.fill();
   ctx.fillStyle='#c6ff7c';ctx.beginPath();ctx.arc(885,215,26,0,Math.PI*2);ctx.fill();
 }
 function header(ctx,snapshot,kind){
   const isStory=kind==='story';
   rect(ctx,73,83,9,54,4,'#c7ff7d');
   t(ctx,'PULSO  /  RADIO × LØSI',104,119,'800 31px Arial,sans-serif','#d0ff98');
   t(ctx,snapshot.period==='month'?'MÊS  /  '+snapshot.label.toUpperCase():'SEMANA  /  '+snapshot.label.toUpperCase(),76,176,'700 21px Arial,sans-serif','#a6cbb1',710);
   t(ctx,'MINHA CÁPSULA',74,isStory?435:330,'900 79px Arial,sans-serif','#ffffff',920);
   t(ctx,'SONORA.',74,isStory?522:415,'900 86px Arial,sans-serif','#a9fcad');
   const labelY=isStory?610:490;
   t(ctx,'TEMPO REPRODUZIDO COM SOM',77,labelY,'800 26px Arial,sans-serif','#b9e1ba');
   const value= num((snapshot.total||0)/60);
   t(ctx,value+' MINUTOS',74,isStory?698:573,'900 73px Arial,sans-serif','#80ebae',935);
   t(ctx,'PESSOAL • '+(snapshot.period==='month'?'MENSAL':'SEMANAL')+' • '+num(snapshot.setsCount??snapshot.sets.length)+' SETS',77,isStory?747:616,'700 21px Arial,sans-serif','#bcd5bb',900);
 }
 function rows(ctx,items,x,y,maxWidth,kind,limit=5){
   const rowH=kind==='story'?79:72;
   if(!items.length){t(ctx,'Comece a ouvir para gerar seu ranking.',x,y+32,'500 22px Arial,sans-serif','#91a995',maxWidth);return;}
   items.slice(0,limit).forEach((item,i)=>{
     const rowY=y+i*rowH, label=item.name||item.title||'';
     t(ctx,String(i+1).padStart(2,'0'),x,rowY,'900 27px Arial,sans-serif','#b7ffa5');
     t(ctx,label,x+57,rowY,'700 25px Arial,sans-serif','#f6fff1',maxWidth-58);
     const sub=item.seconds!==undefined?time(item.seconds):
       (item.artist||'')+' · '+(Number(item.count)||0)+'×';
     t(ctx,sub,x+57,rowY+28,'500 19px Arial,sans-serif','#9bb59c',maxWidth-58);
   });
 }
 function exportCanvas(snapshot,kind){
   const canvas=document.createElement('canvas');
   const story=kind==='story';
   canvas.width=1080;canvas.height=story?1920:1080;
   const ctx=canvas.getContext('2d',{alpha:false});
   if(!ctx)throw new Error('Seu navegador não liberou a criação da imagem.');
   background(ctx,kind);header(ctx,snapshot,kind);
   if(story){
     rect(ctx,60,790,960,925,24,'rgba(19,37,28,.82)');
     t(ctx,'ARTISTAS MAIS OUVIDOS',84,865,'900 29px Arial,sans-serif','#c7ff97');
     t(ctx,'MÚSICAS REGISTRADAS',553,865,'900 26px Arial,sans-serif','#c7ff97');
     ctx.strokeStyle='rgba(170,233,171,.18)';ctx.lineWidth=2;
     ctx.beginPath();ctx.moveTo(537,827);ctx.lineTo(537,1262);ctx.stroke();
     rows(ctx,snapshot.artists,88,940,425,kind,5);
     rows(ctx,snapshot.tracks,556,940,405,kind,5);
     ctx.beginPath();ctx.moveTo(85,1350);ctx.lineTo(992,1350);ctx.stroke();
     t(ctx,'SEUS SETS MAIS OUVIDOS',87,1411,'900 30px Arial,sans-serif','#c7ff97');
     rows(ctx,snapshot.sets,89,1478,865,kind,3);
     t(ctx,'Dados estimados de reprodução neste navegador',81,1825,'500 22px Arial,sans-serif','#9fbaa3');
     t(ctx,'sunny-paletas-ca93b2.netlify.app',81,1870,'700 25px Arial,sans-serif','#c7ff97');
   }else{
     rect(ctx,57,674,966,335,22,'rgba(19,37,28,.8)');
     t(ctx,'DJS FAVORITOS',79,723,'900 29px Arial,sans-serif','#c7ff97');
     t(ctx,'FAIXAS REGISTRADAS',544,723,'900 28px Arial,sans-serif','#c7ff97');
     rows(ctx,snapshot.artists,81,774,437,kind,3);
     rows(ctx,snapshot.tracks,547,774,425,kind,3);
     t(ctx,'sunny-paletas-ca93b2.netlify.app',74,1046,'700 23px Arial,sans-serif','#c7ff97');
   }
   return canvas;
 }
 function dataURLtoBlob(dataURI){
   const parts=dataURI.split(','),raw=atob(parts[1]),array=new Uint8Array(raw.length);
   for(let i=0;i<raw.length;i++)array[i]=raw.charCodeAt(i);
   return new Blob([array],{type:'image/png'});
 }
 function generate(kind){
   const snapshot=getData();
   if(!snapshot)throw new Error('Abra a Cápsula Sonora e tente novamente.');
   const canvas=exportCanvas(snapshot,kind);
   const blob=dataURLtoBlob(canvas.toDataURL('image/png'));
   const fileName='pulso-capsula-'+(kind==='story'?'story-9x16':'quadrada-1x1')+'-'+snapshot.period+'.png';
   return new File([blob],fileName,{type:'image/png',lastModified:Date.now()});
 }
 const canNativeShare=file=>{
   if(typeof navigator.share!=='function')return false;
   try{return typeof navigator.canShare==='function'&&navigator.canShare({files:[file]});}catch{return false}
 };
 const setStatus=msg=>{
   const el=$('pulsoCapsuleExportStatus');if(el)el.textContent=msg;
 };
 const resetPreview=()=>{
   if(previewUrl&&URL_API?.revokeObjectURL)URL_API.revokeObjectURL(previewUrl);
   previewUrl=null;previewFile=null;
 };
 function preview(file,why){
   if(!URL_API?.createObjectURL)throw new Error('Seu navegador não oferece pré-visualização de arquivos.');
   resetPreview();previewFile=file;previewUrl=URL_API.createObjectURL(file);
   const image=$('pulsoCapsulePreviewImage'),save=$('pulsoCapsulePreviewSave'),dialog=$('pulsoCapsulePreview');
   if(!image||!save||!dialog)throw new Error('A janela de pré-visualização não está disponível.');
   image.src=previewUrl;image.alt='Prévia da sua Cápsula Sonora PULSO, pronta para salvar e postar';
   save.href=previewUrl;save.download=file.name;save.textContent='BAIXAR IMAGEM PNG';
   $('pulsoCapsulePreviewHelp').textContent=why||'No iPhone, toque e segure a imagem e escolha Salvar em Fotos. Depois abra o Instagram Stories e selecione a imagem.';
   if(!dialog.open)dialog.showModal();
 }
 const download=file=>{
   if(!URL_API?.createObjectURL)throw new Error('Seu navegador não permite baixar esta imagem.');
   const obj=URL_API.createObjectURL(file);
   const link=document.createElement('a');link.href=obj;link.download=file.name;
   document.body.appendChild(link);link.click();link.remove();
   setTimeout(()=>URL_API.revokeObjectURL(obj),60000);
 };
 const isAppleMobile=()=>{
   const ua=navigator.userAgent||'';
   return /iPhone|iPad|iPod/i.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1);
 };
 function onExport(kind,mode){
   if(isBusy)return;
   isBusy=true;
   let file;
   try{
     // Gerar PNG de modo síncrono mantém a ativação do toque para o Web Share do Safari.
     file=generate(kind);
     if(mode==='story'&&canNativeShare(file)){
       setStatus('Escolha Instagram e, quando disponível, Stories no compartilhamento do celular.');
       try{
         const result=navigator.share({files:[file],title:'Minha Cápsula Sonora PULSO'});
         Promise.resolve(result).then(()=>setStatus('Imagem entregue ao compartilhamento do celular.')).catch(e=>{
           if(e?.name!=='AbortError'){setStatus('O compartilhamento foi bloqueado. Abra a prévia para salvar.');preview(file);}
         }).finally(()=>{isBusy=false});
         return;
       }catch(e){if(e?.name!=='AbortError'){preview(file)};return}
     }
     if(mode==='story'){
       // Em um navegador comum não há API oficial para injetar um PNG direto no Stories.
       preview(file,'Compartilhar direto no Stories não é suportado neste navegador. Salve a imagem e abra Instagram → Seu Story. No iPhone, toque e segure a prévia.');
       setStatus('Story 9:16 gerado. Salve ou compartilhe a imagem pela prévia.');
     }else if(isAppleMobile()){
       // No Safari/iOS, o share nativo é mais confiável que <a download> para imagens.
       if(canNativeShare(file)){
         const result=navigator.share({files:[file],title:kind==='story'?'Story do PULSO':'Cápsula Sonora PULSO'});
         Promise.resolve(result).then(()=>setStatus('Imagem enviada ao compartilhamento do dispositivo.')).catch(e=>{
           if(e?.name!=='AbortError')preview(file);
         }).finally(()=>{isBusy=false});
         return;
       }
       preview(file,'No iPhone ou iPad: toque e segure a imagem e selecione Salvar em Fotos.');
       setStatus('Imagem pronta: toque e segure a prévia para salvar.');
     }else{
       download(file);
       setStatus(kind==='story'?'Download do Story vertical 1080 × 1920 iniciado.':'Download da imagem quadrada 1080 × 1080 iniciado.');
     }
   }catch(e){console.warn('PULSO Capsula export:',e);setStatus('Não foi possível gerar a imagem: '+(e?.message||'tente novamente.'));}
   finally{isBusy=false}
 }
 document.addEventListener('DOMContentLoaded',()=>{
   $('pulsoCapsuleInstagram')?.addEventListener('click',()=>onExport('story','story'));
   $('pulsoCapsuleStorySave')?.addEventListener('click',()=>onExport('story','save'));
   $('pulsoCapsuleImage')?.addEventListener('click',()=>onExport('square','save'));
   $('pulsoCapsulePreviewClose')?.addEventListener('click',()=>$('pulsoCapsulePreview')?.close());
   $('pulsoCapsulePreview')?.addEventListener('click',event=>{
     if(event.target===event.currentTarget)event.currentTarget.close();
   });
   $('pulsoCapsulePreview')?.addEventListener('close',resetPreview);
 });
})();