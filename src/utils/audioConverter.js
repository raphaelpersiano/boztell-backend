import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import { Readable } from 'stream';
import { logger } from './logger.js';

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath.path);

/**
 * Convert audio buffer to OGG format with Opus codec (WhatsApp requirement)
 * 
 * WhatsApp Audio Requirements:
 * - Format: OGG container
 * - Codec: OPUS only (base audio/ogg without OPUS is NOT supported)
 * - Channels: Mono (1 channel) recommended for voice
 * - Sample Rate: 48kHz (OPUS standard)
 * - Bitrate: 128kbps (good quality for voice)
 * 
 * @param {Buffer} inputBuffer - Input audio buffer (WebM, MP3, WAV, etc.)
 * @param {string} inputFormat - Input format (webm, mp3, wav, etc.)
 * @returns {Promise<Buffer>} - Output OGG buffer with OPUS codec
 */
export async function convertAudioToOgg(inputBuffer, inputFormat = 'webm') {
  return new Promise((resolve, reject) => {
    try {
      logger.info({ 
        inputSize: inputBuffer.length,
        inputFormat,
        targetCodec: 'OPUS',
        targetFormat: 'OGG'
      }, '🔄 Starting audio conversion to OGG with OPUS codec (WhatsApp requirement)');

      const chunks = [];
      const inputStream = Readable.from(inputBuffer);
      
      ffmpeg(inputStream)
        .inputFormat(inputFormat)
        .audioCodec('libopus') // ✅ OPUS codec - REQUIRED by WhatsApp for OGG format
        .audioBitrate('128k') // 128kbps - good quality for voice
        .audioChannels(1) // Mono - WhatsApp requirement for OGG
        .audioFrequency(48000) // 48kHz sample rate (OPUS standard)
        .format('ogg')
        .on('start', (commandLine) => {
          logger.info({ commandLine }, '▶️ FFmpeg command started (OPUS encoding)');
        })
        .on('progress', (progress) => {
          logger.debug({ progress }, '⏳ FFmpeg conversion progress');
        })
        .on('end', () => {
          const outputBuffer = Buffer.concat(chunks);
          logger.info({ 
            inputSize: inputBuffer.length,
            outputSize: outputBuffer.length,
            compressionRatio: ((1 - outputBuffer.length / inputBuffer.length) * 100).toFixed(2) + '%',
            codec: 'OPUS',
            format: 'OGG'
          }, '✅ Audio conversion to OGG (OPUS) completed successfully');
          resolve(outputBuffer);
        })
        .on('error', (err, stdout, stderr) => {
          logger.error({ 
            err, 
            stdout, 
            stderr,
            inputFormat,
            inputSize: inputBuffer.length,
            targetCodec: 'OPUS'
          }, '❌ FFmpeg conversion to OGG (OPUS) failed');
          reject(new Error(`Audio conversion to OGG (OPUS codec) failed: ${err.message}`));
        })
        .pipe()
        .on('data', (chunk) => {
          chunks.push(chunk);
        });
        
    } catch (err) {
      logger.error({ err }, '❌ Failed to start audio conversion to OGG (OPUS)');
      reject(err);
    }
  });
}

/**
 * Check if audio format needs conversion for WhatsApp
 * WhatsApp supports: AAC, AMR, MP3/MPEG, MP4, OGG (with OPUS codec only)
 * @param {string} mimeType - Input MIME type
 * @returns {boolean} - True if conversion needed
 */
export function needsAudioConversion(mimeType) {
  // WhatsApp natively supported audio formats (NO conversion needed)
  const whatsappSupportedAudio = [
    'audio/aac',      // AAC - Supported ✅
    'audio/mp4',      // MP4 audio - Supported ✅
    'audio/mpeg',     // MP3 - Supported ✅
    'audio/amr',      // AMR - Supported ✅
    'audio/ogg'       // OGG (must be OPUS codec) - Supported ✅
  ];
  
  // Only convert if format is NOT natively supported
  // Examples that need conversion: audio/webm, audio/wav, audio/flac, etc.
  return !whatsappSupportedAudio.includes(mimeType);
}

/**
 * Get ffmpeg input format from MIME type
 * @param {string} mimeType - Input MIME type
 * @returns {string} - FFmpeg input format
 */
export function getFFmpegFormat(mimeType) {
  const formatMap = {
    'audio/webm': 'webm',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/wave': 'wav',
    'audio/mp3': 'mp3',
    'audio/mpeg': 'mp3',
    'audio/m4a': 'mp4',
    'audio/mp4': 'mp4',
    'audio/aac': 'aac',
    'audio/ogg': 'ogg',
    'audio/amr': 'amr'
  };
  
  return formatMap[mimeType] || 'webm'; // Default to webm if unknown
}
