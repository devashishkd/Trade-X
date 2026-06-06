import mongoose from 'mongoose';
import { createLogger } from '@trade-x/shared';

const logger = createLogger('portfolio-service');

export const connectDB = async (): Promise<void> => {
  const uri = process.env.MONGO_URI ?? 'mongodb://localhost:27017/portfolio-db';
  try {
    await mongoose.connect(uri);
    logger.info('MongoDB connected', { uri });
  } catch (err) {
    logger.error('MongoDB connection failed', { err });
    throw err;
  }
};
