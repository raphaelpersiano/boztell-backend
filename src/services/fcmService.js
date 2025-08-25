import admin from 'firebase-admin';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

// Initialize Firebase Admin SDK
let firebaseApp;

export function initializeFirebase() {
  if (firebaseApp) return firebaseApp;

  try {
    let serviceAccount;
    
    if (config.firebase.serviceAccount) {
      // Try to parse as JSON string first, fallback to file path
      try {
        serviceAccount = JSON.parse(config.firebase.serviceAccount);
      } catch {
        serviceAccount = config.firebase.serviceAccount; // Assume it's a file path
      }
    }

    const initConfig = {
      projectId: config.firebase.projectId
    };

    if (serviceAccount) {
      if (typeof serviceAccount === 'object') {
        initConfig.credential = admin.credential.cert(serviceAccount);
      } else {
        initConfig.credential = admin.credential.cert(serviceAccount);
      }
    } else {
      // Use default credentials (useful in Cloud Run with service account attached)
      initConfig.credential = admin.credential.applicationDefault();
    }

    firebaseApp = admin.initializeApp(initConfig);
    logger.info('Firebase Admin SDK initialized successfully');
    return firebaseApp;
  } catch (err) {
    logger.error({ err }, 'Failed to initialize Firebase Admin SDK');
    throw err;
  }
}

/**
 * Send push notification using Firebase Admin SDK
 */
export async function sendPushNotification({ token, payload, options = {} }) {
  if (!firebaseApp) {
    initializeFirebase();
  }

  const messaging = admin.messaging();
  
  const message = {
    token,
    notification: {
      title: payload.title || payload.sender || 'New message',
      body: payload.message || payload.content_text || 'You have a new message'
    },
    data: {
      room_id: String(payload.room_id || ''),
      sender: String(payload.sender || ''),
      message_id: String(payload.message_id || ''),
      type: String(payload.type || 'message'),
      ...payload.data // Additional custom data
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'chat_messages',
        defaultSound: true,
        defaultVibratePattern: true,
        defaultLightSettings: true
      }
    },
    apns: {
      headers: {
        'apns-priority': '10'
      },
      payload: {
        aps: {
          sound: 'default',
          badge: payload.unread_count || 1
        }
      }
    },
    ...options
  };

  try {
    const response = await messaging.send(message);
    logger.info({ messageId: response, token: token.substring(0, 20) + '...' }, 'FCM notification sent');
    return { success: true, messageId: response };
  } catch (err) {
    logger.error({ err, token: token.substring(0, 20) + '...' }, 'FCM send failed');
    
    // Handle different error types
    if (err.code === 'messaging/registration-token-not-registered') {
      return { success: false, error: 'INVALID_TOKEN', shouldRemove: true };
    } else if (err.code === 'messaging/invalid-registration-token') {
      return { success: false, error: 'INVALID_TOKEN', shouldRemove: true };
    }
    
    throw err;
  }
}

/**
 * Send notifications to multiple devices
 */
export async function sendMulticastNotification({ tokens, payload, options = {} }) {
  if (!firebaseApp) {
    initializeFirebase();
  }

  if (!tokens || tokens.length === 0) {
    return { success: true, results: [] };
  }

  const messaging = admin.messaging();
  
  const message = {
    tokens,
    notification: {
      title: payload.title || payload.sender || 'New message',
      body: payload.message || payload.content_text || 'You have a new message'
    },
    data: {
      room_id: String(payload.room_id || ''),
      sender: String(payload.sender || ''),
      message_id: String(payload.message_id || ''),
      type: String(payload.type || 'message'),
      ...payload.data
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'chat_messages',
        defaultSound: true
      }
    },
    apns: {
      headers: { 'apns-priority': '10' },
      payload: { aps: { sound: 'default', badge: payload.unread_count || 1 } }
    },
    ...options
  };

  try {
    const response = await messaging.sendEachForMulticast(message);
    
    // Process results and identify invalid tokens
    const invalidTokens = [];
    response.responses.forEach((result, index) => {
      if (!result.success) {
        const error = result.error;
        if (error?.code === 'messaging/registration-token-not-registered' ||
            error?.code === 'messaging/invalid-registration-token') {
          invalidTokens.push(tokens[index]);
        }
      }
    });

    logger.info({ 
      successCount: response.successCount, 
      failureCount: response.failureCount,
      invalidTokenCount: invalidTokens.length
    }, 'Multicast FCM notification sent');

    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      invalidTokens,
      responses: response.responses
    };
  } catch (err) {
    logger.error({ err, tokenCount: tokens.length }, 'Multicast FCM send failed');
    throw err;
  }
}
