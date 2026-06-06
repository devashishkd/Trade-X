import mongoose from 'mongoose';
import { createLogger } from '@trade-x/shared';

const logger = createLogger('market-data-service');

export const connectDB = async (): Promise<void> => {
  const uri = process.env.MONGO_URI ?? 'mongodb://localhost:27017/market-db';
  await mongoose.connect(uri);
  logger.info('MongoDB connected', { uri });
};
