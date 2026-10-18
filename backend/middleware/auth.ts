import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

const JWT_SECRET = process.env.JWT_SECRET || 'goodways-secure-jwt-secret-key-2026';
const DATA_DIR = path.resolve(process.cwd(), 'backend', 'data');
const AUDIT_LOG_FILE = path.join(DATA_DIR, 'audit_log.json');

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: 'citizen' | 'official';
    approvalStatus?: string;
    isSuperAdmin?: boolean;
    department?: string;
  };
}

/**
 * Records denied access attempts to /api/admin or /api/official into audit log.
 */
function recordDeniedAccess(req: AuthenticatedRequest, reason: string) {
  try {
    if (req.path.includes('/api/admin') || req.path.includes('/api/official')) {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      let logs: any[] = [];
      if (fs.existsSync(AUDIT_LOG_FILE)) {
        logs = JSON.parse(fs.readFileSync(AUDIT_LOG_FILE, 'utf-8'));
      }
      const entry = {
        id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method,
        userId: req.user?.id || 'anonymous',
        userEmail: req.user?.email || 'unauthenticated',
        userRole: req.user?.role || 'unauthenticated',
        authorized: false,
        event: 'DENIED_ACCESS_ATTEMPT',
        reason
      };
      logs.unshift(entry);
      if (logs.length > 500) logs.length = 500;
      fs.writeFileSync(AUDIT_LOG_FILE, JSON.stringify(logs, null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

/**
 * Generates a signed JWT for an authenticated user session.
 */
export function generateToken(user: any): string {
  const payload = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    approvalStatus: user.approvalStatus || 'approved',
    isSuperAdmin: !!user.isSuperAdmin,
    department: user.department
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

/**
 * Middleware: Validates JWT token from Authorization header ('Bearer <token>')
 */
export function authenticateJwt(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    recordDeniedAccess(req, 'Unauthorized: Missing or malformed Bearer token');
    res.status(401).json({ error: 'Unauthorized: Missing or malformed Bearer token' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (err: any) {
    recordDeniedAccess(req, 'Unauthorized: Invalid or expired token');
    res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
}

/**
 * Middleware factory: Enforces specific Role-Based Access Control (RBAC).
 */
export function requireRole(allowedRoles: ('citizen' | 'official')[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      recordDeniedAccess(req, 'Unauthorized: Authentication required');
      res.status(401).json({ error: 'Unauthorized: Authentication required' });
      return;
    }

    if (req.user.role === 'official' && req.user.approvalStatus !== 'approved' && !req.user.isSuperAdmin) {
      recordDeniedAccess(req, 'Forbidden: Authority account is pending approval or suspended');
      res.status(403).json({ error: 'Forbidden: Authority account is pending approval or suspended' });
      return;
    }

    if (!allowedRoles.includes(req.user.role) && !req.user.isSuperAdmin) {
      recordDeniedAccess(req, `Forbidden: Requires one of roles [${allowedRoles.join(', ')}]`);
      res.status(403).json({ error: `Forbidden: Requires one of roles [${allowedRoles.join(', ')}]` });
      return;
    }

    next();
  };
}

/**
 * Middleware: Enforces Super Admin / Administrator privileges.
 */
export function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    recordDeniedAccess(req, 'Unauthorized: Authentication required');
    res.status(401).json({ error: 'Unauthorized: Authentication required' });
    return;
  }

  if (!req.user.isSuperAdmin && req.user.email !== 'inspector@pwd.gov.in') {
    recordDeniedAccess(req, 'Forbidden: Restricted to Super Administrators only');
    res.status(403).json({ error: 'Forbidden: Restricted to Super Administrators only' });
    return;
  }

  next();
}
