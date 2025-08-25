import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 8080,
  host: process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost'), // localhost for dev, 0.0.0.0 for production
  databaseUrl: process.env.DATABASE_URL,
  
  // Firebase Admin SDK
  firebase: {
    serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT, // JSON string or file path
    projectId: process.env.FIREBASE_PROJECT_ID
  },

  // Google Cloud Storage
  gcs: {
    bucketName: process.env.GCS_BUCKET_NAME || 'boztell-media-dev',
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS, // Service account key file path
    projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID
  },

  whatsapp: {
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
    appSecret: process.env.WHATSAPP_SECRET,
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    graphVersion: 'v23.0',
    baseUrl: 'https://graph.facebook.com'
  }
};

if (!config.databaseUrl) {
  console.warn('[config] DATABASE_URL is not set');
}
