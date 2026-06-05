import mongoose from 'mongoose';
import { createLogger } from '@trade-x/shared';

const logger = createLogger('order-service');

export const connectDB = async (): Promise<void> => {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI environment variable is required');

  mongoose.connection.on('connected',    () => logger.info('Connected to order-db'));
  mongoose.connection.on('error',        (err) => logger.error('MongoDB error', { err }));
  mongoose.connection.on('disconnected', () => logger.warn('Disconnected from order-db'));

  await mongoose.connect(uri, {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
  });
};
