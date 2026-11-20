import { Router } from 'express';
import ActivityLog from '../models/ActivityLog';

const router = Router();

// GET /api/activity-log?days=30&module=&user=&q=   (Manager / Deputy Manager)
router.get('/', async (req, res) => {
  try {
    const days = Math.min(31, Math.max(1, parseInt(String(req.query.days || '30')) || 30));
    const q: any = { at: { $gte: new Date(Date.now() - days * 86400000) } };
    if (req.query.module) q.module = String(req.query.module);
    if (req.query.user) q.userName = String(req.query.user);
    const list = await ActivityLog.find(q).sort({ at: -1 }).limit(3000).lean();
    res.json(list);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

export default router;
