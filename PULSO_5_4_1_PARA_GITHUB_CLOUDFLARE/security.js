/* PULSO 4.2 — proteção de conta e verificação adicional. Sem chaves privadas no site. */
(()=>{'use strict';
  const $=id=>document.getElementById(id);
  let sb,toast,onSuccess,mode='',factorId='',captchaWidget=null,captchaValue='',captchaLoaded=false;
  const publicSiteKey=String(window.PULSO_CONFIG?.turnstileSiteKey||'').trim();
  const captchaRequired=()=>Boolean(publicSiteKey);
  const strongPassword=p=>typeof p==='string'&&p.length>=12&&/[a-z]/.test(p)&&/[A-Z]/.test(p)&&/\d/.test(p)&&/[^A-Za-z0-9]/.test(p);
  function status(s){$('securityError').textContent=s||'';}
  function resetCaptcha(){captchaValue='';if(captchaWidget!==null && window.turnstile)try{turnstile.reset(captchaWidget);}catch{}}
  function refreshCaptcha(){if(publicSiteKey)$('authCaptchaWrap').hidden=false;}
  function captchaToken(){return captchaValue;}
  function initCaptcha(){
    if(!publicSiteKey)return;
    $('authCaptchaWrap').hidden=false;
    const onReady=()=>{
      if(captchaWidget!==null||!window.turnstile)return;
      captchaWidget=window.turnstile.render('#authCaptcha',{
        sitekey:publicSiteKey,theme:'dark',callback:v=>{captchaValue=v;},
        'expired-callback':()=>{captchaValue='';},'error-callback':()=>{captchaValue='';}
      });
    };
    if(window.turnstile){onReady();return;}
    if(captchaLoaded)return;
    captchaLoaded=true;
    const s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async=true;s.defer=true;s.onload=onReady;s.onerror=()=>{$('authError').textContent='CAPTCHA indisponível. Verifique sua conexão.';};
    document.head.appendChild(s);
  }
  function close(){if($('securityDialog').open)$('securityDialog').close();status('');$('securityCode').value='';$('securityQrContainer').hidden=true;$('securityQr').removeAttribute('src');}
  function open(){if(!$('securityDialog').open)$('securityDialog').showModal();}
  async function showChallenge(){
    if(!sb||mode==='challenge'&&$('securityDialog').open)return;
    resetMfaCodeControl();
    const {data,error}=await sb.auth.mfa.listFactors();
    if(error||!data?.totp?.length){status('Não foi possível localizar o autenticador. Entre em contato com o administrador.');return;}
    const valid=data.totp.find(x=>x.status==='verified')||data.totp[0];factorId=valid.id;mode='challenge';
    $('securityTitle').textContent='CONFIRME O ACESSO';
    $('securityDescription').textContent='Digite o código atual do aplicativo autenticador para concluir o login.';
    $('securityQrContainer').hidden=true;$('securitySubmit').textContent='VERIFICAR ACESSO ↗';
    open();
  }
  async function showSetup(){
    if(!sb)return;
    status('');resetMfaCodeControl();
    try{
      const assurance=await sb.auth.mfa.getAuthenticatorAssuranceLevel();
      if(assurance.data?.nextLevel==='aal2'){toast('Você já possui um autenticador configurado.');return;}
      const {data,error}=await sb.auth.mfa.enroll({factorType:'totp',friendlyName:'PULSO LØSI'});
      if(error)throw error;
      factorId=data.id;mode='setup';
      $('securityTitle').textContent='PROTEGER MINHA CONTA';
      $('securityDescription').textContent='Escaneie o QR code no seu app autenticador e digite o código de seis dígitos.';
      const qr=String(data.totp?.qr_code||'');
      $('securityQr').src=qr.startsWith('data:image/')?qr:'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(qr);
      $('securityQrContainer').hidden=false;$('securitySubmit').textContent='ATIVAR AUTENTICADOR ↗';
      open();
    }catch(err){toast('Não foi possível ativar o autenticador: '+String(err?.message||err));}
  }
  async function submitSecurity(ev){
    ev.preventDefault();status('');const code=$('securityCode').value.trim();
    if(mode==='recovery'){
      if(!strongPassword(code)){status('Use 12+ caracteres: maiúscula, minúscula, número e símbolo.');return;}
      $('securitySubmit').disabled=true;
      try{
        const {error}=await sb.auth.updateUser({password:code});if(error)throw error;
        mode='';close();toast('Nova senha gravada com segurança.');await onSuccess?.();
      }catch(err){status('Não foi possível redefinir a senha: '+String(err?.message||err));}
      finally{$('securitySubmit').disabled=false;}
      return;
    }
    if(!/^\d{6}$/.test(code)){status('Digite exatamente seis dígitos.');return;}
    $('securitySubmit').disabled=true;
    try{
      const {error}=await sb.auth.mfa.challengeAndVerify({factorId,code});if(error)throw error;
      const previous=mode;mode='';close();
      toast(previous==='setup'?'Proteção de dois fatores ativada.':'Identidade confirmada.');
      await onSuccess?.();
    }catch(err){status('Código inválido ou expirado. Aguarde outro código e tente novamente.');}
    finally{$('securitySubmit').disabled=false;}
  }
  async function showPasswordRecovery(){
    if(!sb)return;
    mode='recovery';factorId='';
    $('securityTitle').textContent='CRIAR NOVA SENHA';
    $('securityDescription').textContent='Defina uma senha segura para a sua conta. Ela não aparece no feed e não será enviada ao PULSO em texto.';
    $('securityQrContainer').hidden=true;
    $('securityCode').value='';$('securityCode').type='password';
    $('securityCode').removeAttribute('pattern');$('securityCode').maxLength=128;
    $('securityCode').autocomplete='new-password';
    $('securityCode').closest('label').firstChild.textContent='NOVA SENHA';
    $('securitySubmit').textContent='SALVAR NOVA SENHA ↗';
    open();
  }
  function resetMfaCodeControl(){
    const input=$('securityCode');input.type='text';input.maxLength=6;
    input.setAttribute('pattern','[0-9]{6}');input.autocomplete='one-time-code';
    input.closest('label').firstChild.textContent='CÓDIGO DE 6 DÍGITOS';
  }
  function init(args){sb=args.sb;toast=args.toast;onSuccess=args.onSuccess;
    $('securityForm').addEventListener('submit',submitSecurity);
    $('setupMfa').addEventListener('click',showSetup);
    $('closeSecurity').addEventListener('click',async()=>{
      if(mode==='challenge'){await sb.auth.signOut();toast('Verificação cancelada: sessão encerrada.');}
      mode='';close();
    });
    initCaptcha();
  }
  window.PULSO_SECURITY={init,showChallenge,showPasswordRecovery,strongPassword,captchaRequired,captchaToken,resetCaptcha,refreshCaptcha};
})();
