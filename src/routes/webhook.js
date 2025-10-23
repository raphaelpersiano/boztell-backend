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
    try {
      // Log incoming webhook for debugging
      logger.info({ 
        headers: {
          'content-type': req.get('content-type'),
          'x-hub-signature-256': req.get('x-hub-signature-256') ? 'present' : 'missing'
        },
        bodyPreview: JSON.stringify(req.body).substring(0, 500),
        bodyKeys: Object.keys(req.body || {}),
        hasRawBody: !!req.rawBody,
        rawBodyLength: req.rawBody?.length || 0
      }, 'Received WhatsApp webhook POST request');

      // TEMPORARY: Skip signature validation for debugging
      // TODO: Re-enable after setting WHATSAPP_SECRET in Cloud Run env vars
      const skipValidation = !config.whatsapp.appSecret;
      
      if (!skipValidation) {
        // Validate X-Hub-Signature-256
        const isValid = verifySignature(req);
        logger.info({ isValid, hasAppSecret: !!config.whatsapp.appSecret }, 'Signature validation result');
        
        if (!isValid) {
          logger.warn({ 
            signature: req.get('X-Hub-Signature-256'),
            hasRawBody: !!req.rawBody,
            hasAppSecret: !!config.whatsapp.appSecret 
          }, 'Invalid WhatsApp signature');
          return res.sendStatus(403);
        }
      } else {
        logger.warn('WHATSAPP_SECRET not set - skipping signature validation (INSECURE!)');
      }

      const body = req.body;
      
      logger.info({ 
        bodyObject: body?.object,
        entryCount: body?.entry?.length || 0
      }, 'Webhook body parsed successfully');
    
    } catch (parseError) {
      logger.error({ 
        error: parseError.message,
        stack: parseError.stack
      }, 'Error parsing webhook request');
      return res.status(400).json({ 
        error: 'Invalid request format',
        details: parseError.message 
      });
    }

    try {
      logger.info({ 
        entryCount: body.entry?.length || 0,
        object: body.object 
      }, 'Processing WhatsApp webhook body');
      
      const results = await routeWhatsAppWebhook({ io, body });
      
      // Check if any processing failed
      const hasErrors = results.some(result => result.error || result.success === false);
      
      if (hasErrors) {
        const errors = results.filter(r => r.error || r.success === false);
        logger.error({ 
          errors,
          processedCount: results.length - errors.length,
          totalCount: results.length
        }, 'Some webhook events failed to process');
        
        // Return 500 if any critical processing failed
        return res.status(500).json({ 
          error: 'Some events failed to process',
          processed: results.length - errors.length,
          failed: errors.length,
          errors: errors.map(e => e.error || 'Processing failed')
        });
      }
      
      logger.info({ 
        processedCount: results.length,
        entryCount: body.entry?.length || 0 
      }, 'WhatsApp webhook processed successfully');
      
      // Return success with processing details
      res.status(200).json({
        success: true,
        processed: results.length,
        results: results.map(r => ({
          type: r.type,
          room_id: r.room_id,
          message_id: r.message_id,
          wa_message_id: r.wa_message_id,
          public_url: r.public_url || r.media_url || undefined
        }))
      });
      
    } catch (err) {
      logger.error({ 
        error: err.message,
        stack: err.stack,
        name: err.name,
        body: req.body
      }, 'Failed processing WhatsApp webhook');
      
      res.status(500).json({ 
        error: 'Webhook processing failed',
        message: err.message,
        type: err.name
      });
    }
  });

  return router;
}

function verifySignature(req) {
  const signature = req.get('X-Hub-Signature-256');
  
  // Log for debugging
  logger.info({ 
    hasSignature: !!signature,
    hasAppSecret: !!config.whatsapp.appSecret,
    hasRawBody: !!req.rawBody,
    rawBodyType: typeof req.rawBody,
    bodyType: typeof req.body
  }, 'Verifying signature');
  
  // If no signature header or no app secret configured, allow (dev mode)
  if (!signature || !config.whatsapp.appSecret) {
    logger.warn('No signature or app secret - allowing webhook (dev mode)');
    return true;
  }
  
  // Get raw body - try multiple sources
  let rawBody = req.rawBody;
  
  // If rawBody is not available, try to reconstruct from req.body
  if (!rawBody && req.body) {
    rawBody = Buffer.from(JSON.stringify(req.body), 'utf8');
    logger.info('Reconstructed rawBody from req.body');
  }
  
  if (!rawBody) {
    logger.error('No raw body available for signature verification');
    return false;
  }
  
  const expected = 'sha256=' + crypto
    .createHmac('sha256', config.whatsapp.appSecret)
    .update(rawBody)
    .digest('hex');
    
  logger.info({ 
    receivedSignature: signature,
    expectedSignature: expected,
    match: signature === expected
  }, 'Signature comparison');
  
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch (err) {
    logger.error({ err }, 'Signature comparison failed');
    return false;
  }
}
