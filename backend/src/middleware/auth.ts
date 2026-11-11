import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';

interface JwtPayload { id: string; role?: string; }

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ message: 'Authentication required' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'mms-secret-key') as JwtPayload;
    const user = await User.findById(payload.id).select('name role isActive');
    if (!user || !user.isActive) return res.status(401).json({ message: 'User account is inactive or no longer exists.' });
    (req as any).user = { id: String(user._id), role: user.role, name: user.name };
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!roles.includes(user?.role)) return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
    next();
  };
}
