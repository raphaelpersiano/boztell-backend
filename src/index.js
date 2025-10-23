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
import { createMessagesRouter } from './routes/messages.js';
import leadsRouter from './routes/leads.js';
import usersRouter from './routes/users.js';
import authRouter from './routes/auth.js';
import roomsRouter from './routes/rooms.js';
import { initializeFirebase } from './services/fcmService.js';
import { initializeStorage } from './services/storageService.js';

const app = express();

// CORS configuration - Allow all origins for development
app.use(cors({
  origin: '*', // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(helmet());
// Serve uploaded files for development
app.use('/uploads', express.static('uploads'));

// Use express.json with a verify function to retain the raw body for signature validation
app.use(express.json({
  limit: '1mb',
  verify: (req, res, buf, encoding) => { 
    // Always store raw body for webhook signature validation
    req.rawBody = buf; 
  }
}));

// Health check - More comprehensive for Cloud Run
app.get('/health', async (req, res) => {
  try {
    // Basic health check
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      environment: config.env,
      port: config.port,
      host: config.host
    };
    
    // Optional: Add database connectivity check
    try {
      const { query } = await import('./db.js');
      await query('SELECT 1');
      health.database = 'connected';
      health.databaseType = 'supabase';
    } catch (dbErr) {
      health.database = 'disconnected';
      health.databaseType = 'supabase';
      health.warnings = health.warnings || [];
      health.warnings.push('Supabase database connection failed');
    }
    
    res.status(200).json(health);
  } catch (err) {
    logger.error({ err }, 'Health check failed');
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: err.message
    });
  }
});

const server = http.createServer(app);
const io = setupSocket(server);

// Initialize services
async function initializeServices() {
  try {
    logger.info('Initializing Firebase Admin SDK...');
    initializeFirebase();
    logger.info('Firebase Admin SDK initialized');
  } catch (err) {
    logger.warn({ err }, 'Firebase initialization failed - push notifications disabled');
  }

  try {
    logger.info('Initializing Supabase Storage...');
    initializeStorage();
    logger.info('Supabase Storage initialized');
  } catch (err) {
    logger.warn({ err }, 'Supabase Storage initialization failed - media storage disabled');
  }
}

// Routes
app.use('/webhook', createWebhookRouter(io));
app.use('/devices', devicesRouter);
app.use('/media', mediaRouter);
app.use('/messages', createMessagesRouter(io));
app.use('/leads', leadsRouter);
app.use('/users', usersRouter);
app.use('/auth', authRouter);
app.use('/rooms', roomsRouter);

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Boztell Backend',
    version: '2.0.0',
    features: [
      'WhatsApp Business Cloud API v23 webhooks',
      'Comprehensive message type support',
      'Media upload/download with Supabase Storage',
      'Firebase Admin SDK push notifications',
      'Real-time WebSocket updates',
      'Supabase PostgreSQL message persistence', 
      'Enterprise-ready architecture'
    ],
    endpoints: {
      webhooks: '/webhook/whatsapp',
      devices: '/devices/register',
      media: '/media/upload',
      messages: '/messages/send',
      rooms: '/rooms',
      auth: '/auth/login',
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

// Start server with proper error handling
async function startServer() {
  try {
    // Initialize services first
    await initializeServices();
    
    // Start HTTP server
    server.listen(config.port, config.host, () => {
      logger.info(`Boztell Backend v2.0.0 listening on ${config.host}:${config.port}`);
      logger.info(`Environment: ${config.env}`);
      logger.info(`Health check: http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}/health`);
      logger.info(`API info: http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}/api`);
      logger.info('Server started successfully');
    });
    
    // Handle server errors
    server.on('error', (err) => {
      logger.error({ err, port: config.port, host: config.host }, 'Server failed to start');
      process.exit(1);
    });
    
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Start the server
startServer();
