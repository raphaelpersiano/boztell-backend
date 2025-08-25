import 'express-async-errors';
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { setupSocket } from './socket/index.js';
import { createWebhookRouter } from './routes/webhook.js';
import { devicesRouter } from './routes/devices.js';
import { mediaRouter } from './routes/media.js';
import { initializeFirebase } from './services/fcmService.js';
import { initializeStorage } from './services/storageService.js';

const app = express();

app.use(helmet());
app.use(cors());
// Use express.json with a verify function to retain the raw body for signature validation
app.use(express.json({
  limit: '1mb',
  verify: (req, res, buf) => { req.rawBody = buf; }
}));

// Health check
app.get('/health', (req, res) => res.json({ 
  ok: true, 
  timestamp: new Date().toISOString(),
  version: '2.0.0'
}));

const server = http.createServer(app);
const io = setupSocket(server);

// Initialize services
try {
  initializeFirebase();
  logger.info('Firebase Admin SDK initialized');
} catch (err) {
  logger.warn({ err }, 'Firebase initialization failed - push notifications disabled');
}

try {
  initializeStorage();
  logger.info('Google Cloud Storage initialized');
} catch (err) {
  logger.warn({ err }, 'GCS initialization failed - media storage disabled');
}

// Routes
app.use('/webhook', createWebhookRouter(io));
app.use('/devices', devicesRouter);
app.use('/media', mediaRouter);

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Boztell Backend',
    version: '2.0.0',
    features: [
      'WhatsApp Business Cloud API v23 webhooks',
      'Comprehensive message type support',
      'Media upload/download with Google Cloud Storage',
      'Firebase Admin SDK push notifications',
      'Real-time WebSocket updates',
      'PostgreSQL message persistence',
      'Enterprise-ready architecture'
    ],
    endpoints: {
      webhooks: '/webhook/whatsapp',
      devices: '/devices/register',
      media: '/media/upload',
      health: '/health'
    }
  });
});

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error({ err, url: req.url, method: req.method }, 'Unhandled error');
  res.status(500).json({ error: 'Internal Server Error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

server.listen(config.port, config.host, () => {
  logger.info(`Boztell Backend v2.0.0 listening on ${config.host}:${config.port}`);
  logger.info(`Environment: ${config.env}`);
  logger.info(`Health check: http://${config.host}:${config.port}/health`);
  logger.info(`API info: http://${config.host}:${config.port}/api`);
});
