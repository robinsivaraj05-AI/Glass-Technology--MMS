import { Router } from 'express';
import AMCMaster from '../models/AMCMaster';
import AMCSchedule from '../models/AMCSchedule';
import AMCBudget from '../models/AMCBudget';
import AMCPayment from '../models/AMCPayment';

const router = Router();

// ── AMC Master ──────────────────────────────────────────────────────────────

router.get('/next-number', async (_req, res) => {
  try {
    const year = new Date().getFullYear();
    const count = await AMCMaster.countDocuments();
    const num = `AMC-${year}-${String(count + 1).padStart(3, '0')}`;
    res.json({ amcNumber: num });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// ── AMC Schedules ────────────────────────────────────────────────────────────

router.get('/schedules/all', async (req, res) => {
  try {
    const filter: Record<string, unknown> = {};
    const { status, amcId } = req.query;
    if (status && status !== 'All') filter.status = status;
    if (amcId) filter.amcId = amcId;
    const schedules = await AMCSchedule.find(filter).sort({ scheduledDate: 1 });
    res.json(schedules);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

router.post('/schedules', async (req, res) => {
  try {
    if (Array.isArray(req.body)) {
      const schedules = await AMCSchedule.insertMany(req.body);
      res.status(201).json(schedules);
    } else {
      const schedule = new AMCSchedule(req.body);
      await schedule.save();
      res.status(201).json(schedule);
    }
  } catch (err: unknown) {
    res.status(400).json({ message: err instanceof Error ? err.message : 'Bad request' });
  }
});

router.put('/schedules/:id', async (req, res) => {
  try {
    const schedule = await AMCSchedule.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!schedule) return res.status(404).json({ message: 'Schedule not found' });
    res.json(schedule);
  } catch (err: unknown) {
    res.status(400).json({ message: err instanceof Error ? err.message : 'Bad request' });
  }
});

router.delete('/schedules/by-amc/:amcId', async (req, res) => {
  try {
    // Only delete pending schedules — keep Completed records intact
    await AMCSchedule.deleteMany({ amcId: req.params.amcId, status: { $ne: 'Completed' } });
    res.json({ message: 'Pending schedules cleared' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

router.delete('/schedules/:id', async (req, res) => {
  try {
    await AMCSchedule.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// ── AMC Budget ────────────────────────────────────────────────────────────────

router.get('/budget/all', async (req, res) => {
  try {
    const { year } = req.query;
    const filter: Record<string, unknown> = {};
    if (year) filter.budgetYear = Number(year);
    const budgets = await AMCBudget.find(filter).sort({ department: 1 });
    res.json(budgets);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

router.post('/budget', async (req, res) => {
  try {
    const budget = new AMCBudget(req.body);
    await budget.save();
    res.status(201).json(budget);
  } catch (err: unknown) {
    res.status(400).json({ message: err instanceof Error ? err.message : 'Bad request' });
  }
});

router.put('/budget/:id', async (req, res) => {
  try {
    const budget = await AMCBudget.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!budget) return res.status(404).json({ message: 'Budget not found' });
    res.json(budget);
  } catch (err: unknown) {
    res.status(400).json({ message: err instanceof Error ? err.message : 'Bad request' });
  }
});

router.delete('/budget/:id', async (req, res) => {
  try {
    await AMCBudget.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// ── AMC Payments ──────────────────────────────────────────────────────────────

router.get('/payments/all', async (req, res) => {
  try {
    const filter: Record<string, unknown> = {};
    const { status, amcId } = req.query;
    if (status && status !== 'All') filter.paymentStatus = status;
    if (amcId) filter.amcId = amcId;
    const payments = await AMCPayment.find(filter).sort({ invoiceDate: -1 });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

router.post('/payments', async (req, res) => {
  try {
    const payment = new AMCPayment(req.body);
    await payment.save();
    res.status(201).json(payment);
  } catch (err: unknown) {
    res.status(400).json({ message: err instanceof Error ? err.message : 'Bad request' });
  }
});

router.put('/payments/:id', async (req, res) => {
  try {
    const payment = await AMCPayment.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    res.json(payment);
  } catch (err: unknown) {
    res.status(400).json({ message: err instanceof Error ? err.message : 'Bad request' });
  }
});

router.delete('/payments/:id', async (req, res) => {
  try {
    await AMCPayment.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

// ── AMC Master CRUD (kept last to avoid conflicting with sub-routes) ──────────

router.get('/', async (req, res) => {
  try {
    const filter: Record<string, unknown> = {};
    const { status, criticality, frequency, department } = req.query;
    if (status && status !== 'All') filter.status = status;
    if (criticality && criticality !== 'All') filter.criticality = criticality;
    if (frequency && frequency !== 'All') filter.frequency = frequency;
    if (department && department !== 'All') filter.department = department;
    const records = await AMCMaster.find(filter).sort({ createdAt: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const rec = await AMCMaster.findById(req.params.id);
    if (!rec) return res.status(404).json({ message: 'AMC not found' });
    res.json(rec);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

router.post('/', async (req, res) => {
  try {
    const rec = new AMCMaster(req.body);
    await rec.save();
    res.status(201).json(rec);
  } catch (err: unknown) {
    if ((err as { code?: number | string }).code === 11000) {
      return res.status(400).json({ message: 'AMC number already exists' });
    }
    res.status(400).json({ message: err instanceof Error ? err.message : 'Bad request' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const rec = await AMCMaster.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!rec) return res.status(404).json({ message: 'AMC not found' });
    res.json(rec);
  } catch (err: unknown) {
    res.status(400).json({ message: err instanceof Error ? err.message : 'Bad request' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const rec = await AMCMaster.findByIdAndDelete(req.params.id);
    if (!rec) return res.status(404).json({ message: 'AMC not found' });
    await AMCSchedule.deleteMany({ amcId: req.params.id });
    await AMCPayment.deleteMany({ amcId: req.params.id });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
});

export default router;
