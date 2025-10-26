import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

let supabase;
let useLocalStorage = false;

export function initializeStorage() {
  if (supabase) return supabase;

  try {
    // Check if we have Supabase credentials
    if (!config.supabase.url || !config.supabase.serviceKey || !config.supabase.bucketName) {
      logger.warn('Supabase credentials not found, using local storage for development');
      useLocalStorage = true;
      return null;
    }

    supabase = createClient(config.supabase.url, config.supabase.serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    logger.info('Supabase Storage initialized');
    return supabase;
  } catch (err) {
    logger.warn({ err }, 'Failed to initialize Supabase Storage, falling back to local storage');
    useLocalStorage = true;
    return null;
  }
}

/**
 * Upload buffer to Supabase Storage with organized folder structure
 */
export async function uploadBuffer({ buffer, filename, contentType, folder = 'media', roomId = null, phoneNumber = null }) {
  if (!supabase && !useLocalStorage) initializeStorage();
  const storedFilename = buildStoredFilename(filename, contentType);
  const fileId = uuidv4();
  
  // Create organized folder structure: room/date/file
  const storagePath = generateOrganizedPath({ folder, roomId, phoneNumber, storedFilename });

  // Use local storage fallback for development
  if (useLocalStorage || !supabase) {
    return await uploadToLocalStorage({ buffer, gcsFilename: storagePath, contentType });
  }

  try {
    // Validate buffer before upload
    if (!Buffer.isBuffer(buffer)) {
      throw new Error('Invalid buffer provided for upload');
    }
    
    if (buffer.length === 0) {
      throw new Error('Empty buffer provided for upload');
    }

    logger.info({ 
      storagePath, 
      originalName: filename, 
      contentType,
      bufferSize: buffer.length,
      bufferType: buffer.constructor.name
    }, 'Starting Supabase Storage upload');

    // Upload to Supabase Storage with timeout (30 seconds)
    const uploadPromise = supabase.storage
      .from(config.supabase.bucketName)
      .upload(storagePath, buffer, {
        contentType: contentType || 'application/octet-stream',
        cacheControl: '3600',
        upsert: false, // Prevent accidental overwrites  
        metadata: {
          originalName: filename || 'unknown',
          uploadedAt: new Date().toISOString(),
          size: buffer.length.toString()
        }
      });
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Supabase Storage upload timeout (30s)')), 30000)
    );
    
    const { data, error } = await Promise.race([uploadPromise, timeoutPromise]);

    if (error) {
      logger.error({ 
        error, 
        storagePath, 
        bufferSize: buffer.length,
        contentType 
      }, 'Supabase Storage upload failed');
      throw new Error(`Supabase upload error: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(config.supabase.bucketName)
      .getPublicUrl(storagePath);

    const url = urlData.publicUrl;

    logger.info({ 
      storagePath, 
      originalName: filename, 
      uploadedPath: data.path,
      publicUrl: url,
      size: buffer.length 
    }, 'File uploaded to Supabase Storage successfully');

    return {
      fileId,
      gcsFilename: storagePath, // Keep same property name for compatibility
      originalFilename: filename,
      contentType,
      size: buffer.length,
      url,
      bucket: config.supabase.bucketName,
      uploadedPath: data.path
    };
  } catch (err) {
    logger.error({ 
      err, 
      storagePath, 
      originalName: filename,
      bufferSize: buffer?.length,
      contentType 
    }, 'Failed to upload to Supabase Storage');
    throw err;
  }
}

/**
 * Upload stream to Supabase Storage with organized folder structure
 */
export async function uploadStream({ stream, filename, contentType, folder = 'media', roomId = null, phoneNumber = null }) {
  if (!supabase && !useLocalStorage) initializeStorage();

  const storedFilename = buildStoredFilename(filename, contentType);
  const fileId = uuidv4();
  
  // Create organized folder structure: room/date/file
  const storagePath = generateOrganizedPath({ folder, roomId, phoneNumber, storedFilename });
  
  return new Promise((resolve, reject) => {
    const chunks = [];
    
    stream.on('data', (chunk) => {
      chunks.push(chunk);
    });
    
    stream.on('end', async () => {
      try {
        const buffer = Buffer.concat(chunks);
        
        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
          .from(config.supabase.bucketName)
          .upload(storagePath, buffer, {
            contentType,
            metadata: {
              originalName: filename || 'unknown',
              uploadedAt: new Date().toISOString()
            }
          });

        if (error) {
          throw new Error(`Supabase upload error: ${error.message}`);
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from(config.supabase.bucketName)
          .getPublicUrl(storagePath);

        const url = urlData.publicUrl;

        logger.info({ storagePath, originalName: filename }, 'File streamed to Supabase Storage');

        resolve({
          fileId,
          gcsFilename: storagePath, // Keep same property name for compatibility
          originalFilename: filename,
          contentType,
          size: buffer.length,
          url,
          bucket: config.supabase.bucketName
        });
      } catch (err) {
        reject(err);
      }
    });
    
    stream.on('error', reject);
  });
}

/**
 * Delete file from Supabase Storage
 */
export async function deleteFile(storagePath) {
  if (!supabase) initializeStorage();

  try {
    const { error } = await supabase.storage
      .from(config.supabase.bucketName)
      .remove([storagePath]);

    if (error) {
      throw new Error(`Supabase delete error: ${error.message}`);
    }

    logger.info({ storagePath }, 'File deleted from Supabase Storage');
    return { success: true };
  } catch (err) {
    logger.error({ err, storagePath }, 'Failed to delete from Supabase Storage');
    throw err;
  }
}

/**
 * Generate a new signed URL for an existing file
 */
export async function generateSignedUrl(storagePath, expiresInDays = 7) {
  if (!supabase && !useLocalStorage) initializeStorage();

  try {
    // Create signed URL for Supabase Storage
    const { data, error } = await supabase.storage
      .from(config.supabase.bucketName)
      .createSignedUrl(storagePath, expiresInDays * 24 * 60 * 60); // Convert to seconds

    if (error) {
      logger.warn({ err: error.message, storagePath }, 'Signed URL failed, using public URL');
      // Fallback to public URL
      const { data: urlData } = supabase.storage
        .from(config.supabase.bucketName)
        .getPublicUrl(storagePath);
      return urlData.publicUrl;
    }

    return data.signedUrl;
  } catch (err) {
    logger.warn({ err: err?.message, storagePath }, 'Signed URL failed, attempting public URL fallback');
    const { data: urlData } = supabase.storage
      .from(config.supabase.bucketName)
      .getPublicUrl(storagePath);
    return urlData.publicUrl;
  }
}

/**
 * Check if file exists in Supabase Storage
 */
export async function fileExists(storagePath) {
  if (!supabase && !useLocalStorage) initializeStorage();

  try {
    const { data, error } = await supabase.storage
      .from(config.supabase.bucketName)
      .list(path.dirname(storagePath), {
        search: path.basename(storagePath)
      });

    if (error) {
      logger.error({ err: error, storagePath }, 'Failed to check file existence');
      return false;
    }

    return data && data.length > 0;
  } catch (err) {
    logger.error({ err, storagePath }, 'Failed to check file existence');
    return false;
  }
}

/**
 * Get file metadata from Supabase Storage
 */
export async function getFileMetadata(storagePath) {
  if (!supabase && !useLocalStorage) initializeStorage();

  try {
    const { data, error } = await supabase.storage
      .from(config.supabase.bucketName)
      .list(path.dirname(storagePath), {
        search: path.basename(storagePath)
      });

    if (error || !data || data.length === 0) {
      throw new Error(`File not found: ${storagePath}`);
    }

    const fileData = data[0];
    return {
      name: fileData.name,
      size: fileData.metadata?.size || 0,
      contentType: fileData.metadata?.mimetype || 'application/octet-stream',
      created: fileData.created_at,
      updated: fileData.updated_at,
      id: fileData.id
    };
  } catch (err) {
    logger.error({ err, storagePath }, 'Failed to get file metadata');
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
  if (!supabase) initializeStorage();

  // Since roomId = phone number, use roomId directly
  const phoneFolder = cleanPhoneNumber(roomId || phoneNumber);
  const dateFolder = date || new Date().toISOString().split('T')[0];
  const prefix = `${folder}/${phoneFolder}/${dateFolder}`;
  
  try {
    const { data, error } = await supabase.storage
      .from(config.supabase.bucketName)
      .list(prefix);

    if (error) {
      throw new Error(`Supabase list error: ${error.message}`);
    }
    
    const fileList = data.map(file => ({
      name: file.name,
      size: file.metadata?.size || 0,
      contentType: file.metadata?.mimetype || 'application/octet-stream',
      created: file.created_at,
      updated: file.updated_at
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
  if (!supabase) initializeStorage();

  // Since roomId = phone number, use roomId directly
  const phoneFolder = cleanPhoneNumber(roomId || phoneNumber);
  const prefix = `${folder}/${phoneFolder}`;
  
  try {
    const { data, error } = await supabase.storage
      .from(config.supabase.bucketName)
      .list(prefix);

    if (error) {
      throw new Error(`Supabase list error: ${error.message}`);
    }
    
    // Extract unique date folders
    const dates = new Set();
    data.forEach(item => {
      if (item.name && item.name.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dates.add(item.name);
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
  if (!supabase) initializeStorage();

  // Since roomId = phone number, use roomId directly
  const phoneFolder = cleanPhoneNumber(roomId || phoneNumber || 'unknown');
  const prefix = `${folder}/${phoneFolder}`;
  
  try {
    // Get all files recursively from the phone folder
    const { data, error } = await supabase.storage
      .from(config.supabase.bucketName)
      .list(prefix, {
        limit: 1000, // Adjust based on expected file count
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (error) {
      throw new Error(`Supabase list error: ${error.message}`);
    }
    
    let totalSize = 0;
    let totalFiles = 0;
    const typeCount = {};
    
    // Note: Supabase Storage list may not return all nested files in one call
    // For a more complete implementation, you might need to recursively list subdirectories
    data.forEach(file => {
      if (file.metadata?.size) {
        totalSize += parseInt(file.metadata.size);
      }
      totalFiles++;
      
      const contentType = file.metadata?.mimetype || 'unknown';
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
function generateOrganizedPath({ folder, roomId, phoneNumber, storedFilename }) {
  const now = new Date();
  const dateFolder = now.toISOString().split('T')[0]; // YYYY-MM-DD format
  
  // Since roomId = phone number, use roomId directly as phone folder
  const phoneFolder = cleanPhoneNumber(roomId || phoneNumber || 'unknown');
  return `${folder}/${phoneFolder}/${dateFolder}/${storedFilename}`;
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
    
    logger.info({ storagePath: gcsFilename, size: fileStats.size }, 'File uploaded to local storage');
    
    return {
      gcsFilename, // Keep for compatibility
      url: localUrl,
      size: fileStats.size,
      contentType
    };
    
  } catch (err) {
    logger.error({ err, storagePath: gcsFilename }, 'Failed to upload to local storage');
    throw err;
  }
}

/**
 * Build stored filename using original name, preserving base and extension,
 * and appending a short uuid/timestamp to avoid collisions.
 */
function buildStoredFilename(originalName, contentType) {
  const safeName = cleanFilename(originalName) || 'file';
  const extFromName = path.extname(safeName);
  const base = extFromName ? safeName.slice(0, -extFromName.length) : safeName;
  const ext = extFromName || getExtensionFromMimeType(contentType) || '';
  const suffix = `_${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0,14)}_${uuidv4().slice(0,8)}`;
  return `${base}${suffix}${ext}`;
}

/** Sanitize a filename (keep letters, numbers, dash, underscore, dot) and trim length */
function cleanFilename(name) {
  if (!name) return '';
  // Replace spaces and illegal chars, collapse repeats, limit length
  const cleaned = name
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 120);
  return cleaned;
}

// These functions are no longer needed with Supabase Storage
// Public URLs are handled directly through supabase.storage.getPublicUrl()
