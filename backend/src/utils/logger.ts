import pino from 'pino';

/**
 * Structured logging service
 * Requirement 9.8: Structured logging formatted as JSON in production
 */

export const logger = pino({
  level: process.env['LOG_LEVEL'] || 'info',
  transport: process.env['NODE_ENV'] !== 'production' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
    },
  } : undefined,
});
