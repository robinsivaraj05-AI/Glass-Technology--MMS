import { Router } from 'express';
import OvertimeRecord from '../models/Overtime';

const router = Router();

const calcHours = (start: string, end: string): number => {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60; // overnight shift
  return Math.round(mins / 60 * 100) / 100;
};

// GET /api/overtime?year=&month=
router.get('/', async (req, res) => {
  try {
    const year  = parseInt(req.query.year  as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || (new Date().getMonth() + 1);
    const records = await OvertimeRecord.find({ year, month }).sort({ day: 1, empId: 1 });
    res.json(records);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// GET /api/overtime/yearly?year=
router.get('/yearly', async (req, res) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const records = await OvertimeRecord.find({ year }).sort({ month: 1, day: 1, empId: 1 });
    res.json(records);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// POST /api/overtime
router.post('/', async (req, res) => {
  try {
    const { empId, empName, year, month, day, startTime, endTime, reason, approvedBy } = req.body;
    if (!empId || !empName || !year || !month || !day || !startTime || !endTime)
      return res.status(400).json({ error: 'Missing required fields' });
    const totalHours = calcHours(startTime, endTime);
    const record = await OvertimeRecord.create({ empId, empName, year, month, day, startTime, endTime, totalHours, reason: reason || '', approvedBy: approvedBy || '' });
    res.json(record);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// PUT /api/overtime/:id
router.put('/:id', async (req, res) => {
  try {
    const { startTime, endTime, reason, approvedBy, day } = req.body;
    const totalHours = calcHours(startTime, endTime);
    const record = await OvertimeRecord.findByIdAndUpdate(
      req.params.id,
      { $set: { day, startTime, endTime, totalHours, reason, approvedBy } },
      { new: true }
    );
    res.json(record);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// DELETE /api/overtime/:id
router.delete('/:id', async (req, res) => {
  try {
    await OvertimeRecord.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

export default router;
