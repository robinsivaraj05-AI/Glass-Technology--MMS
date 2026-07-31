import { Router } from 'express';
import Calibration from '../models/Calibration';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const list = await Calibration.find().lean().sort({ nextDate: 1 });
    res.json(list.map((r: any) => ({ ...r, id: r._id.toString() })));
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

router.post('/', async (req, res) => {
  try {
    const doc = new Calibration(req.body);
    await doc.save();
    const obj = doc.toObject() as any;
    res.status(201).json({ ...obj, id: obj._id.toString() });
  } catch (err: any) {
    if (err.code === 11000) return res.status(409).json({ message: `Instrument ID '${req.body.instrumentId}' already exists` });
    res.status(400).json({ message: err.message });
  }
});

router.post('/bulk', async (req, res) => {
  try {
    const records: any[] = req.body.records || [];
    const results: any[] = [];
    for (const r of records) {
      try {
        const existing = await Calibration.findOne({ instrumentId: r.instrumentId });
        if (existing) {
          await Calibration.findOneAndUpdate({ instrumentId: r.instrumentId }, { $set: r }, { new: true, runValidators: true });
          results.push({ instrumentId: r.instrumentId, action: 'updated' });
        } else {
          const doc = new Calibration(r);
          await doc.save();
          results.push({ instrumentId: r.instrumentId, action: 'added' });
        }
      } catch (err: any) {
        results.push({ instrumentId: r.instrumentId, action: 'error', message: err.message });
      }
    }
    res.json({ results });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const doc = await Calibration.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ message: 'Calibration record not found' });
    const obj = doc.toObject() as any;
    res.json({ ...obj, id: obj._id.toString() });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const doc = await Calibration.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Calibration record not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

export default router;
