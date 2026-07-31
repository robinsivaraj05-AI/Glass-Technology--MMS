import { Router } from 'express';
import Equipment from '../models/Equipment';

const router = Router();

// GET all equipment (with optional status filter)
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const filter: Record<string, any> = {};
    if (status && status !== 'All') filter.status = status;
    const list = await Equipment.find(filter).sort({ equipmentName: 1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// GET active equipment (for dropdowns)
router.get('/active', async (_req, res) => {
  try {
    const list = await Equipment.find({ status: 'Active' })
      .select('_id equipmentName equipmentType vendorCompany rateType rate')
      .sort({ equipmentName: 1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// GET single
router.get('/:id', async (req, res) => {
  try {
    const eq = await Equipment.findById(req.params.id);
    if (!eq) return res.status(404).json({ message: 'Equipment not found' });
    res.json(eq);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// POST create
router.post('/', async (req, res) => {
  try {
    const eq = new Equipment(req.body);
    await eq.save();
    res.status(201).json(eq);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// PUT update
router.put('/:id', async (req, res) => {
  try {
    const eq = await Equipment.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!eq) return res.status(404).json({ message: 'Equipment not found' });
    res.json(eq);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    const eq = await Equipment.findByIdAndDelete(req.params.id);
    if (!eq) return res.status(404).json({ message: 'Equipment not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

export default router;
