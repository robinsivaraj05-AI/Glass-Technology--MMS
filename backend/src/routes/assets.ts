import { Router } from 'express';
import Asset from '../models/Asset';

const router = Router();

// GET all assets
router.get('/', async (req, res) => {
  try {
    const { status, category } = req.query;
    const filter: Record<string, any> = {};
    if (status && status !== 'all') filter.status = status;
    if (category && category !== 'All') filter.category = category;
    const list = await Asset.find(filter).sort({ code: 1 });
    // Normalize _id → id for frontend
    res.json(list.map(a => ({ ...a.toObject(), id: a._id.toString() })));
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// POST create single asset
router.post('/', async (req, res) => {
  try {
    const asset = new Asset(req.body);
    await asset.save();
    const obj = asset.toObject();
    res.status(201).json({ ...obj, id: obj._id.toString() });
  } catch (err: any) {
    if (err.code === 11000) return res.status(409).json({ message: `Asset code '${req.body.code}' already exists` });
    res.status(400).json({ message: err.message });
  }
});

// POST bulk upsert — used by Excel import
// Body: { assets: Asset[] }
// For each: insert if code is new, update if code exists
router.post('/bulk', async (req, res) => {
  try {
    const assets: any[] = req.body.assets || [];
    const results: { code: string; action: 'added' | 'updated' | 'error'; message?: string }[] = [];

    for (const a of assets) {
      try {
        const existing = await Asset.findOne({ code: a.code });
        if (existing) {
          await Asset.findOneAndUpdate({ code: a.code }, { $set: a }, { new: true, runValidators: true });
          results.push({ code: a.code, action: 'updated' });
        } else {
          const doc = new Asset(a);
          await doc.save();
          results.push({ code: a.code, action: 'added' });
        }
      } catch (err: any) {
        results.push({ code: a.code, action: 'error', message: err.message });
      }
    }

    res.json({ results });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// PUT update single asset by id
router.put('/:id', async (req, res) => {
  try {
    const asset = await Asset.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!asset) return res.status(404).json({ message: 'Asset not found' });
    const obj = asset.toObject();
    res.json({ ...obj, id: obj._id.toString() });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE single asset
router.delete('/:id', async (req, res) => {
  try {
    const asset = await Asset.findByIdAndDelete(req.params.id);
    if (!asset) return res.status(404).json({ message: 'Asset not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

export default router;
