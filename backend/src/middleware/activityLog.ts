import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import ActivityLog from '../models/ActivityLog';
import User from '../models/User';

// API path (first segment after /api) → module name shown in the log
const MODULES: Record<string, string> = {
  'pending-jobs': 'Job Tracker', 'followup-jobs': 'Job Tracker – Follow-up', 'reminders': 'Job Tracker – Reminders',
  'purchase-followup': 'E&I Purchase Status', 'purchase-rfq': 'RFQ Management', 'purchase-po': 'PO Follow-up',
  'outsource': 'Outsource Work Entry', 'contracts': 'Contract Master',
  'equipment': 'Rental Equipment Master', 'equipment-entries': 'Rental Work Entry',
  'accessories': 'Rental Accessories', 'accessory-invoices': 'Accessory Invoice Scan',
  'employees': 'Employees', 'attendance': 'Attendance', 'overtime': 'Overtime', 'org-positions': 'Org Chart',
  'assets': 'Asset Management', 'machines': 'Master Data', 'calibration': 'Calibration', 'amc': 'AMC',
  'spare-parts': 'Spare Parts', 'breakdowns': 'Breakdowns', 'projects': 'Projects', 'quality': 'Quality / ISO',
  'report-email': 'Monthly Report E-mail', 'auth': 'Login & Users',
};
export const moduleOf = (path: string) => { const seg = path.split('/').filter(Boolean)[0] || ''; return MODULES[seg] || seg; };

const LABEL_FIELDS = ['description', 'itemDescription', 'title', 'subject', 'name', 'empName', 'rfqNo', 'poNo', 'prNumber', 'role', 'code', 'personName', 'equipmentName', 'contractNo', 'jobId'];
const SKIP_FIELDS = new Set(['_id', 'id', '__v', 'createdAt', 'updatedAt', 'statusHistory', 'password', 'paymentHistory', 'photo', 'file', 'fileData', 'documents']);

function labelOf(...objs: any[]): string {
  for (const o of objs) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) continue;
    for (const f of LABEL_FIELDS) if (typeof o[f] === 'string' && o[f].trim()) {
      const jobId = f !== 'jobId' && typeof o.jobId === 'string' && o.jobId ? `${o.jobId} · ` : '';   // e.g. "JOB-2026-300 · Replace bearing"
      return (jobId + o[f].trim()).slice(0, 140);
    }
  }
  return '';
}
// "assignedTo" → "Assigned To"
const nice = (k: string) => k.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/^./, c => c.toUpperCase());
function detailsOf(body: any): string {
  if (!body || typeof body !== 'object') return '';
  const parts: string[] = [];
  for (const [k, v] of Object.entries(body)) {
    if (SKIP_FIELDS.has(k)) continue;
    if (Array.isArray(v)) parts.push(`${nice(k)} (${v.length})`);
    else if (v === null || v === undefined || typeof v === 'object') parts.push(nice(k));
    else { const s = String(v); parts.push(s.length <= 40 ? `${nice(k)}: ${s || '(blank)'}` : nice(k)); }
    if (parts.length >= 10) { parts.push('…'); break; }
  }
  return parts.join(', ');
}

// API path → model, to keep the name of a record that is being deleted
const MODEL_OF: Record<string, string> = {
  'pending-jobs': 'PendingJob', 'followup-jobs': 'FollowupJob', 'reminders': 'Reminder',
  'purchase-followup': 'PurchaseFollowup', 'purchase-rfq': 'PurchaseRFQ', 'purchase-po': 'PurchasePO',
  'outsource': 'OutsourceEntry', 'contracts': 'Contract', 'equipment': 'Equipment', 'equipment-entries': 'EquipmentEntry',
  'accessories': 'AccessoryEntry', 'employees': 'Employee', 'org-positions': 'OrgPosition', 'assets': 'Asset',
  'spare-parts': 'SparePart', 'projects': 'Project', 'quality': 'QualityRecord', 'calibration': 'Calibration', 'breakdowns': 'Breakdown',
};
async function findRecord(path: string): Promise<any> {
  const [seg, id] = path.split('/').filter(Boolean);
  const model: any = MODEL_OF[seg] && mongoose.models[MODEL_OF[seg]];
  if (!model || !id) return null;
  try {
    return /^[0-9a-f]{24}$/i.test(id) ? await model.findById(id).lean() : await model.findOne({ $or: [{ id }, { posId: id }] }).lean();
  } catch { return null; }
}

// cache user names for 10 minutes
const names = new Map<string, { name: string; t: number }>();
async function userName(id: string): Promise<string> {
  const c = names.get(id);
  if (c && Date.now() - c.t < 600000) return c.name;
  try { const u: any = await User.findById(id); const n = u ? `${u.name} (${u.email})` : id; names.set(id, { name: n, t: Date.now() }); return n; }
  catch { return id; }
}

export async function logActivity(entry: { userId?: string; role?: string; userName?: string; module: string; action: string; item?: string; details?: string; path?: string; method?: string }) {
  try {
    await ActivityLog.create({ item: '', details: '', ...entry, userName: entry.userName || (entry.userId ? await userName(entry.userId) : '') });
  } catch (err: any) { console.error('activity log:', err?.message); }   // never break the request
}

// Records every successful change (POST / PUT / PATCH / DELETE) under /api
export async function recordActivity(req: Request, res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const user = (req as any).user;
  const path = req.path, body = req.body;
  const before = req.method === 'DELETE' ? await findRecord(path) : null;   // keep its name for the log
  let responseBody: any;
  const json = res.json.bind(res);
  res.json = (b: any) => { responseBody = b; return json(b); };
  res.on('finish', () => {
    if (res.statusCode >= 400) return;
    const action = /\/stage-date$/.test(path) ? 'Step date set'
      : req.method === 'POST' ? (/\/(seed|sync|reset|fix-[a-z]+)$/.test(path) ? 'Updated' : 'Created')
      : req.method === 'DELETE' ? 'Deleted' : 'Updated';
    const recordId = path.split('/').filter(Boolean)[1] || '';
    logActivity({
      userId: user?.id, role: user?.role, module: moduleOf(path), action,
      userName: user?.name ? `${user.name} (${user.email})` : undefined,
      item: labelOf(responseBody, before, body) || (recordId ? `#${recordId}` : ''),
      details: req.method === 'DELETE' ? '' : detailsOf(body), path: req.originalUrl.split('?')[0], method: req.method,
    });
  });
  next();
}
