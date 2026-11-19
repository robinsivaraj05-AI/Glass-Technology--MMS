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
