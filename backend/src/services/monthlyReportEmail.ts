import nodemailer from 'nodemailer';
import AttendanceRecord from '../models/Attendance';
import AccessoryEntry from '../models/AccessoryEntry';
import PurchaseFollowup from '../models/PurchaseFollowup';
import PendingJob from '../models/PendingJob';
import ReportLog from '../models/ReportLog';

const PRESENT_CODES = new Set(['PR', 'WH', 'SD', 'OD', 'P']);
const LEAVE_CODES   = new Set(['AL', 'PL', 'SL', 'CO']);

function aed(n: number) {
  return 'AED ' + n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildHtml(data: {
  monthLabel: string;
  attRows: { name: string; present: number; leave: number; absent: number }[];
  accTotal: number;
  accCount: number;
  pendingPurchases: number;
  pendingJobs: number;
  appUrl: string;
}) {
  const { monthLabel, attRows, accTotal, accCount, pendingPurchases, pendingJobs, appUrl } = data;
  const totalPresent = attRows.reduce((s, r) => s + r.present, 0);
  const totalLeave   = attRows.reduce((s, r) => s + r.leave, 0);
  const totalAbsent  = attRows.reduce((s, r) => s + r.absent, 0);
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const attTableRows = attRows.map(r => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#1e293b;">${r.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;text-align:center;color:#16a34a;font-weight:700;">${r.present}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;text-align:center;color:#2563eb;font-weight:600;">${r.leave}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;text-align:center;color:#ef4444;font-weight:600;">${r.absent}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>E&amp;I Monthly Report — ${monthLabel}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:30px 0;">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.10);">

  <!-- HEADER -->
  <tr><td style="background:#1e3a5f;padding:28px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>
        <div style="color:#93c5fd;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:5px;">E&amp;I Maintenance Management System</div>
        <div style="color:#ffffff;font-size:21px;font-weight:800;line-height:1.2;">Monthly Management Report</div>
        <div style="color:#bfdbfe;font-size:14px;margin-top:5px;font-weight:600;">${monthLabel}</div>
      </td>
      <td align="right" valign="top">
        <div style="background:rgba(255,255,255,0.12);border-radius:10px;padding:10px 16px;text-align:center;min-width:100px;">
          <div style="color:#93c5fd;font-size:9px;font-weight:700;text-transform:uppercase;margin-bottom:3px;">Generated</div>
          <div style="color:#ffffff;font-size:12px;font-weight:600;">${today}</div>
        </div>
      </td>
    </tr></table>
  </td></tr>

  <!-- SUMMARY CARDS -->
  <tr><td style="padding:24px 32px 8px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="24%" style="padding-right:6px;">
        <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:10px;padding:14px 10px;text-align:center;">
          <div style="font-size:26px;font-weight:800;color:#16a34a;">${totalPresent}</div>
          <div style="font-size:9px;color:#15803d;font-weight:700;margin-top:3px;text-transform:uppercase;">Present Days</div>
        </div>
      </td>
      <td width="24%" style="padding-right:6px;">
        <div style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:10px;padding:14px 10px;text-align:center;">
          <div style="font-size:26px;font-weight:800;color:#2563eb;">${totalLeave}</div>
          <div style="font-size:9px;color:#1d4ed8;font-weight:700;margin-top:3px;text-transform:uppercase;">Leave Days</div>
        </div>
      </td>
      <td width="27%" style="padding-right:6px;">
        <div style="background:#fff7ed;border:1.5px solid #fed7aa;border-radius:10px;padding:14px 10px;text-align:center;">
          <div style="font-size:14px;font-weight:800;color:#c2410c;line-height:1.3;">${aed(accTotal)}</div>
          <div style="font-size:9px;color:#9a3412;font-weight:700;margin-top:3px;text-transform:uppercase;">Consumables</div>
        </div>
      </td>
      <td width="25%">
        <div style="background:#fdf4ff;border:1.5px solid #e9d5ff;border-radius:10px;padding:14px 10px;text-align:center;">
          <div style="font-size:26px;font-weight:800;color:#9333ea;">${pendingJobs}</div>
          <div style="font-size:9px;color:#7e22ce;font-weight:700;margin-top:3px;text-transform:uppercase;">Pending Jobs</div>
        </div>
      </td>
    </tr></table>
  </td></tr>

  <!-- ATTENDANCE TABLE -->
  <tr><td style="padding:16px 32px 0;">
    <div style="font-size:14px;font-weight:700;color:#1e293b;margin-bottom:10px;padding-bottom:8px;border-bottom:2px solid #e2e8f0;">
      &#128119; Employee Attendance — ${monthLabel}
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <tr style="background:#f8fafc;">
        <th style="padding:9px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:700;border-bottom:1px solid #e2e8f0;">EMPLOYEE</th>
        <th style="padding:9px 12px;text-align:center;font-size:11px;color:#16a34a;font-weight:700;border-bottom:1px solid #e2e8f0;">PRESENT</th>
        <th style="padding:9px 12px;text-align:center;font-size:11px;color:#2563eb;font-weight:700;border-bottom:1px solid #e2e8f0;">LEAVE</th>
        <th style="padding:9px 12px;text-align:center;font-size:11px;color:#ef4444;font-weight:700;border-bottom:1px solid #e2e8f0;">ABSENT</th>
      </tr>
      ${attTableRows || '<tr><td colspan="4" style="padding:16px;text-align:center;color:#94a3b8;font-size:13px;">No attendance records for this month</td></tr>'}
      <tr style="background:#f8fafc;">
        <td style="padding:9px 12px;font-size:13px;font-weight:700;color:#1e293b;border-top:2px solid #e2e8f0;">TOTAL</td>
        <td style="padding:9px 12px;text-align:center;font-size:13px;font-weight:800;color:#16a34a;border-top:2px solid #e2e8f0;">${totalPresent}</td>
        <td style="padding:9px 12px;text-align:center;font-size:13px;font-weight:800;color:#2563eb;border-top:2px solid #e2e8f0;">${totalLeave}</td>
        <td style="padding:9px 12px;text-align:center;font-size:13px;font-weight:800;color:#ef4444;border-top:2px solid #e2e8f0;">${totalAbsent}</td>
      </tr>
    </table>
  </td></tr>

  <!-- PURCHASE + CONSUMABLES -->
  <tr><td style="padding:20px 32px 0;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="49%" valign="top" style="padding-right:10px;">
        <div style="font-size:14px;font-weight:700;color:#1e293b;margin-bottom:10px;padding-bottom:8px;border-bottom:2px solid #e2e8f0;">
          &#128722; Purchase Status
        </div>
        <div style="background:#fefce8;border:1.5px solid #fde68a;border-radius:10px;padding:16px;">
          <div style="font-size:30px;font-weight:800;color:#d97706;">${pendingPurchases}</div>
          <div style="font-size:11px;color:#92400e;font-weight:700;margin-top:2px;">PENDING PURCHASE ITEMS</div>
          <div style="font-size:11px;color:#78716c;margin-top:6px;">Items not yet received or approved</div>
        </div>
      </td>
      <td width="49%" valign="top">
        <div style="font-size:14px;font-weight:700;color:#1e293b;margin-bottom:10px;padding-bottom:8px;border-bottom:2px solid #e2e8f0;">
          &#9981; Accessories &amp; Consumables
        </div>
        <div style="background:#fff7ed;border:1.5px solid #fed7aa;border-radius:10px;padding:16px;">
          <div style="font-size:18px;font-weight:800;color:#c2410c;">${aed(accTotal)}</div>
          <div style="font-size:11px;color:#9a3412;font-weight:700;margin-top:2px;">${accCount} ENTRIES THIS MONTH</div>
          <div style="font-size:11px;color:#78716c;margin-top:6px;">Diesel, oil, batteries and consumables</div>
        </div>
      </td>
    </tr></table>
  </td></tr>

  <!-- CTA -->
  <tr><td style="padding:24px 32px;">
    <div style="text-align:center;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:22px;">
      <div style="font-size:13px;color:#64748b;margin-bottom:14px;">View the complete report with all sections, charts and PDF export</div>
      <a href="${appUrl}/reports" style="background:#1e3a5f;color:#ffffff;text-decoration:none;padding:13px 30px;border-radius:8px;font-size:13px;font-weight:700;display:inline-block;letter-spacing:0.3px;">&#128196; Open Full Report</a>
    </div>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#1e293b;padding:16px 32px;text-align:center;border-radius:0 0 14px 14px;">
    <div style="color:#94a3b8;font-size:11px;">E&amp;I Maintenance Management System &bull; Glass Technology (MENA) L.L.C &bull; Sharjah, UAE</div>
    <div style="color:#475569;font-size:10px;margin-top:5px;">This report is auto-generated on the 1st of every month.</div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

export async function sendMonthlyReport(year: number, month: number, force = false) {
  if (!process.env.MAIL_USER || !process.env.MAIL_PASS || !process.env.MAIL_TO) {
    throw new Error('Email not configured. Set MAIL_USER, MAIL_PASS, MAIL_TO on Render.');
  }

  // Prevent duplicate sends for the same month
  if (!force) {
    const alreadySent = await ReportLog.findOne({ year, month });
    if (alreadySent) {
      console.log(`⏭  Monthly report already sent for ${year}/${month} at ${alreadySent.sentAt}`);
      return { skipped: true, sentAt: alreadySent.sentAt };
    }
  }

  const from = new Date(year, month - 1, 1);
  const to   = new Date(year, month, 0, 23, 59, 59, 999);
  const monthLabel = from.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const [attRecords, accEntries, allFollowups, pendingJobs] = await Promise.all([
    AttendanceRecord.find({ year, month }),
    AccessoryEntry.find({ entryDate: { $gte: from, $lte: to } }),
    PurchaseFollowup.find({}),
    PendingJob.countDocuments({ status: { $nin: ['Completed', 'Cancelled'] } }),
  ]);

  const attRows = attRecords.map(rec => ({
    name:    rec.empName,
    present: rec.entries.filter(e => PRESENT_CODES.has(e.code)).length,
    leave:   rec.entries.filter(e => LEAVE_CODES.has(e.code)).length,
    absent:  rec.entries.filter(e => e.code === 'A').length,
  }));

  const accTotal         = accEntries.reduce((s, e) => s + (e.totalCost || 0), 0);
  const pendingPurchases = (allFollowups as any[]).filter(r =>
    !['Material Received', 'Rejected'].includes(r.currentStatus || '')
  ).length;

  const appUrl = (process.env.CLIENT_URL || 'https://glass-technology-mms.vercel.app').replace(/\/$/, '');
  const html   = buildHtml({ monthLabel, attRows, accTotal, accCount: accEntries.length, pendingPurchases, pendingJobs, appUrl });

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
  });

  await transporter.sendMail({
    from: `"E&I MMS" <${process.env.MAIL_USER}>`,
    to: process.env.MAIL_TO,
    subject: `📊 E&I Monthly Management Report — ${monthLabel}`,
    html,
  });

  await ReportLog.findOneAndUpdate(
    { year, month },
    { year, month, sentAt: new Date(), to: process.env.MAIL_TO },
    { upsert: true }
  );

  console.log(`✅ Monthly report sent for ${monthLabel} to ${process.env.MAIL_TO}`);
  return { skipped: false, monthLabel, to: process.env.MAIL_TO };
}
