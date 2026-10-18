import { describe, it } from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'goodways-secure-jwt-secret-key-2026';
const BASE_URL = 'http://localhost:3000';

describe('GoodWays Backend Integration & Authorization Tests (backend/tests/auth.test.js)', () => {
  it('1. Denies unauthenticated requests to protected endpoints with 401', async () => {
    const res = await fetch(`${BASE_URL}/api/cases`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    assert.strictEqual(res.status, 401, 'Should return 401 Unauthorized when token is missing');
  });

  it('2. Denies unauthenticated requests to statistics with 401', async () => {
    const res = await fetch(`${BASE_URL}/api/stats`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    assert.strictEqual(res.status, 401, 'Should return 401 Unauthorized for stats without token');
  });

  it('3. Prevents citizen users from accessing authority statistics (/api/stats) with 403', async () => {
    const citizenToken = jwt.sign(
      { id: 'usr-citizen-1', email: 'citizen@example.com', role: 'citizen', approvalStatus: 'approved' },
      JWT_SECRET
    );

    const res = await fetch(`${BASE_URL}/api/stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${citizenToken}`
      }
    });
    assert.strictEqual(res.status, 403, 'Should return 403 Forbidden when citizen tries to access authority statistics');
  });

  it('4. Confirms citizen access to /api/cases is strictly scoped to their own records', async () => {
    const citizenEmail = `citizen_${Date.now()}@test.com`;
    const citizenToken = jwt.sign(
      { id: 'usr-citizen-test', email: citizenEmail, role: 'citizen', approvalStatus: 'approved' },
      JWT_SECRET
    );

    const res = await fetch(`${BASE_URL}/api/cases`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${citizenToken}`,
        'X-User-Email': citizenEmail
      }
    });

    assert.strictEqual(res.status, 200, 'Should successfully return cases for authenticated citizen');
    const cases = await res.json();
    assert(Array.isArray(cases), 'Response must be an array of cases');
    // All returned cases must belong to this citizen
    for (const c of cases) {
      if (c.citizenEmail) {
        assert.strictEqual(c.citizenEmail.toLowerCase(), citizenEmail.toLowerCase(), 'Citizen can only see their own records');
      }
    }
  });

  it('5. Allows approved official to access cases and operations statistics', async () => {
    const officialToken = jwt.sign(
      { id: 'usr-official-test', email: 'official@pwd.gov.in', role: 'official', approvalStatus: 'approved' },
      JWT_SECRET
    );

    const res = await fetch(`${BASE_URL}/api/stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${officialToken}`,
        'X-User-Email': 'official@pwd.gov.in'
      }
    });

    assert.strictEqual(res.status, 200, 'Approved official should successfully access operations statistics');
    const stats = await res.json();
    assert(typeof stats.total === 'number', 'Stats object must contain total case count');
  });

  it('6. Verifies unauthorized access attempts are recorded as security events in audit trail', async () => {
    const unauthRes = await fetch(`${BASE_URL}/api/stats`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    assert.strictEqual(unauthRes.status, 401);

    // Fetch audit logs as admin/official
    const officialToken = jwt.sign(
      { id: 'usr-admin-audit', email: 'inspector@pwd.gov.in', role: 'official', approvalStatus: 'approved', isSuperAdmin: true },
      JWT_SECRET
    );

    const auditRes = await fetch(`${BASE_URL}/api/admin/audit-logs`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${officialToken}`,
        'X-User-Email': 'inspector@pwd.gov.in'
      }
    });

    assert.strictEqual(auditRes.status, 200);
    const logs = await auditRes.json();
    assert(Array.isArray(logs), 'Audit logs must be an array');
    const unauthorizedAttempt = logs.find(l => l.path === '/api/stats' && l.event === 'UNAUTHORIZED_SECURITY_ACCESS_ATTEMPT');
    assert(unauthorizedAttempt, 'Unauthorized access attempt must be recorded in audit trail with timestamp and event type');
    assert(unauthorizedAttempt.timestamp, 'Audit log entry must include timestamp');
  });
});
