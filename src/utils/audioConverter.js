import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import { Readable } from 'stream';
import { logger } from './logger.js';

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath.path);

/**
 * Convert audio buffer to OGG format with Opus codec
 * @param {Buffer} inputBuffer - Input audio buffer (WebM, MP3, WAV, etc.)
 * @param {string} inputFormat - Input format (webm, mp3, wav, etc.)
 * @returns {Promise<Buffer>} - Output OGG buffer with Opus codec
 */
export async function convertAudioToOgg(inputBuffer, inputFormat = 'webm') {
  return new Promise((resolve, reject) => {
    try {
      logger.info({ 
        inputSize: inputBuffer.length,
        inputFormat 
      }, 'Starting audio conversion to OGG (Opus codec)');

      const chunks = [];
      const inputStream = Readable.from(inputBuffer);
      
      ffmpeg(inputStream)
        .inputFormat(inputFormat)
        .audioCodec('libopus') // Opus codec for OGG
        .audioBitrate('128k') // 128kbps - good quality for voice
        .audioChannels(1) // Mono for voice notes
        .audioFrequency(48000) // 48kHz sample rate (Opus standard)
        .format('ogg')
        .on('start', (commandLine) => {
          logger.info({ commandLine }, 'FFmpeg conversion started');
        })
        .on('progress', (progress) => {
          logger.debug({ progress }, 'FFmpeg conversion progress');
        })
        .on('end', () => {
          const outputBuffer = Buffer.concat(chunks);
          logger.info({ 
            inputSize: inputBuffer.length,
            outputSize: outputBuffer.length,
            compressionRatio: ((1 - outputBuffer.length / inputBuffer.length) * 100).toFixed(2) + '%'
          }, 'Audio conversion completed successfully');
          resolve(outputBuffer);
        })
        .on('error', (err, stdout, stderr) => {
          logger.error({ 
            err, 
            stdout, 
            stderr,
            inputFormat,
            inputSize: inputBuffer.length
          }, 'FFmpeg conversion failed');
          reject(new Error(`Audio conversion failed: ${err.message}`));
        })
        .pipe()
        .on('data', (chunk) => {
          chunks.push(chunk);
        });
        
    } catch (err) {
      logger.error({ err }, 'Failed to start audio conversion');
      reject(err);
    }
  });
}

/**
 * Check if audio format needs conversion for WhatsApp
 * @param {string} mimeType - Input MIME type
 * @returns {boolean} - True if conversion needed
 */
export function needsAudioConversion(mimeType) {
  const whatsappSupportedAudio = [
    'audio/aac',
    'audio/mp4',
    'audio/mpeg',
    'audio/amr',
    'audio/ogg'
  ];
  
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
