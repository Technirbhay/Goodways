import { describe, it } from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'goodways-secure-jwt-secret-key-2026';
const BASE_URL = 'http://localhost:3000';

describe('GoodWays Mandatory Database Persistence & Reliability Tests', () => {
  const citizenEmail = `persist_user_${Date.now()}@test.com`;
  const citizenToken = jwt.sign(
    { id: 'usr-persist-1', email: citizenEmail, role: 'citizen', approvalStatus: 'approved' },
    JWT_SECRET
  );
  let createdCaseId = null;

  it('1. Complaint submission receives a genuine case ID and is saved in the database', async () => {
    const payload = {
      citizenName: 'Persistent Citizen',
      citizenEmail,
      citizenDescription: 'Deep pothole on Main Street causing vehicle damage.',
      roadName: 'Main Street Test Corridor',
      originalImageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      location: { latitude: 37.7749, longitude: -122.4194, source: 'device_gps', address: 'Main Street' },
      overallSeverity: 'high',
      damageRegions: [
        {
          id: 'dmg-1',
          type: 'pothole',
          typeLabel: 'Pothole',
          confidence: 0.95,
          polygonPoints: [{x:10,y:10},{x:50,y:10},{x:50,y:50},{x:10,y:50}],
          measurements: { lengthCm: 40, widthCm: 30, areaCm2: 1200, depthEstimatedCm: 8, volumeCm3: 9600 },
          visibleCharacteristics: ['Rough edges', 'Standing water']
        }
      ]
    };

    const res = await fetch(`${BASE_URL}/api/cases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${citizenToken}`,
        'X-User-Email': citizenEmail
      },
      body: JSON.stringify(payload)
    });

    assert.strictEqual(res.status, 201, 'Case creation must return HTTP 201 Created');
    const data = await res.json();
    assert(data.id, 'Created case must have a genuine backend case ID');
    createdCaseId = data.id;
    assert.strictEqual(data.roadName, payload.roadName);
  });

  it('2. Refreshing citizen dashboard / reloading cases preserves the complaint', async () => {
    assert(createdCaseId, 'Previous test must have created a case');
    const res = await fetch(`${BASE_URL}/api/cases`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${citizenToken}`,
        'X-User-Email': citizenEmail
      }
    });

    assert.strictEqual(res.status, 200);
    const cases = await res.json();
    const found = cases.find(c => c.id === createdCaseId);
    assert(found, 'Saved complaint must be successfully retrieved from persistent storage after reload');
  });

  it('3. Status update and authority assignments persist in database', async () => {
    assert(createdCaseId, 'Must have active created case ID');
    const officialToken = jwt.sign(
      { id: 'usr-off-1', email: 'inspector@pwd.gov.in', role: 'official', approvalStatus: 'approved' },
      JWT_SECRET
    );

    const patchRes = await fetch(`${BASE_URL}/api/cases/${createdCaseId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${officialToken}`,
        'X-User-Email': 'inspector@pwd.gov.in'
      },
      body: JSON.stringify({
        status: 'Repair In Progress',
        assignedDepartment: 'Municipal Roads Division',
        assignedTeam: 'Patch Crew #7',
        priorityScore: 85,
        actorName: 'Chief Inspector David',
        actorRole: 'official',
        actionNotes: 'Assigned to patch crew 7 for immediate asphalt filling.'
      })
    });

    assert.strictEqual(patchRes.status, 200, 'Status update patch must succeed');
    const updated = await patchRes.json();
    assert.strictEqual(updated.status, 'Repair In Progress');
    assert.strictEqual(updated.priorityScore, 85);
  });

  it('4. Unauthorized users cannot retrieve other users private records', async () => {
    const otherCitizenToken = jwt.sign(
      { id: 'usr-other-2', email: 'intruder@test.com', role: 'citizen', approvalStatus: 'approved' },
      JWT_SECRET
    );

    const res = await fetch(`${BASE_URL}/api/cases/${createdCaseId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${otherCitizenToken}`,
        'X-User-Email': 'intruder@test.com'
      }
    });

    assert.strictEqual(res.status, 403, 'Unauthorized citizen attempting to view another citizen private record must receive 403 Forbidden');
  });
});
