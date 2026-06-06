import mongoose from 'mongoose';
import { createLogger } from '@trade-x/shared';

const logger = createLogger('portfolio-service');

export const connectDB = async (): Promise<void> => {
  const uri = process.env.MONGO_URI ?? 'mongodb+srv://trade-x:Devashish%4010@cluster0.9fcja5p.mongodb.net/portfolio-db';
  try {
    await mongoose.connect(uri);
    logger.info('MongoDB connected', { uri });
  } catch (err) {
    logger.error('MongoDB connection failed', { err });
    throw err;
  }
};
