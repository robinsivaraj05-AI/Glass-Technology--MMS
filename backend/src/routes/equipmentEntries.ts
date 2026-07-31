import { Router } from 'express';
import EquipmentEntry from '../models/EquipmentEntry';

const router = Router();

// GET with filters + pagination
router.get('/', async (req, res) => {
  try {
    const { equipmentId, from, to, status, page = '1', limit = '25' } = req.query;
    const filter: Record<string, any> = {};
    if (equipmentId) filter.equipmentId = equipmentId;
    if (status)      filter.completionStatus = status;
    if (from || to) {
      filter.workDate = {};
      if (from) filter.workDate.$gte = new Date(from as string);
      if (to)   filter.workDate.$lte = new Date(to as string);
    }
    const skip  = (Number(page) - 1) * Number(limit);
    const total = await EquipmentEntry.countDocuments(filter);
    const entries = await EquipmentEntry.find(filter).sort({ workDate: -1 }).skip(skip).limit(Number(limit));
    res.json({ entries, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// GET single
router.get('/:id', async (req, res) => {
  try {
    const entry = await EquipmentEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: 'Entry not found' });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// POST create
router.post('/', async (req, res) => {
  try {
    const entry = new EquipmentEntry(req.body);
    await entry.save();
    res.status(201).json(entry);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// PUT update
router.put('/:id', async (req, res) => {
  try {
    const entry = await EquipmentEntry.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!entry) return res.status(404).json({ message: 'Entry not found' });
    res.json(entry);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    const entry = await EquipmentEntry.findByIdAndDelete(req.params.id);
    if (!entry) return res.status(404).json({ message: 'Entry not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

export default router;
