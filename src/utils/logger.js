import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info'
  // Note: pino-pretty is not included in dependencies for production
  // For local development, install pino-pretty separately if needed
});
