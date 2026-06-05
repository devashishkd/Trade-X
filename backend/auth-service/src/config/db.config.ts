import mongoose from 'mongoose';
import { createLogger } from '@trade-x/shared';

const logger = createLogger('auth-service');

export const connectDB = async (): Promise<void> => {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI environment variable is required');

  mongoose.connection.on('connected', () => logger.info('Connected to auth-db'));
  mongoose.connection.on('error',     (err) => logger.error('MongoDB error', { err }));
  mongoose.connection.on('disconnected', () => logger.warn('Disconnected from auth-db'));

  await mongoose.connect(uri, {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });
};
