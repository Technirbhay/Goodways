import { describe, it } from 'node:test';
import assert from 'node:assert';
import { calculatePolygonArea, calculatePolygonPerimeter } from '../../frontend/src/utils/geometry';

describe('GoodWays Geometry Measurement Tests (Point 3)', () => {
  it('should correctly calculate rectangle (0,0), (4,0), (4,3), (0,3) area and perimeter', () => {
    const rect = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 3 },
      { x: 0, y: 3 },
    ];
    const area = calculatePolygonArea(rect);
    const perimeter = calculatePolygonPerimeter(rect);

    assert.strictEqual(area, 12, 'Rectangle area must be 12 square pixels');
    assert.strictEqual(perimeter, 14, 'Rectangle perimeter must be 14 pixels');
  });

  it('should correctly calculate right triangle (0,0), (4,0), (0,3) area and perimeter', () => {
    const triangle = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 0, y: 3 },
    ];
    const area = calculatePolygonArea(triangle);
    const perimeter = calculatePolygonPerimeter(triangle);

    assert.strictEqual(area, 6, 'Triangle area must be 6 square pixels');
    assert.strictEqual(perimeter, 12, 'Triangle perimeter must be 4 + 3 + 5 = 12 pixels');
  });
});
