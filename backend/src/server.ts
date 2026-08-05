import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import app from './app';

dns.setServers(['8.8.8.8', '8.8.4.4']);

const PORT = process.env.PORT || 5001;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mms_db';

async function start() {
  try {
    await mongoose.connect(MONGO_URI, { family: 4 });
    console.log('✅ Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`🚀 MMS Server running on http://localhost:${PORT}`);
      console.log(`📊 E&I Maintenance Management System v2.0.0`);
    });
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB:', err);
    process.exit(1);
  }
}

start();
