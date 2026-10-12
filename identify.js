/* PULSO IDENTIFY — reconhece o áudio do player nativo sem pausar. A API é acessada APENAS pelo Worker. */
(() => {
  'use strict';
  const el=id=>document.getElementById(id);
  const worker=(window.PULSO_CONFIG?.r2WorkerUrl||'').replace(/\/$/,'');
  let busy=false;
  const tapConnections=new WeakMap();
  function output(message){el('identifyStatus').textContent=message;}
  function dialog(){if(!el('identifyDialog').open)el('identifyDialog').showModal();}
  function findActiveAudio(){
    if(el('playerDialog').open){const x=el('embedContainer').querySelector('audio');if(x)return x;}
    if(!el('radioDock').hidden){const x=el('radioEmbed').querySelector('audio');if(x)return x;}
    return null;
  }
  function supportedTrack(audio){
    try{const u=new URL(audio.currentSrc||audio.src);return u.origin===location.origin || (u.origin===new URL(worker).origin && /^\/media\//.test(u.pathname));}catch{return false;}
  }
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  function connectTap(audio){
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    if(!AudioCtx||!AudioCtx.prototype.createMediaElementSource || !AudioCtx.prototype.createScriptProcessor)throw new Error('Este navegador não permite capturar o áudio em reprodução.');
    if(tapConnections.has(audio))return tapConnections.get(audio);
    const ctx=new AudioCtx();
    // WebAudio substitui a saída padrão da tag. A conexão com destination preserva a audição.
    const src=ctx.createMediaElementSource(audio);src.connect(ctx.destination);
    const tap={ctx,src};tapConnections.set(audio,tap);
    // Evita que o contexto fique ativo quando a faixa antiga termina.
    audio.addEventListener('ended',()=>{if(!tap.recorder){ctx.close().catch(()=>{});tapConnections.delete(audio);}},{once:true});
    return tap;
  }
  function encodeWav(samples,sourceRate,targetRate=16000){
    const len=Math.min(Math.floor(samples.length*targetRate/sourceRate),targetRate*12);
    const output=new ArrayBuffer(44+len*2);const view=new DataView(output);
    const tag=(pos,s)=>{for(let i=0;i<s.length;i++)view.setUint8(pos+i,s.charCodeAt(i));};
    tag(0,'RIFF');view.setUint32(4,36+len*2,true);tag(8,'WAVE');tag(12,'fmt ');
    view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
    view.setUint32(24,targetRate,true);view.setUint32(28,targetRate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);
    tag(36,'data');view.setUint32(40,len*2,true);
    for(let i=0;i<len;i++){
      const v=i*sourceRate/targetRate,j=Math.floor(v),p=v-j;
      const sample=(samples[j]||0)*(1-p)+(samples[Math.min(samples.length-1,j+1)]||0)*p;
      const clipped=Math.max(-1,Math.min(1,sample));view.setInt16(44+i*2,clipped<0?clipped*32768:clipped*32767,true);
    }
    return new Blob([output],{type:'audio/wav'});
  }
  async function captureInPlace(audio){
    if(audio.paused || audio.ended)throw new Error('Inicie a reprodução do DJ set e tente novamente.');
    if(!supportedTrack(audio))throw new Error('Captura direta indisponível nesta fonte. Funciona com arquivos hospedados no PULSO/R2; nos players do YouTube e SoundCloud o navegador impede capturar o áudio.');
    const tap=connectTap(audio);
    try{await tap.ctx.resume();}catch{throw new Error('O iPhone bloqueou a captura. Toque no player e tente novamente.');}
    const rate=tap.ctx.sampleRate,target=Math.ceil(rate*12),blocks=[];let collected=0,maximum=0;
    const processor=tap.ctx.createScriptProcessor(4096,1,1),mute=tap.ctx.createGain();mute.gain.value=0;
    // Mantém a saída audível via tap.src->destination; o ramo com ganho zero existe só para coletar amostras.
    tap.src.connect(processor);processor.connect(mute);mute.connect(tap.ctx.destination);
    tap.recorder=processor;
    try{
      await new Promise((resolve,reject)=>{
        const t=setTimeout(()=>reject(new Error('Tempo limite para capturar a amostra.')),22000);
        processor.onaudioprocess=ev=>{
          if(audio.paused||!audio.isConnected){clearTimeout(t);reject(new Error('A reprodução foi interrompida durante a análise.'));return;}
          const input=ev.inputBuffer.getChannelData(0);
          const usable=Math.min(input.length,target-collected);
          if(usable>0){const slice=input.slice(0,usable);blocks.push(slice);collected+=usable;
            for(let j=0;j<slice.length;j+=16)maximum=Math.max(maximum,Math.abs(slice[j]));}
          if(collected>=target){clearTimeout(t);resolve();}
        };
      });
      if(maximum<.002)throw new Error('Não foi possível captar áudio audível. Verifique se o set está tocando e se a mídia permite CORS.');
      const all=new Float32Array(collected);let offset=0;for(const block of blocks){all.set(block,offset);offset+=block.length;}
      return encodeWav(all,rate);
    }finally{processor.onaudioprocess=null;tap.src.disconnect(processor);processor.disconnect();mute.disconnect();tap.recorder=null;}
  }
  async function recognize(){
    if(busy)return;
    dialog();el('identifyResult').replaceChildren();
    const audio=findActiveAudio();
    if(!audio){output('Este conteúdo é reproduzido em um player externo (YouTube/SoundCloud/Spotify) ou não há áudio ativo. A captura direta não é permitida. Para identificar músicas, toque um MP3 próprio do PULSO.');return;}
    if(!worker){output('O servidor de reconhecimento ainda não foi configurado.');return;}
    const supa=window.supabase;
    if(!supa || !window.PULSO_CONFIG?.supabaseAnonKey){output('Entre em sua conta PULSO para usar o reconhecimento.');return;}
    busy=true;
    try{
      // Usa o mesmo cliente Supabase do site via sessão persistida, sem expor token de AudD.
      const client=supa.createClient(window.PULSO_CONFIG.supabaseUrl,window.PULSO_CONFIG.supabaseAnonKey,{auth:{persistSession:true}});
      const {data:{session}}=await client.auth.getSession();
      if(!session?.access_token)throw new Error('Entre no PULSO antes de identificar músicas.');
      output('Ouvindo cerca de 12 segundos do set… sem pausar a reprodução.');
      const wav=await captureInPlace(audio);
      output('Analisando a impressão digital do áudio…');
      const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),22000);
      let response;try{response=await fetch(worker+'/api/identify',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'audio/wav'},body:wav,signal:controller.signal});}finally{clearTimeout(timeout);}
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'Falha no serviço de identificação.');
      if(data.match?.title && data.match?.artist){
        const title=document.createElement('strong');title.textContent=data.match.title;
        const artist=document.createElement('span');artist.textContent=data.match.artist;
        const card=document.createElement('div');card.className='identify-hit';card.append(artist,title);
        if(data.match.link){try{const u=new URL(data.match.link);if(u.protocol==='https:'){const a=document.createElement('a');a.href=u.href;a.textContent='OUVIR / VER DETALHES ↗';a.target='_blank';a.rel='noopener noreferrer';card.appendChild(a);}}catch{}}
        el('identifyResult').append(card);output('Faixa encontrada! O set continua tocando.');
      }else output('Não houve correspondência. Remixes inéditos, mashups e transições podem não constar no catálogo.');
    }catch(err){output(err.name==='AbortError'?'Identificação demorou demais. Tente novamente.':(err.message||'Não foi possível identificar.'));}
    finally{busy=false;}
  }
  document.addEventListener('DOMContentLoaded',()=>{
    ['identifyPlayer','identifyRadio'].forEach(id=>el(id)?.addEventListener('click',recognize));
    el('identifyClose')?.addEventListener('click',()=>el('identifyDialog').close());
    el('identifyDialog')?.addEventListener('click',ev=>{if(ev.target===el('identifyDialog'))el('identifyDialog').close();});
  });
  window.PULSO_IDENTIFY={encodeWav};
})();
