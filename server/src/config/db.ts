import mongoose from 'mongoose';

export async function connectDB(uri?: string): Promise<void> {
  let mongoUri = uri || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/flowdesk';
  if (mongoUri.includes('<') && mongoUri.includes('>')) {
    mongoUri = 'mongodb://127.0.0.1:27017/flowdesk';
  }
  try {
    await mongoose.connect(mongoUri, { family: 4, serverSelectionTimeoutMS: 5000 });
    const maskedUri = mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
    console.log(`[Database] Connected to MongoDB: ${maskedUri}`);
  } catch (error: any) {
    const isLocal = mongoUri.includes('127.0.0.1') || mongoUri.includes('localhost');
    if (!isLocal) {
      console.warn(`[Database] Remote MongoDB connection failed (${error.message || 'Server selection timeout'}). Trying local MongoDB (mongodb://127.0.0.1:27017/flowdesk)...`);
      try {
        await mongoose.connect('mongodb://127.0.0.1:27017/flowdesk', { family: 4, serverSelectionTimeoutMS: 3000 });
        console.log('[Database] Connected successfully to local fallback MongoDB: mongodb://127.0.0.1:27017/flowdesk');
        return;
      } catch (fallbackError) {
        console.error('[Database] Local fallback also failed:', fallbackError);
      }
    }
    console.error('[Database] Connection failed:', error);
    throw error;
  }
}
