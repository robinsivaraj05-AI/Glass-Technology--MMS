import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

interface JwtPayload { id: string; role: string; }

// Tokens must be signed with a private secret. Set JWT_SECRET on the server
// (Render → Environment). Without it a random secret is used, which is safe
// but logs everyone out whenever the server restarts.
let secret = process.env.JWT_SECRET;
if (!secret || secret === 'mms-secret-key') {
  secret = crypto.randomBytes(48).toString('hex');
  console.warn('⚠️  JWT_SECRET is not set — using a random secret. Users will be logged out on every restart. Set JWT_SECRET in the server environment.');
}
export const jwtSecret = (): string => secret as string;

function tokenFrom(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  // File downloads opened in a new tab / iframe can't send headers, so they
  // may pass ?token= — accepted only for GET .../file routes.
  if (req.method === 'GET' && /\/file\/?$/.test(req.path) && typeof req.query.token === 'string') return req.query.token;
  return undefined;
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = tokenFrom(req);
  if (!token) return res.status(401).json({ message: 'Authentication required' });
  try {
    const payload = jwt.verify(token, jwtSecret()) as JwtPayload;
    (req as any).user = payload;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!roles.includes(user?.role)) {
      return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
}

// Guests can look but not change anything.
export function readOnlyForGuests(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (user?.role === 'guest' && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return res.status(403).json({ message: 'Guest accounts are read-only.' });
  }
  next();
}

// Engineers may read, but only change the modules they work in.
// Paths are relative to /api. Keep in line with frontend/src/config/access.ts.
const ENGINEER_WRITE_PREFIXES = [
  '/outsource',            // Outsource work entry
  '/equipment-entries',    // Rental equipment work entry
  '/accessories',          // Rental accessories
  '/accessory-invoices',   // accessory invoice scan (used by the Accessories page)
  '/purchase-rfq',         // RFQ creation
];
export function engineerWriteScope(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (user?.role !== 'shift_engineer' || ['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const allowed = ENGINEER_WRITE_PREFIXES.some(p => req.path === p || req.path.startsWith(p + '/'));
  if (!allowed) return res.status(403).json({ message: 'Engineers can view this, but not change it.' });
  next();
}
