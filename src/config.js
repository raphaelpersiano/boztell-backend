import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 8080,
  databaseUrl: process.env.DATABASE_URL,
  fcmServerKey: process.env.FCM_SERVER_KEY,
  whatsapp: {
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN, // for webhook verification
    appSecret: process.env.WHATSAPP_SECRET, // for signature verification (X-Hub-Signature-256)
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN, // for sending messages if needed
    graphVersion: 'v23.0'
  }
};

if (!config.databaseUrl) {
  console.warn('[config] DATABASE_URL is not set');
}
