import { Router } from 'express';
import SparePart from '../models/SparePart';

const router = Router();

function calcStocks(body: any, existing?: any) {
  const open  = Number(body.openingStock  ?? existing?.openingStock  ?? 0);
  const recv  = Number(body.receivedQty   ?? existing?.receivedQty   ?? 0);
  const iss   = Number(body.issuedQty     ?? existing?.issuedQty     ?? 0);
  const price = Number(body.unitPrice     ?? existing?.unitPrice     ?? 0);
  const currentStock = open + recv - iss;
  const totalValue   = currentStock * price;
  return { currentStock, totalValue };
}

// GET all with optional filters
router.get('/', async (req, res) => {
  try {
    const { storeName, category, search, page = '1', limit = '1000' } = req.query;
    const filter: Record<string, any> = {};
    if (storeName && storeName !== 'All Stores') filter.storeName = storeName;
    if (category  && category  !== 'all')        filter.category  = category;
    if (search) {
      filter.$or = [
        { spareCode: { $regex: search, $options: 'i' } },
        { itemName:  { $regex: search, $options: 'i' } },
        { category:  { $regex: search, $options: 'i' } },
        { supplier:  { $regex: search, $options: 'i' } },
      ];
    }
    const skip  = (Number(page) - 1) * Number(limit);
    const total = await SparePart.countDocuments(filter);
    const items = await SparePart.find(filter).sort({ itemName: 1 }).skip(skip).limit(Number(limit));
    res.json({ items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// GET single
router.get('/:id', async (req, res) => {
  try {
    const part = await SparePart.findById(req.params.id);
    if (!part) return res.status(404).json({ message: 'Not found' });
    res.json(part);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// POST create
router.post('/', async (req, res) => {
  try {
    const { currentStock, totalValue } = calcStocks(req.body);
    const part = new SparePart({ ...req.body, currentStock, totalValue });
    await part.save();
    res.status(201).json(part);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// PUT update
router.put('/:id', async (req, res) => {
  try {
    const existing = await SparePart.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Not found' });
    const { currentStock, totalValue } = calcStocks(req.body, existing);
    const updated = await SparePart.findByIdAndUpdate(
      req.params.id,
      { ...req.body, currentStock, totalValue },
      { new: true, runValidators: true }
    );
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    const part = await SparePart.findByIdAndDelete(req.params.id);
    if (!part) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

export default router;
