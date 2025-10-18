// Optional: warn if env not present (only in development)
try {
  if (process.env.NODE_ENV !== 'production') {
    const required = [
      'SUPABASE_URL', 
      'SUPABASE_SERVICE_KEY', 
      'WHATSAPP_ACCESS_TOKEN', 
      'WHATSAPP_VERIFY_TOKEN'
    ];
    const missing = required.filter((k) => !process.env[k]);
    if (missing.length) {
      console.warn('[postinstall] Missing Supabase/WhatsApp env vars:', missing.join(', '));
      console.warn('[postinstall] Create .env file with required variables');
      console.warn('[postinstall] See .env.example and SUPABASE_SETUP.md for guidance');
    } else {
      console.log('[postinstall] Environment variables OK');
    }
  }
} catch (err) {
  // Ignore errors in postinstall
  console.log('[postinstall] Completed');
}
