import { Router, Request, Response } from 'express';
import Breakdown from '../models/Breakdown';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, priority, page = 1, limit = 20 } = req.query;
    const filter: any = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    const skip = (Number(page) - 1) * Number(limit);
    const [breakdowns, total] = await Promise.all([
      Breakdown.find(filter).sort({ reportedAt: -1 }).skip(skip).limit(Number(limit)),
      Breakdown.countDocuments(filter),
    ]);
    res.json({ breakdowns, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch { res.status(500).json({ message: 'Server error' }); }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const breakdown = await Breakdown.create({ ...req.body, reportedBy: (req as any).user.id });
    res.status(201).json(breakdown);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const b = await Breakdown.findById(req.params.id);
    if (!b) return res.status(404).json({ message: 'Breakdown not found' });
    res.json(b);
  } catch { res.status(500).json({ message: 'Server error' }); }
});

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const b = await Breakdown.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!b) return res.status(404).json({ message: 'Not found' });
    res.json(b);
  } catch (err: any) { res.status(400).json({ message: err.message }); }
});

export default router;
