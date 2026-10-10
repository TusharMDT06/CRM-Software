import mongoose from 'mongoose';

export async function connectDB(uri?: string): Promise<void> {
  const mongoUri = uri || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/flowdesk';
  try {
    await mongoose.connect(mongoUri);
    console.log(`[Database] Connected to MongoDB: ${mongoUri}`);
  } catch (error) {
    console.error('[Database] Connection failed:', error);
    throw error;
  }
}
