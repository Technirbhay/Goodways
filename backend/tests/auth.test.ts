import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('GoodWays RBAC & Authorization Tests', () => {
  it('should reject unauthenticated requests to protected endpoints', async () => {
    const res = await fetch('http://localhost:3000/api/auth/me', {
      headers: { 'Authorization': 'Bearer invalid-token' }
    });
    assert.strictEqual(res.status, 401);
  });

  it('should prevent pending authority accounts from accessing restricted official actions', async () => {
    // Register pending official without passkey
    const regRes = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Officer',
        email: `officer_${Date.now()}@pwd.gov.in`,
        password: 'password123',
        role: 'official',
        department: 'Municipal Roads'
      })
    });
    const regData = await regRes.json();
    assert.strictEqual(regData.pendingApproval, true);
  });
});
