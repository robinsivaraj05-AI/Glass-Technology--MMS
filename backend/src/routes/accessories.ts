import { Router } from 'express';
import AccessoryEntry from '../models/AccessoryEntry';

const router = Router();

// GET with filters + pagination
router.get('/', async (req, res) => {
  try {
    const { equipmentId, from, to, page = '1', limit = '25' } = req.query;
    const filter: Record<string, any> = {};
    if (equipmentId) filter.equipmentId = equipmentId;
    if (from || to) {
      filter.entryDate = {};
      if (from) filter.entryDate.$gte = new Date(from as string);
      if (to)   filter.entryDate.$lte = new Date(to as string);
    }
    const skip  = (Number(page) - 1) * Number(limit);
    const total = await AccessoryEntry.countDocuments(filter);
    const entries = await AccessoryEntry.find(filter).sort({ entryDate: -1 }).skip(skip).limit(Number(limit));
    res.json({ entries, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// GET single
router.get('/:id', async (req, res) => {
  try {
    const entry = await AccessoryEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: 'Entry not found' });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// POST create
router.post('/', async (req, res) => {
  try {
    const entry = new AccessoryEntry(req.body);
    await entry.save();
    res.status(201).json(entry);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// PUT update
router.put('/:id', async (req, res) => {
  try {
    const entry = await AccessoryEntry.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!entry) return res.status(404).json({ message: 'Entry not found' });
    res.json(entry);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    const entry = await AccessoryEntry.findByIdAndDelete(req.params.id);
    if (!entry) return res.status(404).json({ message: 'Entry not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

export default router;
