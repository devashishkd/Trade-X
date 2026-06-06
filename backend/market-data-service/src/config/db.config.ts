import mongoose from 'mongoose';
import { createLogger } from '@trade-x/shared';

const logger = createLogger('market-data-service');

export const connectDB = async (): Promise<void> => {
  const uri = process.env.MONGO_URI ?? 'mongodb+srv://trade-x:Devashish%4010@cluster0.9fcja5p.mongodb.net/market-db';
  await mongoose.connect(uri);
  logger.info('MongoDB connected', { uri });
};
