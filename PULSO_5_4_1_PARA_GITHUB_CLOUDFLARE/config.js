/* PULSO × LØSI — Supabase Storage + YouTube. Chave pública, segura para browser. */
window.PULSO_CONFIG = {
  supabaseUrl: 'https://tkarjnhdnhirguqbzaxs.supabase.co',
  supabaseAnonKey: 'sb_publishable_2idlqWc7Sz0dLI_xwavNRA_C4bOFkIn',
  // Cole somente a SITE KEY pública do Cloudflare Turnstile. O secret fica no Supabase.
  // Configure o CAPTCHA no painel Supabase APÓS publicar esta versão e inserir a site key.
  turnstileSiteKey: '',
  maxVideoUploadMB: 48,
  maxAudioUploadMB: 400,
  // Preencha depois de publicar o Worker no Cloudflare (sem / no final):
  r2WorkerUrl: 'https://pulso-losi-storage.igorlosi29.workers.dev',
  vapidPublicKey: 'BLVR4rXfP4cD4xYfhPjM-EqwnfavKnEiwmWeDUwbPRKlBmclIie0K62Sl-6Gm8FIqAzmKyNY8XMT8wbTk0o8UFQ'
};
