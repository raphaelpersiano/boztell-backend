import express from 'express';
import multer from 'multer';
import { uploadMediaToWhatsApp } from '../services/mediaService.js';
import { uploadBuffer as uploadToGCS } from '../services/storageService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB max
  },
  fileFilter: (req, file, cb) => {
    // Validate supported media types
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/mpeg', 'video/quicktime',
      'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg',
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain', 'text/csv'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
    }
  }
});

/**
 * Upload media file to both GCS and WhatsApp
 * POST /media/upload
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { room_id, folder = 'uploads' } = req.body;
    const { buffer, originalname, mimetype, size } = req.file;

    // 1. Upload to Google Cloud Storage with organized folder structure
    const gcsResult = await uploadToGCS({
      buffer,
      filename: originalname,
      contentType: mimetype,
      folder: 'uploads',
      roomId: room_id,
      phoneNumber: extractPhoneNumberFromRoomId(room_id)
    });

    // 2. Upload to WhatsApp (optional - only if needed for sending)
    let whatsappResult = null;
    if (req.body.uploadToWhatsApp === 'true') {
      try {
        whatsappResult = await uploadMediaToWhatsApp({
          buffer,
          filename: originalname,
          mimeType: mimetype
        });
      } catch (err) {
        logger.warn({ err, filename: originalname }, 'WhatsApp upload failed, but GCS upload succeeded');
      }
    }

    logger.info({ 
      filename: originalname, 
      size, 
      gcsFilename: gcsResult.gcsFilename,
      whatsappMediaId: whatsappResult?.id 
    }, 'Media uploaded successfully');

    res.json({
      success: true,
      file: {
        id: gcsResult.fileId,
        originalName: originalname,
        size,
        contentType: mimetype,
        gcsFilename: gcsResult.gcsFilename,
        url: gcsResult.url,
        whatsappMediaId: whatsappResult?.id || null
      }
    });

  } catch (err) {
    logger.error({ err }, 'Media upload failed');
    
    if (err.message.includes('Unsupported file type')) {
      return res.status(400).json({ error: err.message });
    }
    
    res.status(500).json({ error: 'Upload failed' });
  }
});

/**
 * Upload media directly to WhatsApp only
 * POST /media/whatsapp-upload
 */
router.post('/whatsapp-upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { buffer, originalname, mimetype } = req.file;

    const result = await uploadMediaToWhatsApp({
      buffer,
      filename: originalname,
      mimeType: mimetype
    });

    logger.info({ filename: originalname, mediaId: result.id }, 'Media uploaded to WhatsApp');

    res.json({
      success: true,
      mediaId: result.id,
      filename: originalname
    });

  } catch (err) {
    logger.error({ err }, 'WhatsApp media upload failed');
    res.status(500).json({ error: 'WhatsApp upload failed' });
  }
});

/**
 * List media files for a room and date
 * GET /media/list?room_id=xxx&date=2025-08-25
 */
router.get('/list', async (req, res) => {
  try {
    const { room_id, phone_number, date, folder = 'media' } = req.query;
    
    if (!room_id && !phone_number) {
      return res.status(400).json({ error: 'room_id or phone_number required' });
    }
    
    const { listMediaFiles } = await import('../services/storageService.js');
    const files = await listMediaFiles({
      roomId: room_id,
      phoneNumber: phone_number,
      date,
      folder
    });
    
    res.json({
      success: true,
      room_id: room_id || phone_number,
      date: date || new Date().toISOString().split('T')[0],
      files,
      count: files.length
    });

  } catch (err) {
    logger.error({ err }, 'Failed to list media files');
    res.status(500).json({ error: 'Failed to list files' });
  }
});

/**
 * Get media dates for a room (folder structure)
 * GET /media/dates?room_id=xxx
 */
router.get('/dates', async (req, res) => {
  try {
    const { room_id, phone_number, folder = 'media' } = req.query;
    
    if (!room_id && !phone_number) {
      return res.status(400).json({ error: 'room_id or phone_number required' });
    }
    
    const { getRoomMediaDates } = await import('../services/storageService.js');
    const dates = await getRoomMediaDates({
      roomId: room_id,
      phoneNumber: phone_number,
      folder
    });
    
    res.json({
      success: true,
      room_id: room_id || phone_number,
      dates,
      count: dates.length
    });

  } catch (err) {
    logger.error({ err }, 'Failed to get media dates');
    res.status(500).json({ error: 'Failed to get dates' });
  }
});

/**
 * Get media statistics for a room
 * GET /media/stats?room_id=xxx
 */
router.get('/stats', async (req, res) => {
  try {
    const { room_id, phone_number, folder = 'media' } = req.query;
    
    if (!room_id && !phone_number) {
      return res.status(400).json({ error: 'room_id or phone_number required' });
    }
    
    const { getRoomMediaStats } = await import('../services/storageService.js');
    const stats = await getRoomMediaStats({
      roomId: room_id,
      phoneNumber: phone_number,
      folder
    });
    
    res.json({
      success: true,
      stats
    });

  } catch (err) {
    logger.error({ err }, 'Failed to get media stats');
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

/**
 * Get media file info
 * GET /media/:fileId
 */
router.get('/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    
    // This would require a database lookup to get file metadata
    // For now, return a simple response
    res.json({ 
      message: 'Media file info endpoint - implement based on your needs',
      fileId 
    });

  } catch (err) {
    logger.error({ err }, 'Failed to get media info');
    res.status(500).json({ error: 'Failed to get media info' });
  }
});

/**
 * Refresh expired media URL
 * POST /media/:fileId/refresh-url
 */
router.post('/:fileId/refresh-url', async (req, res) => {
  try {
    const { fileId } = req.params;
    
    const { refreshMediaUrl } = await import('../services/mediaService.js');
    const updatedMessage = await refreshMediaUrl(fileId);
    
    res.json({
      success: true,
      newUrl: updatedMessage.gcs_url
    });

  } catch (err) {
    logger.error({ err }, 'Failed to refresh media URL');
    
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: 'Media not found' });
    }
    
    res.status(500).json({ error: 'Failed to refresh URL' });
  }
});

/**
 * Extract phone number from room ID
 * Since room ID = phone number in our simplified approach, just return the room ID
 */
function extractPhoneNumberFromRoomId(roomId) {
  if (!roomId) return null;
  
  // In our simplified approach, roomId is the phone number itself
  // Just clean it to ensure it's a valid phone number format
  const cleaned = roomId.toString().replace(/\D/g, '');
  
  // Validate it looks like a phone number (10-15 digits)
  if (cleaned.length >= 10 && cleaned.length <= 15) {
    return cleaned;
  }
  
  return roomId; // Return as-is if not a standard phone number format
}

// Error handler for multer
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large (max 100MB)' });
    }
  }
  next(err);
});

export const mediaRouter = router;
