import { Router } from 'express';
import { sendMonthlyReport } from '../services/monthlyReportEmail';
import ReportLog from '../models/ReportLog';

const router = Router();

// POST /api/report-email/send  — manual trigger (from Reports page "Send Now" button)
router.post('/send', async (req, res) => {
  try {
    const now   = new Date();
    const year  = Number(req.body?.year)  || now.getFullYear();
    const month = Number(req.body?.month) || now.getMonth() + 1;
    const force = req.body?.force === true;

    if (month < 1 || month > 12) return res.status(400).json({ message: 'Invalid month.' });

    const result = await sendMonthlyReport(year, month, force);
    if ((result as any).skipped) {
      return res.json({ message: 'Report already sent for this month. Use force:true to resend.', ...result });
    }
    res.json({ message: `Monthly report sent to ${(result as any).to}`, ...result });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to send report.' });
  }
});

// GET /api/report-email/status — check email config + recent sends
router.get('/status', async (_req, res) => {
  const configured = !!(process.env.MAIL_USER && process.env.MAIL_PASS && process.env.MAIL_TO);
  const logs = await ReportLog.find().sort({ year: -1, month: -1 }).limit(6);
  res.json({ configured, mailTo: process.env.MAIL_TO || null, logs });
});

export default router;
