import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 8080,
  host: process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost'), // localhost for dev, 0.0.0.0 for production
  
  // Supabase Configuration
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_KEY, // Service role key for server-side operations
    anonKey: process.env.SUPABASE_ANON_KEY, // Anon key for client-side operations (if needed)
    bucketName: process.env.SUPABASE_BUCKET_NAME || 'boztell',
  },
  
  // Firebase Admin SDK (keeping for FCM notifications)
  firebase: {
    serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT, // JSON string or file path
    projectId: process.env.FIREBASE_PROJECT_ID
  },

  whatsapp: {
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
    appSecret: process.env.WHATSAPP_SECRET,
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    graphVersion: 'v24.0',
    baseUrl: 'https://graph.facebook.com'
  }
};

// Validation for Supabase configuration
if (!config.supabase.url) {
  console.warn('[config] SUPABASE_URL is not set');
}

if (!config.supabase.serviceKey) {
  console.warn('[config] SUPABASE_SERVICE_KEY is not set');
}
