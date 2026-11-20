import { Router } from 'express';
import PurchaseFollowup from '../models/PurchaseFollowup';

const router = Router();

// Status names were reorganised into an ordered workflow; rename old values once.
const LEGACY_STATUS: Record<string, string> = {
  'Technical Review': 'Technical Review Under Progress',
  'Rejected': 'Rejected Material / PO',
};
let migrated = false;
async function migrateLegacyStatuses() {
  if (migrated) return;
  for (const [oldName, newName] of Object.entries(LEGACY_STATUS)) {
    await PurchaseFollowup.updateMany({ currentStatus: oldName }, { $set: { currentStatus: newName } });
    await PurchaseFollowup.updateMany({ 'statusHistory.status': oldName }, { $set: { 'statusHistory.$[h].status': newName } }, { arrayFilters: [{ 'h.status': oldName }] });
    await PurchaseFollowup.updateMany({ 'statusHistory.from': oldName }, { $set: { 'statusHistory.$[h].from': newName } }, { arrayFilters: [{ 'h.from': oldName }] });
  }
  migrated = true;
}
const normalise = (s: unknown) => (typeof s === 'string' ? (LEGACY_STATUS[s] ?? s) : s);

router.get('/', async (req, res) => {
  try {
    await migrateLegacyStatuses();
    const list = await PurchaseFollowup.find().lean().sort({ createdAt: 1 });
    res.json(list.map((r: any) => ({ ...r, id: r._id.toString() })));
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

router.post('/', async (req, res) => {
  try {
    const { statusHistory: _ignored, ...body } = req.body || {};
    body.currentStatus = normalise(body.currentStatus);
    const doc = new PurchaseFollowup(body);
    if (body.currentStatus) (doc as any).statusHistory = [{ status: body.currentStatus, from: '', at: new Date() }];
    await doc.save();
    const obj = doc.toObject() as any;
    res.status(201).json({ ...obj, id: obj._id.toString() });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    // History is written by the server only — never taken from the client
    const { statusHistory: _ignored, ...body } = req.body || {};
    const existing: any = await PurchaseFollowup.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ message: 'Record not found' });
    const update: any = { $set: body };
    if (body.currentStatus !== undefined) {
      body.currentStatus = normalise(body.currentStatus);
      const before = normalise(existing.currentStatus || '');
      if (body.currentStatus !== before) {
        update.$push = { statusHistory: { status: body.currentStatus, from: before, at: new Date() } };
      }
    }
    const doc = await PurchaseFollowup.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    const obj = doc.toObject() as any;
    res.json({ ...obj, id: obj._id.toString() });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// PATCH /:id/stage-date { status, date } — set the date a workflow step was reached.
// Corrects an existing entry, or adds one for a step passed before history tracking.
const FLOW = ['RFQ created', 'Quotation Received', 'Technical Review Under Progress', 'Technical Review Done',
              'PO done', 'Partially Received', 'Material Received', 'Rejected Material / PO'];
router.patch('/:id/stage-date', async (req, res) => {
  try {
    const status = normalise(req.body?.status) as string;
    if (!FLOW.includes(status)) return res.status(400).json({ message: 'Unknown status' });
    const at = new Date(req.body?.date);
    if (isNaN(at.getTime())) return res.status(400).json({ message: 'Invalid date' });
    if (at.getTime() > Date.now() + 86400000) return res.status(400).json({ message: 'Date cannot be in the future' });
    const existing: any = await PurchaseFollowup.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ message: 'Record not found' });
    const hist: any[] = (existing.statusHistory || []).map((h: any) => ({ ...h, status: normalise(h.status), from: normalise(h.from || '') }));
    // the step's date = its earliest entry
    const idx = hist.reduce((best: number, h: any, i: number) =>
      h.status === status && (best < 0 || new Date(h.at) < new Date(hist[best].at)) ? i : best, -1);
    if (idx >= 0) { hist[idx].at = at; hist[idx].edited = true; }
    else hist.push({ status, from: '', at, edited: true });
    hist.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    const doc = await PurchaseFollowup.findByIdAndUpdate(req.params.id, { $set: { statusHistory: hist } }, { new: true });
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    const obj = doc.toObject() as any;
    res.json({ ...obj, id: obj._id.toString() });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const doc = await PurchaseFollowup.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Record not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

export default router;
