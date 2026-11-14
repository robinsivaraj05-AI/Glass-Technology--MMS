import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import cron from 'node-cron';
import app from './app';
import { sendMonthlyReport } from './services/monthlyReportEmail';

dns.setServers(['8.8.8.8', '8.8.4.4']);

const PORT = process.env.PORT || 5001;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mms_db';

async function start() {
  try {
    await mongoose.connect(MONGO_URI, { family: 4 });
    console.log('✅ Connected to MongoDB');

    // Auto-send monthly report on the 1st of every month at 08:00 AM (UTC+4 = 04:00 UTC)
    cron.schedule('0 4 1 * *', async () => {
      const now = new Date();
      console.log(`⏰ Cron: sending monthly report for ${now.getFullYear()}/${now.getMonth() + 1}`);
      try {
        await sendMonthlyReport(now.getFullYear(), now.getMonth() + 1);
      } catch (err: any) {
        console.error('❌ Monthly report cron error:', err.message);
      }
    });

    // Startup catch-up: if today is the 1st and report hasn't been sent yet, send it
    const now = new Date();
    if (now.getDate() === 1) {
      setTimeout(async () => {
        try {
          await sendMonthlyReport(now.getFullYear(), now.getMonth() + 1);
        } catch (err: any) {
          console.error('❌ Startup report check error:', err.message);
        }
      }, 10000); // 10s delay to let DB settle
    }

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
