import { Router } from 'express';
import MachineMaster from '../models/MachineMaster';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const list = await MachineMaster.find().lean().sort({ machineId: 1 });
    res.json(list.map((r: any) => ({ ...r, id: r._id.toString() })));
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

router.post('/', async (req, res) => {
  try {
    const doc = new MachineMaster(req.body);
    await doc.save();
    const obj = doc.toObject() as any;
    res.status(201).json({ ...obj, id: obj._id.toString() });
  } catch (err: any) {
    if (err.code === 11000) return res.status(409).json({ message: `Machine ID '${req.body.machineId}' already exists` });
    res.status(400).json({ message: err.message });
  }
});

router.post('/bulk', async (req, res) => {
  try {
    const machines: any[] = req.body.machines || [];
    const results: any[] = [];
    for (const m of machines) {
      try {
        const existing = await MachineMaster.findOne({ machineId: m.machineId });
        if (existing) {
          await MachineMaster.findOneAndUpdate({ machineId: m.machineId }, { $set: m }, { new: true, runValidators: true });
          results.push({ machineId: m.machineId, action: 'updated' });
        } else {
          const doc = new MachineMaster(m);
          await doc.save();
          results.push({ machineId: m.machineId, action: 'added' });
        }
      } catch (err: any) {
        results.push({ machineId: m.machineId, action: 'error', message: err.message });
      }
    }
    res.json({ results });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const doc = await MachineMaster.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ message: 'Machine not found' });
    const obj = doc.toObject() as any;
    res.json({ ...obj, id: obj._id.toString() });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const doc = await MachineMaster.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Machine not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

export default router;
