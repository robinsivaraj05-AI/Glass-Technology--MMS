import { Router } from 'express';
import PurchaseRFQ from '../models/PurchaseRFQ';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const list = await PurchaseRFQ.find().lean().sort({ createdAt: -1 });
    res.json(list.map((r: any) => ({ ...r, id: r._id.toString() })));
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

router.post('/', async (req, res) => {
  try {
    const doc = new PurchaseRFQ(req.body);
    await doc.save();
    const obj = doc.toObject() as any;
    res.status(201).json({ ...obj, id: obj._id.toString() });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const doc = await PurchaseRFQ.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ message: 'RFQ not found' });
    const obj = doc.toObject() as any;
    res.json({ ...obj, id: obj._id.toString() });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const doc = await PurchaseRFQ.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'RFQ not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

export default router;
