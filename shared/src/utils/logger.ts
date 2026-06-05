import winston from 'winston';

export const createLogger = (serviceName: string): winston.Logger =>
  winston.createLogger({
    level: process.env.LOG_LEVEL ?? 'info',
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
    ),
    defaultMeta: { service: serviceName },
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(
            ({ timestamp, level, message, service, ...meta }) =>
              `${timestamp} [${service}] ${level}: ${message}` +
              (Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : ''),
          ),
        ),
      }),
    ],
  });
