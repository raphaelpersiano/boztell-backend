import { Storage } from '@google-cloud/storage';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

let storage;
let useLocalStorage = false;

export function initializeStorage() {
  if (storage) return storage;

  try {
    // Check if we have GCS credentials
    if (!config.gcs.bucketName || (!config.gcs.keyFilename && !config.gcs.projectId)) {
      logger.warn('GCS credentials not found, using local storage for development');
      useLocalStorage = true;
      return null;
    }

    const storageConfig = {};
    
    if (config.gcs.keyFilename) {
      storageConfig.keyFilename = config.gcs.keyFilename;
    } else {
      // Use default credentials in Cloud Run
      storageConfig.projectId = config.gcs.projectId;
    }

    storage = new Storage(storageConfig);
    logger.info('Google Cloud Storage initialized');
    return storage;
  } catch (err) {
    logger.warn({ err }, 'Failed to initialize GCS, falling back to local storage');
    useLocalStorage = true;
    return null;
  }
}

/**
 * Upload buffer to GCS with organized folder structure
 */
export async function uploadBuffer({ buffer, filename, contentType, folder = 'media', roomId = null, phoneNumber = null }) {
  const fileId = uuidv4();
  const extension = path.extname(filename || '') || getExtensionFromMimeType(contentType);
  
  // Create organized folder structure: room/date/file
  const gcsFilename = generateOrganizedPath({ 
    folder, 
    roomId, 
    phoneNumber, 
    fileId, 
    extension 
  });

  // Use local storage fallback for development
  if (useLocalStorage || !storage) {
    return await uploadToLocalStorage({ buffer, gcsFilename, contentType });
  }

  // Use Google Cloud Storage
  const bucket = storage.bucket(config.gcs.bucketName);
  const file = bucket.file(gcsFilename);
  
  const metadata = {
    metadata: {
      originalName: filename || 'unknown',
      uploadedAt: new Date().toISOString(),
      contentType
    },
    contentType
  };

  try {
    await file.save(buffer, metadata);
    
    // Generate signed URL for access (valid for 7 days)
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    logger.info({ gcsFilename, originalName: filename }, 'File uploaded to GCS');

    return {
      fileId,
      gcsFilename,
      originalFilename: filename,
      contentType,
      size: buffer.length,
      url,
      bucket: config.gcs.bucketName
    };
  } catch (err) {
    logger.error({ err, gcsFilename }, 'Failed to upload to GCS');
    throw err;
  }
}

/**
 * Upload stream to GCS with organized folder structure
 */
export async function uploadStream({ stream, filename, contentType, folder = 'media', roomId = null, phoneNumber = null }) {
  if (!storage) initializeStorage();

  const bucket = storage.bucket(config.gcs.bucketName);
  const fileId = uuidv4();
  const extension = path.extname(filename || '') || getExtensionFromMimeType(contentType);
  
  // Create organized folder structure: room/date/file
  const gcsFilename = generateOrganizedPath({ 
    folder, 
    roomId, 
    phoneNumber, 
    fileId, 
    extension 
  });
  
  const file = bucket.file(gcsFilename);
  
  const metadata = {
    metadata: {
      originalName: filename || 'unknown',
      uploadedAt: new Date().toISOString(),
      contentType
    },
    contentType
  };

  return new Promise((resolve, reject) => {
    const writeStream = file.createWriteStream({
      metadata,
      resumable: false // For smaller files
    });

    writeStream.on('error', reject);
    writeStream.on('finish', async () => {
      try {
        // Get file metadata to determine size
        const [metadata] = await file.getMetadata();
        
        // Generate signed URL
        const [url] = await file.getSignedUrl({
          action: 'read',
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000
        });

        logger.info({ gcsFilename, originalName: filename }, 'File streamed to GCS');

        resolve({
          fileId,
          gcsFilename,
          originalFilename: filename,
          contentType,
          size: parseInt(metadata.size),
          url,
          bucket: config.gcs.bucketName
        });
      } catch (err) {
        reject(err);
      }
    });

    stream.pipe(writeStream);
  });
}

/**
 * Delete file from GCS
 */
export async function deleteFile(gcsFilename) {
  if (!storage) initializeStorage();

  const bucket = storage.bucket(config.gcs.bucketName);
  const file = bucket.file(gcsFilename);

  try {
    await file.delete();
    logger.info({ gcsFilename }, 'File deleted from GCS');
    return { success: true };
  } catch (err) {
    logger.error({ err, gcsFilename }, 'Failed to delete from GCS');
    throw err;
  }
}

/**
 * Generate a new signed URL for an existing file
 */
export async function generateSignedUrl(gcsFilename, expiresInDays = 7) {
  if (!storage) initializeStorage();

  const bucket = storage.bucket(config.gcs.bucketName);
  const file = bucket.file(gcsFilename);

  try {
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresInDays * 24 * 60 * 60 * 1000
    });

    return url;
  } catch (err) {
    logger.error({ err, gcsFilename }, 'Failed to generate signed URL');
    throw err;
  }
}

/**
 * Check if file exists in GCS
 */
export async function fileExists(gcsFilename) {
  if (!storage) initializeStorage();

  const bucket = storage.bucket(config.gcs.bucketName);
  const file = bucket.file(gcsFilename);

  try {
    const [exists] = await file.exists();
    return exists;
  } catch (err) {
    logger.error({ err, gcsFilename }, 'Failed to check file existence');
    return false;
  }
}

/**
 * Get file metadata from GCS
 */
export async function getFileMetadata(gcsFilename) {
  if (!storage) initializeStorage();

  const bucket = storage.bucket(config.gcs.bucketName);
  const file = bucket.file(gcsFilename);

  try {
    const [metadata] = await file.getMetadata();
    return {
      name: metadata.name,
      size: parseInt(metadata.size),
      contentType: metadata.contentType,
      created: metadata.timeCreated,
      updated: metadata.updated,
      md5Hash: metadata.md5Hash,
      crc32c: metadata.crc32c
    };
  } catch (err) {
    logger.error({ err, gcsFilename }, 'Failed to get file metadata');
    throw err;
  }
}

/**
 * Get extension from MIME type
 */
/**
 * List files in a specific phone number folder and date
 */
export async function listMediaFiles({ roomId, phoneNumber, date, folder = 'media' }) {
  if (!storage) initializeStorage();

  const bucket = storage.bucket(config.gcs.bucketName);
  
  // Since roomId = phone number, use roomId directly
  const phoneFolder = cleanPhoneNumber(roomId || phoneNumber);
  const dateFolder = date || new Date().toISOString().split('T')[0];
  const prefix = `${folder}/${phoneFolder}/${dateFolder}/`;
  
  try {
    const [files] = await bucket.getFiles({ prefix });
    
    const fileList = files.map(file => ({
      name: file.name,
      size: file.metadata.size,
      contentType: file.metadata.contentType,
      created: file.metadata.timeCreated,
      updated: file.metadata.updated
    }));
    
    logger.info({ phoneNumber: phoneFolder, date: dateFolder, count: fileList.length }, 'Listed media files');
    return fileList;
    
  } catch (err) {
    logger.error({ err, phoneNumber: phoneFolder, date: dateFolder }, 'Failed to list media files');
    throw err;
  }
}

/**
 * Get folder structure for a phone number (list all dates with media)
 */
export async function getRoomMediaDates({ roomId, phoneNumber, folder = 'media' }) {
  if (!storage) initializeStorage();

  const bucket = storage.bucket(config.gcs.bucketName);
  
  // Since roomId = phone number, use roomId directly
  const phoneFolder = cleanPhoneNumber(roomId || phoneNumber);
  const prefix = `${folder}/${phoneFolder}/`;
  
  try {
    const [files] = await bucket.getFiles({ prefix });
    
    // Extract unique date folders
    const dates = new Set();
    files.forEach(file => {
      const pathParts = file.name.replace(prefix, '').split('/');
      if (pathParts.length >= 2 && pathParts[0].match(/^\d{4}-\d{2}-\d{2}$/)) {
        dates.add(pathParts[0]);
      }
    });
    
    const sortedDates = Array.from(dates).sort().reverse(); // Most recent first
    
    logger.info({ phoneNumber: phoneFolder, dates: sortedDates.length }, 'Retrieved phone number media dates');
    return sortedDates;
    
  } catch (err) {
    logger.error({ err, phoneNumber: phoneFolder }, 'Failed to get phone number media dates');
    throw err;
  }
}

/**
 * Get media usage statistics for a room
 */
export async function getRoomMediaStats({ roomId, phoneNumber, folder = 'media' }) {
  if (!storage) initializeStorage();

  const bucket = storage.bucket(config.gcs.bucketName);
  
  // Since roomId = phone number, use roomId directly
  const phoneFolder = cleanPhoneNumber(roomId || phoneNumber || 'unknown');
  const prefix = `${folder}/${phoneFolder}/`;
  
  try {
    const [files] = await bucket.getFiles({ prefix });
    
    let totalSize = 0;
    let totalFiles = 0;
    const typeCount = {};
    
    files.forEach(file => {
      totalSize += parseInt(file.metadata.size || 0);
      totalFiles++;
      
      const contentType = file.metadata.contentType || 'unknown';
      const mediaType = contentType.split('/')[0]; // image, video, audio, etc.
      typeCount[mediaType] = (typeCount[mediaType] || 0) + 1;
    });
    
    const stats = {
      phoneNumber: phoneFolder,
      totalFiles,
      totalSize,
      totalSizeHuman: formatBytes(totalSize),
      mediaTypes: typeCount,
      lastUpdated: new Date().toISOString()
    };
    
    logger.info({ phoneNumber: phoneFolder, stats }, 'Retrieved phone number media statistics');
    return stats;
    
  } catch (err) {
    logger.error({ err, phoneNumber: phoneFolder }, 'Failed to get phone number media stats');
    throw err;
  }
}

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
/**
 * Generate organized path structure for GCS storage
 * Structure: folder/phone_number/YYYY-MM-DD/fileId.ext
 * Since 1 room = 1 phone number, we use phone number directly as folder
 */
function generateOrganizedPath({ folder, roomId, phoneNumber, fileId, extension }) {
  const now = new Date();
  const dateFolder = now.toISOString().split('T')[0]; // YYYY-MM-DD format
  
  // Since roomId = phone number, use roomId directly as phone folder
  const phoneFolder = cleanPhoneNumber(roomId || phoneNumber || 'unknown');
  
  return `${folder}/${phoneFolder}/${dateFolder}/${fileId}${extension}`;
}

/**
 * Clean phone number for use as folder name
 */
function cleanPhoneNumber(phone) {
  if (!phone) return 'unknown';
  
  // Remove non-digit characters and clean up
  const cleaned = phone.replace(/[^\d]/g, '');
  
  // If it looks like a phone number (10-15 digits), use it
  if (cleaned.length >= 10 && cleaned.length <= 15) {
    return cleaned;
  }
  
  // Otherwise, clean as general folder name
  return phone
    .replace(/[^a-zA-Z0-9\-_]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 50);
}

/**
 * Extract phone number from room ID 
 * Since room ID = phone number in our simplified approach, just clean and return it
 */
function extractPhoneFromRoomId(roomId) {
  // In our simplified approach, roomId is the phone number itself
  return cleanPhoneNumber(roomId);
}

/**
 * Get extension from MIME type
 */
function getExtensionFromMimeType(mimeType) {
  const mimeExtensions = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/mpeg': '.mpeg',
    'video/quicktime': '.mov',
    'audio/mpeg': '.mp3',
    'audio/mp4': '.m4a',
    'audio/wav': '.wav',
    'audio/ogg': '.ogg',
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'text/plain': '.txt',
    'text/csv': '.csv'
  };

  return mimeExtensions[mimeType] || '';
}

/**
 * Local storage fallback for development
 */
async function uploadToLocalStorage({ buffer, gcsFilename, contentType }) {
  try {
    const localDir = path.join(process.cwd(), 'uploads');
    const fullPath = path.join(localDir, gcsFilename);
    const dir = path.dirname(fullPath);
    
    // Create directory if it doesn't exist
    await fs.mkdir(dir, { recursive: true });
    
    // Write file
    await fs.writeFile(fullPath, buffer);
    
    const fileStats = await fs.stat(fullPath);
    const localUrl = `http://localhost:${config.port}/uploads/${gcsFilename}`;
    
    logger.info({ gcsFilename, size: fileStats.size }, 'File uploaded to local storage');
    
    return {
      gcsFilename,
      url: localUrl,
      size: fileStats.size,
      contentType
    };
    
  } catch (err) {
    logger.error({ err, gcsFilename }, 'Failed to upload to local storage');
    throw err;
  }
}
