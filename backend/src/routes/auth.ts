import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';
import { authenticate, authorize, jwtSecret } from '../middleware/auth';

const router = Router();
const JWT_EXPIRES = '12h';

const sign = (u: IUser) => jwt.sign({ id: String(u._id), role: u.role }, jwtSecret(), { expiresIn: JWT_EXPIRES });
const publicUser = (u: IUser) => ({
  id: String(u._id), name: u.name, email: u.email, role: u.role,
  department: u.department, employeeId: u.employeeId, shift: u.shift, phone: u.phone,
  mustChangePassword: !!u.mustChangePassword,
});

// ── Simple brute-force protection: 10 failed logins per IP+email per 15 min ──
const FAIL_LIMIT = 10, FAIL_WINDOW_MS = 15 * 60 * 1000;
const failures = new Map<string, { count: number; first: number }>();
function tooManyFailures(key: string): boolean {
  const f = failures.get(key);
  if (!f) return false;
  if (Date.now() - f.first > FAIL_WINDOW_MS) { failures.delete(key); return false; }
  return f.count >= FAIL_LIMIT;
}
function recordFailure(key: string) {
  const f = failures.get(key);
  if (!f || Date.now() - f.first > FAIL_WINDOW_MS) failures.set(key, { count: 1, first: Date.now() });
  else f.count++;
}

// POST /api/auth/login  (public)
router.post('/login', async (req: Request, res: Response) => {
  try {
    const email = String(req.body?.email || '').toLowerCase().trim();
    const password = String(req.body?.password || '');
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

    const key = `${req.ip}|${email}`;
    if (tooManyFailures(key)) return res.status(429).json({ message: 'Too many failed attempts. Try again in 15 minutes.' });

    const user = await User.findOne({ email, isActive: true });
    if (!user || !(await user.comparePassword(password))) {
      recordFailure(key);
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    failures.delete(key);
    res.json({ token: sign(user), user: publicUser(user) });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// Everything below needs a valid login
router.use(authenticate);

// GET /api/auth/me — current user (used to restore a session)
router.get('/me', async (req: Request, res: Response) => {
  const user = await User.findById((req as any).user.id);
  if (!user || !user.isActive) return res.status(401).json({ message: 'Account not found or disabled' });
  res.json(publicUser(user));
});

// POST /api/auth/change-password
router.post('/change-password', async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Current and new password are required' });
  if (String(newPassword).length < 8) return res.status(400).json({ message: 'New password must be at least 8 characters' });
  if (currentPassword === newPassword) return res.status(400).json({ message: 'New password must be different from the current one' });
  const user = await User.findById((req as any).user.id);
  if (!user) return res.status(401).json({ message: 'Account not found' });
  if (!(await user.comparePassword(String(currentPassword)))) return res.status(400).json({ message: 'Current password is incorrect' });
  user.password = String(newPassword);
  user.mustChangePassword = false;
  await user.save();
  res.json({ message: 'Password changed', user: publicUser(user) });
});

// POST /api/auth/register — Manager and Deputy Manager only (was open to anyone)
router.post('/register', authorize('manager', 'deputy_manager'), async (req: Request, res: Response) => {
  try {
    const { name, email, password, role, department, employeeId } = req.body;
    const existing = await User.findOne({ email: String(email || '').toLowerCase().trim() });
    if (existing) return res.status(400).json({ message: 'Email already registered' });
    const user = await User.create({ name, email, password, role, department, employeeId, mustChangePassword: true });
    res.status(201).json({ user: publicUser(user) });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// GET /api/auth/approvers — managers and deputy managers for OT approval dropdown
router.get('/approvers', async (_req: Request, res: Response) => {
  try {
    const approvers = await User.find(
      { role: { $in: ['manager', 'deputy_manager'] }, isActive: { $ne: false } },
      { name: 1, role: 1, employeeId: 1, _id: 0 }
    ).sort({ role: 1, name: 1 });
    res.json(approvers);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
