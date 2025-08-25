// Optional: warn if env not present (only in development)
try {
  if (process.env.NODE_ENV !== 'production') {
    const required = ['DATABASE_URL', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_VERIFY_TOKEN'];
    const missing = required.filter((k) => !process.env[k]);
    if (missing.length) {
      console.warn('[postinstall] Missing env vars:', missing.join(', '));
      console.warn('[postinstall] Create .env file with required variables');
    } else {
      console.log('[postinstall] Environment variables OK');
    }
  }
} catch (err) {
  // Ignore errors in postinstall
  console.log('[postinstall] Completed');
}
