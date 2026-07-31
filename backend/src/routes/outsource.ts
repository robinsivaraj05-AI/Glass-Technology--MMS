import { Router } from 'express';
import OutsourceEntry from '../models/OutsourceEntry';

const router = Router();

// ── Dashboard KPIs ───────────────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear  = new Date(now.getFullYear(), 0, 1);
    const today        = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow     = new Date(today.getTime() + 86400000);

    const [
      totalEntries,
      todayEntries,
      monthEntries,
      yearEntries,
      monthlyCostAgg,
    ] = await Promise.all([
      OutsourceEntry.countDocuments(),
      OutsourceEntry.find({ workDate: { $gte: today, $lt: tomorrow } }),
      OutsourceEntry.find({ workDate: { $gte: startOfMonth } }),
      OutsourceEntry.find({ workDate: { $gte: startOfYear } }),
      // Monthly cost trend (last 12 months)
      OutsourceEntry.aggregate([
        { $match: { workDate: { $gte: new Date(now.getFullYear() - 1, now.getMonth(), 1) } } },
        {
          $group: {
            _id: { year: { $year: '$workDate' }, month: { $month: '$workDate' } },
            totalCost: { $sum: '$totalCost' },
            totalPersons: { $sum: '$numberOfPersons' },
            totalHours: { $sum: '$workingHours' },
            totalOT: { $sum: '$overtimeHours' },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
    ]);

    // Work type breakdown for current year
    const workTypeAgg = await OutsourceEntry.aggregate([
      { $match: { workDate: { $gte: startOfYear } } },
      { $group: { _id: '$maintenanceType', count: { $sum: 1 }, cost: { $sum: '$totalCost' } } },
      { $sort: { count: -1 } },
    ]);

    // Contractor-wise cost for current year
    const contractorAgg = await OutsourceEntry.aggregate([
      { $match: { workDate: { $gte: startOfYear } } },
      { $group: { _id: '$contractorCompany', cost: { $sum: '$totalCost' }, persons: { $sum: '$numberOfPersons' } } },
      { $sort: { cost: -1 } },
      { $limit: 8 },
    ]);

    const sum = (arr: any[], field: string) => arr.reduce((s, e) => s + (e[field] || 0), 0);

    res.json({
      totalEntries,
      todayPersons:    sum(todayEntries, 'numberOfPersons'),
      monthPersons:    sum(monthEntries, 'numberOfPersons'),
      yearPersons:     sum(yearEntries, 'numberOfPersons'),
      monthHours:      sum(monthEntries, 'workingHours'),
      monthOT:         sum(monthEntries, 'overtimeHours'),
      yearHours:       sum(yearEntries, 'workingHours'),
      monthCost:       sum(monthEntries, 'totalCost'),
      yearCost:        sum(yearEntries, 'totalCost'),
      monthlyCostTrend: monthlyCostAgg,
      workTypeBreakdown: workTypeAgg,
      contractorCost:    contractorAgg,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// ── Contract-wise report ─────────────────────────────────────────────────────
router.get('/report/:contractId', async (req, res) => {
  try {
    const { from, to } = req.query;
    const filter: Record<string, any> = { contractId: req.params.contractId };
    if (from || to) {
      filter.workDate = {};
      if (from) filter.workDate.$gte = new Date(from as string);
      if (to)   filter.workDate.$lte = new Date(to as string);
    }
    const entries = await OutsourceEntry.find(filter).sort({ workDate: -1 });

    const totalCost    = entries.reduce((s, e) => s + e.totalCost, 0);
    const totalPersons = entries.reduce((s, e) => s + e.numberOfPersons, 0);
    const totalHours   = entries.reduce((s, e) => s + e.workingHours, 0);
    const totalOT      = entries.reduce((s, e) => s + e.overtimeHours, 0);
    const workDays     = new Set(entries.map(e => e.workDate.toISOString().slice(0, 10))).size;

    res.json({
      entries,
      summary: {
        totalCost,
        totalPersons,
        totalHours,
        totalOT,
        workDays,
        avgPersonsPerDay: workDays ? +(totalPersons / workDays).toFixed(1) : 0,
        avgHoursPerDay:   workDays ? +(totalHours / workDays).toFixed(1) : 0,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// ── CRUD ─────────────────────────────────────────────────────────────────────

// GET entries with filters
router.get('/', async (req, res) => {
  try {
    const { contractId, from, to, status, maintenanceType, page = '1', limit = '50' } = req.query;
    const filter: Record<string, any> = {};
    if (contractId) filter.contractId = contractId;
    if (status)     filter.completionStatus = status;
    if (maintenanceType) filter.maintenanceType = maintenanceType;
    if (from || to) {
      filter.workDate = {};
      if (from) filter.workDate.$gte = new Date(from as string);
      if (to)   filter.workDate.$lte = new Date(to as string);
    }

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await OutsourceEntry.countDocuments(filter);
    const entries = await OutsourceEntry.find(filter).sort({ workDate: -1 }).skip(skip).limit(Number(limit));

    res.json({ entries, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// GET single entry
router.get('/:id', async (req, res) => {
  try {
    const entry = await OutsourceEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: 'Entry not found' });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// POST create entry
router.post('/', async (req, res) => {
  try {
    const entry = new OutsourceEntry(req.body);
    await entry.save();
    res.status(201).json(entry);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// PUT update entry
router.put('/:id', async (req, res) => {
  try {
    const entry = await OutsourceEntry.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!entry) return res.status(404).json({ message: 'Entry not found' });
    res.json(entry);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE entry
router.delete('/:id', async (req, res) => {
  try {
    const entry = await OutsourceEntry.findByIdAndDelete(req.params.id);
    if (!entry) return res.status(404).json({ message: 'Entry not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

export default router;
