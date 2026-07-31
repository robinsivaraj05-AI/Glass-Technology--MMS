import { Router, Request, Response } from 'express';
import Employee from '../models/Employee';

const router = Router();

// GET all employees
router.get('/', async (_req: Request, res: Response) => {
  try {
    const employees = await Employee.find().sort({ createdAt: 1 }).lean();
    res.json(employees);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch employees' });
  }
});

// GET single employee
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const emp = await Employee.findOne({ id: req.params.id }).lean();
    if (!emp) return res.status(404).json({ message: 'Employee not found' });
    res.json(emp);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch employee' });
  }
});

// POST create employee
router.post('/', async (req: Request, res: Response) => {
  try {
    const emp = new Employee(req.body);
    await emp.save();
    res.status(201).json(emp.toObject());
  } catch (err: any) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Employee ID already exists' });
    }
    res.status(500).json({ message: 'Failed to create employee', error: err.message });
  }
});

// POST bulk seed (used on first load when DB is empty)
router.post('/seed', async (req: Request, res: Response) => {
  try {
    const count = await Employee.countDocuments();
    if (count > 0) {
      return res.json({ message: 'Already seeded', count });
    }
    const employees = req.body as any[];
    await Employee.insertMany(employees);
    res.status(201).json({ message: 'Seeded successfully', count: employees.length });
  } catch (err: any) {
    res.status(500).json({ message: 'Seed failed', error: err.message });
  }
});

// PATCH update employee
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const emp = await Employee.findOneAndUpdate(
      { id: req.params.id },
      { $set: req.body },
      { new: true, runValidators: false }
    ).lean();
    if (!emp) return res.status(404).json({ message: 'Employee not found' });
    res.json(emp);
  } catch (err: any) {
    res.status(500).json({ message: 'Failed to update employee', error: err.message });
  }
});

// POST /bulk — upsert multiple employees (match by empId)
router.post('/bulk', async (req: Request, res: Response) => {
  const rows: any[] = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ message: 'No records provided' });
  }

  let created = 0, updated = 0, failed = 0;
  const errors: { empId?: string; error: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      if (row.empId) {
        const existing = await Employee.findOne({ empId: row.empId });
        if (existing) {
          await Employee.findOneAndUpdate(
            { empId: row.empId },
            { $set: row },
            { new: true, runValidators: false }
          );
          updated++;
          continue;
        }
      }
      const newEmp = new Employee({
        ...row,
        id: `emp-bulk-${Date.now()}-${i}`,
        status: row.status || 'active',
        photo: '',
        employmentHistory: [], education: [], qualifications: [],
        skills: [], documents: [], performance: [],
        attendance: { workingDays: 0, present: 0, absent: 0, leave: 0, lateEntry: 0, earlyExit: 0, overtime: 0, monthly: [] },
        leaves: [], training: [], promotions: [],
      });
      await newEmp.save();
      created++;
    } catch (err: any) {
      failed++;
      errors.push({ empId: row.empId, error: err.message });
    }
  }

  res.json({ created, updated, failed, total: rows.length, errors });
});

// DELETE employee
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const emp = await Employee.findOneAndDelete({ id: req.params.id });
    if (!emp) return res.status(404).json({ message: 'Employee not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete employee' });
  }
});

export default router;
