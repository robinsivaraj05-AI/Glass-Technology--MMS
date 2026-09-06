import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'mms-secret-key';
const JWT_EXPIRES = '7d';

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

    const user = await User.findOne({ email, isActive: true });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, department: user.department, employeeId: user.employeeId },
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password, role, department, employeeId } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already registered' });

    const user = await User.create({ name, email, password, role, department, employeeId });
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// Returns managers and deputy managers for OT approval dropdown
router.get('/approvers', async (_req: Request, res: Response) => {
  try {
    const approvers = await User.find(
      { role: { $in: ['manager', 'deputy_manager'] }, isActive: { $ne: false } },
      { name: 1, role: 1, employeeId: 1, _id: 0 }
    ).sort({ role: 1, name: 1 });
    res.json(approvers);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
