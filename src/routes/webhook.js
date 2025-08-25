import crypto from 'crypto';
import express from 'express';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { routeWhatsAppWebhook } from './webhooks/whatsappHandlers.js';

export function createWebhookRouter(io) {
  const router = express.Router();

  // For raw body signature validation, express.json({ verify }) configured in index.js
  router.get('/whatsapp', (req, res) => {
    // Verification for webhook setup
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  });

  router.post('/whatsapp', async (req, res) => {
    // Validate X-Hub-Signature-256
    if (!verifySignature(req)) {
      logger.warn('Invalid WhatsApp signature');
      return res.sendStatus(403);
    }

    const body = req.body;
    try {
      const results = await routeWhatsAppWebhook({ io, body });
      
      logger.info({ 
        processedCount: results.length,
        entryCount: body.entry?.length || 0 
      }, 'WhatsApp webhook processed');
      
      res.sendStatus(200);
    } catch (err) {
      logger.error({ err, body }, 'Failed processing WhatsApp webhook');
      res.sendStatus(500);
    }
  });

  return router;
}

function verifySignature(req) {
  const signature = req.get('X-Hub-Signature-256');
  if (!signature || !config.whatsapp.appSecret) return true; // allow in dev
  const expected = 'sha256=' + crypto
    .createHmac('sha256', config.whatsapp.appSecret)
    .update(req.rawBody)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch (_) {
    return false;
  }
}
