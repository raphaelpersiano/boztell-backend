// Optional: warn if env not present
import fs from 'fs';
const required = ['DATABASE_URL', 'FCM_SERVER_KEY', 'WHATSAPP_SECRET', 'WHATSAPP_VERIFY_TOKEN'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.warn('[postinstall] Missing env:', missing.join(', '));
}
