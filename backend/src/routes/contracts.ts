import { Router } from 'express';
import Contract from '../models/Contract';

const router = Router();

// GET all contracts (with optional status filter)
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const filter: Record<string, string> = {};
    if (status && status !== 'All') filter.status = status as string;
    const contracts = await Contract.find(filter).sort({ createdAt: -1 });
    res.json(contracts);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// GET active contracts only (for dropdowns)
router.get('/active', async (_req, res) => {
  try {
    const contracts = await Contract.find({ status: 'Active' }).select('_id contractName contractorCompany').sort({ contractName: 1 });
    res.json(contracts);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// GET single contract
router.get('/:id', async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id);
    if (!contract) return res.status(404).json({ message: 'Contract not found' });
    res.json(contract);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// POST create contract
router.post('/', async (req, res) => {
  try {
    const contract = new Contract(req.body);
    await contract.save();
    res.status(201).json(contract);
  } catch (err: any) {
    if (err.code === 11000) return res.status(400).json({ message: 'Contract number already exists' });
    res.status(400).json({ message: err.message });
  }
});

// PUT update contract
router.put('/:id', async (req, res) => {
  try {
    const contract = await Contract.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!contract) return res.status(404).json({ message: 'Contract not found' });
    res.json(contract);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE contract
router.delete('/:id', async (req, res) => {
  try {
    const contract = await Contract.findByIdAndDelete(req.params.id);
    if (!contract) return res.status(404).json({ message: 'Contract not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

export default router;
