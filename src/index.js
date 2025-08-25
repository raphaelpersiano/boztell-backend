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

const app = express();

app.use(helmet());
app.use(cors());
// Use express.json with a verify function to retain the raw body for signature validation
app.use(express.json({
  limit: '1mb',
  verify: (req, res, buf) => { req.rawBody = buf; }
}));

app.get('/health', (req, res) => res.json({ ok: true }));

const server = http.createServer(app);
const io = setupSocket(server);

// Routes
app.use('/webhook', createWebhookRouter(io));
app.use('/devices', devicesRouter);

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal Server Error' });
});

server.listen(config.port, () => {
  logger.info(`Server listening on port ${config.port}`);
});
