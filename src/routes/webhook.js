import crypto from 'crypto';
import express from 'express';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { handleIncomingMessage } from '../services/messageService.js';

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
      const events = extractWhatsappMessages(body);
      for (const ev of events) {
        // Map to room/user domain. You might look up room by wa phone id.
        const roomId = ev.room_id; // extracted by mapping function or defaults
        await handleIncomingMessage({ io, fcmServerKey: config.fcmServerKey }, {
          room_id: roomId,
          sender_id: ev.sender_id,
          sender: ev.sender_name || ev.sender_id,
          content_type: 'text',
          content_text: ev.text,
          wa_message_id: ev.wa_message_id
        });
      }
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

// Parse WhatsApp Business Cloud API v23 notification to extract messages
function extractWhatsappMessages(body) {
  const results = [];
  if (!body || !body.entry) return results;
  for (const entry of body.entry) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      const messages = value.messages || [];
      const contacts = value.contacts || [];
      for (const m of messages) {
        // Example mapping: use from (wa id) and contact profile name
        const contact = contacts.find(c => c.wa_id === m.from) || {};
        const sender_id = m.from;
        const sender_name = contact.profile?.name || sender_id;
        const text = m.text?.body || '';
        const wa_message_id = m.id;
        const room_id = value.metadata?.display_phone_number || value.metadata?.phone_number_id || 'default';
        results.push({ sender_id, sender_name, text, wa_message_id, room_id });
      }
    }
  }
  return results;
}
