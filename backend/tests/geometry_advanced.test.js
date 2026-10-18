import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  calculatePolygonArea,
  calculatePolygonPerimeter,
  validatePolygon,
  calculateAllMeasurements
} from '../../frontend/src/utils/geometry';

describe('GoodWays Advanced Geometry, Calibration & Waterlogged Pothole Tests', () => {
  it('1. Calculates rectangle (0,0), (4,0), (4,3), (0,3) area (12) and perimeter (14)', () => {
    const rect = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }];
    assert.strictEqual(calculatePolygonArea(rect), 12);
    assert.strictEqual(calculatePolygonPerimeter(rect), 14);
  });

  it('2. Calculates right triangle (0,0), (4,0), (0,3) area (6) and perimeter (12)', () => {
    const triangle = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 3 }];
    assert.strictEqual(calculatePolygonArea(triangle), 6);
    assert.strictEqual(calculatePolygonPerimeter(triangle), 12);
  });

  it('3. Rejects invalid or degenerate polygons (less than 3 points or zero area)', () => {
    const invalid = [{ x: 0, y: 0 }, { x: 2, y: 2 }];
    const validation = validatePolygon(invalid);
    assert.strictEqual(validation.valid, false);

    const collinear = [{ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 4, y: 4 }];
    const colVal = validatePolygon(collinear);
    assert.strictEqual(colVal.valid, false);
  });

  it('4. Handles waterlogged / uncalibrated potholes by withholding volume and showing unmeasured depth', () => {
    const poly = [{ x: 10, y: 10 }, { x: 50, y: 10 }, { x: 50, y: 50 }, { x: 10, y: 50 }];
    // Without manual depth entry (waterlogged / monocular RGB limitation)
    const measurements = calculateAllMeasurements(poly, { isCalibrated: false }, undefined, 0.5);

    assert.strictEqual(measurements.depthEstimatedCm, undefined, 'Depth must be undefined when unmeasured');
    assert.strictEqual(measurements.volumeCm3, undefined, 'Volume must be withheld when depth is unmeasured');
    assert(measurements.uncertaintyNotes.some(n => n.includes('depth')), 'Uncertainty notes must explain lack of absolute depth');
  });

  it('5. Computes volume and depth correctly when field inspector depth is entered', () => {
    const poly = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]; // area = 100 px²
    // Suppose scale is 1 cm / px -> area = 100 cm²
    const calibration = { isCalibrated: true, scaleCmPerPx: 1.0, referenceLabel: '1cm test scale' };
    const measurements = calculateAllMeasurements(poly, calibration, 0.05, 0.5); // 5 cm depth

    assert.strictEqual(measurements.depthEstimatedCm, 5.0);
    // V = 100 cm² * 5 cm * 0.5 = 250 cm³
    assert.strictEqual(measurements.volumeCm3, 250);
  });
});
