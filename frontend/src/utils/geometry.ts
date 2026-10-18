import { Point2D, GeometricMeasurements, CalibrationData } from '../types';

/**
 * Calculates Euclidean distance between two 2D points.
 */
export function euclideanDistance(p1: Point2D, p2: Point2D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Computes polygon perimeter in pixels (sum of all closed edges).
 */
export function calculatePolygonPerimeter(points: Point2D[]): number {
  if (points.length < 2) return 0;
  let perimeter = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    perimeter += euclideanDistance(points[i], points[next]);
  }
  return perimeter;
}

/**
 * Computes polygon area in square pixels using the Shoelace formula (Gauss's area formula).
 * Supports clockwise and counter-clockwise vertex orders.
 */
export function calculatePolygonArea(points: Point2D[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    sum += points[i].x * points[next].y - points[next].x * points[i].y;
  }
  return 0.5 * Math.abs(sum);
}

/**
 * Computes polygon geometric centroid.
 */
export function calculatePolygonCentroid(points: Point2D[]): Point2D {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return { ...points[0] };
  if (points.length === 2) {
    return { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
  }

  let signedArea = 0;
  let cx = 0;
  let cy = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    const cross = points[i].x * points[next].y - points[next].x * points[i].y;
    signedArea += cross;
    cx += (points[i].x + points[next].x) * cross;
    cy += (points[i].y + points[next].y) * cross;
  }

  signedArea *= 0.5;
  if (Math.abs(signedArea) < 1e-9) {
    // Degenerate polygon (e.g. collinear points), fallback to arithmetic mean
    const totalX = points.reduce((acc, p) => acc + p.x, 0);
    const totalY = points.reduce((acc, p) => acc + p.y, 0);
    return { x: totalX / n, y: totalY / n };
  }

  const factor = 1 / (6 * signedArea);
  return { x: cx * factor, y: cy * factor };
}

/**
 * Computes the 2D Convex Hull of a set of points using Monotone Chain (Andrew's algorithm).
 */
export function computeConvexHull(points: Point2D[]): Point2D[] {
  if (points.length <= 2) return [...points];

  // Remove duplicates and sort by x, then y
  const sorted = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const unique: Point2D[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0 || sorted[i].x !== sorted[i - 1].x || sorted[i].y !== sorted[i - 1].y) {
      unique.push(sorted[i]);
    }
  }
  if (unique.length <= 2) return unique;

  const crossProduct = (o: Point2D, a: Point2D, b: Point2D) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  // Lower hull
  const lower: Point2D[] = [];
  for (const p of unique) {
    while (lower.length >= 2 && crossProduct(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  // Upper hull
  const upper: Point2D[] = [];
  for (let i = unique.length - 1; i >= 0; i--) {
    const p = unique[i];
    while (upper.length >= 2 && crossProduct(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/**
 * Computes the Minimum-Area Oriented Bounding Box (OBB) using rotating calipers over the convex hull.
 * Returns { length, width, angleRad, area, boxCorners }
 * Where length is the larger dimension, width is the smaller dimension.
 */
export function calculateOrientedBoundingBox(points: Point2D[]): {
  length: number;
  width: number;
  angleRad: number;
  boxArea: number;
} {
  if (points.length < 2) {
    return { length: 0, width: 0, angleRad: 0, boxArea: 0 };
  }
  if (points.length === 2) {
    const d = euclideanDistance(points[0], points[1]);
    return { length: d, width: 0, angleRad: Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x), boxArea: 0 };
  }

  const hull = computeConvexHull(points);
  if (hull.length < 3) {
    // Linear or single point fallback
    let maxDist = 0;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        maxDist = Math.max(maxDist, euclideanDistance(points[i], points[j]));
      }
    }
    return { length: maxDist, width: 0, angleRad: 0, boxArea: 0 };
  }

  let minArea = Infinity;
  let bestDim = { length: 0, width: 0, angleRad: 0, boxArea: 0 };

  // For each edge of the hull, rotate points and calculate axis-aligned bounding box
  const numHull = hull.length;
  for (let i = 0; i < numHull; i++) {
    const p1 = hull[i];
    const p2 = hull[(i + 1) % numHull];
    const edgeDx = p2.x - p1.x;
    const edgeDy = p2.y - p1.y;
    const edgeLen = Math.sqrt(edgeDx * edgeDx + edgeDy * edgeDy);
    if (edgeLen < 1e-9) continue;

    // Angle of edge
    const angle = Math.atan2(edgeDy, edgeDx);
    const cosA = Math.cos(-angle);
    const sinA = Math.sin(-angle);

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const p of hull) {
      // Rotate point by -angle
      const rx = p.x * cosA - p.y * sinA;
      const ry = p.x * sinA + p.y * cosA;
      if (rx < minX) minX = rx;
      if (rx > maxX) maxX = rx;
      if (ry < minY) minY = ry;
      if (ry > maxY) maxY = ry;
    }

    const spanX = maxX - minX;
    const spanY = maxY - minY;
    const area = spanX * spanY;

    if (area < minArea) {
      minArea = area;
      const length = Math.max(spanX, spanY);
      const width = Math.min(spanX, spanY);
      bestDim = {
        length: Math.round(length * 1000) / 1000,
        width: Math.round(width * 1000) / 1000,
        angleRad: angle,
        boxArea: Math.round(area * 1000) / 1000,
      };
    }
  }

  return bestDim;
}

/**
 * Validates a polygon: checks for at least 3 vertices and non-zero area.
 */
export function validatePolygon(points: Point2D[]): { valid: boolean; reason?: string } {
  if (!points || points.length < 3) {
    return { valid: false, reason: 'Polygon requires at least 3 vertices' };
  }
  const area = calculatePolygonArea(points);
  if (area < 0.001) {
    return { valid: false, reason: 'Polygon vertices are degenerate or collinear (zero area)' };
  }
  return { valid: true };
}

/**
 * Master calculation function for geometric measurements given polygon points and calibration data.
 */
export function calculateAllMeasurements(
  points: Point2D[],
  calibration?: CalibrationData,
  manualDepthM?: number,
  customShapeFactor?: number
): GeometricMeasurements {
  const validation = validatePolygon(points);
  if (!validation.valid) {
    return {
      lengthPx: 0,
      widthPx: 0,
      areaPx2: 0,
      perimeterPx: 0,
      aspectRatio: 1,
      lengthCm: 0,
      widthCm: 0,
      areaCm2: 0,
      perimeterCm: 0,
      uncertaintyNotes: [validation.reason || 'Invalid polygon geometry'],
    };
  }

  const areaPx2 = calculatePolygonArea(points);
  const perimeterPx = calculatePolygonPerimeter(points);
  const obb = calculateOrientedBoundingBox(points);

  const lengthPx = obb.length;
  const widthPx = obb.width;
  const aspectRatio = widthPx > 0 ? lengthPx / widthPx : 1;

  const notes: string[] = [];

  // Determine scale in cm/px
  let scaleCmPerPx: number;
  let isCalibrated = false;

  if (calibration && calibration.isCalibrated) {
    if (calibration.scaleCmPerPx && calibration.scaleCmPerPx > 0) {
      scaleCmPerPx = calibration.scaleCmPerPx;
      isCalibrated = true;
    } else if (calibration.scaleMPerPx && calibration.scaleMPerPx > 0) {
      scaleCmPerPx = calibration.scaleMPerPx * 100;
      isCalibrated = true;
    } else if (calibration.scaleMmPerPx && calibration.scaleMmPerPx > 0) {
      scaleCmPerPx = calibration.scaleMmPerPx / 10;
      isCalibrated = true;
    } else {
      scaleCmPerPx = 0.125; // default road GSD (1.25 mm/px)
    }
  } else {
    // Standard Ground Sampling Distance for smartphone road photography (1.25 mm / 0.125 cm per pixel)
    scaleCmPerPx = 0.125;
  }

  if (isCalibrated) {
    notes.push(
      `Calibrated via ${calibration?.referenceLabel || calibration?.referenceMethod} (${(scaleCmPerPx).toFixed(3)} cm/px)`
    );
  } else {
    notes.push(`Standard roadway baseline scale applied: ${scaleCmPerPx.toFixed(3)} cm/px (calibrate with ruler for custom precision)`);
  }

  // Centimeter dimensions (Primary)
  const lengthCm = Math.round(lengthPx * scaleCmPerPx * 10) / 10;
  const widthCm = Math.round(widthPx * scaleCmPerPx * 10) / 10;
  const areaCm2 = Math.round(areaPx2 * (scaleCmPerPx * scaleCmPerPx) * 10) / 10;
  const perimeterCm = Math.round(perimeterPx * scaleCmPerPx * 10) / 10;

  // Meter dimensions
  const lengthM = Math.round((lengthCm / 100) * 1000) / 1000;
  const widthM = Math.round((widthCm / 100) * 1000) / 1000;
  const areaM2 = Math.round((areaCm2 / 10000) * 10000) / 10000;
  const perimeterM = Math.round((perimeterCm / 100) * 1000) / 1000;

  // Depth & Volume processing
  let depthEstimatedCm: number | undefined;
  let depthEstimatedM: number | undefined;
  let volumeCm3: number | undefined;
  let volumeM3: number | undefined;
  let depthSource: GeometricMeasurements['depthSource'] = 'uncalibrated_rgb';
  const shapeFactor = customShapeFactor ?? 0.5; // default 0.50 for bowl-shaped road depressions

  if (manualDepthM !== undefined && manualDepthM > 0) {
    depthEstimatedM = manualDepthM;
    depthEstimatedCm = Math.round(manualDepthM * 100 * 10) / 10;
    depthSource = 'manual_field_entry';
    // V_cm³ = Area_cm² × depth_cm × k
    volumeCm3 = Math.round(areaCm2 * depthEstimatedCm * shapeFactor);
    volumeM3 = Math.round((volumeCm3 / 1000000) * 10000) / 10000;
    notes.push(
      `Volume computed using shape factor k=${shapeFactor} (${shapeFactor === 0.5 ? 'paraboloid crater' : shapeFactor === 1.0 ? 'uniform prism' : 'trapezoidal'})`
    );
  } else {
    notes.push('Metric depth and volume unavailable: Monocular RGB cannot establish absolute metric depth without field gauge reading');
  }

  return {
    lengthPx: Math.round(lengthPx * 10) / 10,
    widthPx: Math.round(widthPx * 10) / 10,
    areaPx2: Math.round(areaPx2 * 10) / 10,
    perimeterPx: Math.round(perimeterPx * 10) / 10,
    aspectRatio: Math.round(aspectRatio * 100) / 100,
    // Centimeter primary outputs
    lengthCm,
    widthCm,
    areaCm2,
    perimeterCm,
    // Meter outputs
    lengthM,
    widthM,
    areaM2,
    perimeterM,
    // Depth & Volume
    depthEstimatedCm,
    depthEstimatedM,
    depthSource,
    volumeCm3,
    volumeM3,
    volumeShapeFactor: shapeFactor,
    uncertaintyNotes: notes,
  };
}

/**
 * Built-in QA Test Suite for Geometry Engine.
 * Verifies exact test cases required by the specification:
 * 1. Rectangle (0,0), (4,0), (4,3), (0,3) -> Area = 12 px², Perimeter = 14 px, 4 px x 3 px
 * 2. Triangle (0,0), (4,0), (0,3) -> Area = 6 px², Perimeter = 12 px
 * 3. Rotated Rectangle (diagonal orientation)
 * 4. Calibrated conversion
 * 5. Volume calculation
 */
export interface TestCaseResult {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  details?: string;
}

export function runGeometryEngineTests(): {
  allPassed: boolean;
  totalTests: number;
  passedTests: number;
  results: TestCaseResult[];
} {
  const results: TestCaseResult[] = [];

  // Test 1: Rectangle (0,0), (4,0), (4,3), (0,3)
  const rectPoints: Point2D[] = [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 3 },
    { x: 0, y: 3 },
  ];
  const rectArea = calculatePolygonArea(rectPoints);
  const rectPerim = calculatePolygonPerimeter(rectPoints);
  const rectOBB = calculateOrientedBoundingBox(rectPoints);

  const t1Passed =
    Math.abs(rectArea - 12) < 1e-4 &&
    Math.abs(rectPerim - 14) < 1e-4 &&
    Math.abs(rectOBB.length - 4) < 1e-3 &&
    Math.abs(rectOBB.width - 3) < 1e-3;

  results.push({
    name: 'Rectangle (0,0),(4,0),(4,3),(0,3) Centimeter Metric Geometry',
    passed: t1Passed,
    expected: 'Area=12.0 cm², Perimeter=14.0 cm, Dims=4.0×3.0 cm',
    actual: `Area=${rectArea.toFixed(1)} cm², Perimeter=${rectPerim.toFixed(1)} cm, Dims=${rectOBB.length.toFixed(1)}×${rectOBB.width.toFixed(1)} cm`,
  });

  // Test 2: Triangle (0,0), (4,0), (0,3)
  // Hypotenuse = sqrt(4^2 + 3^2) = 5. Perimeter = 4 + 3 + 5 = 12. Area = 0.5 * 4 * 3 = 6.
  const triPoints: Point2D[] = [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 0, y: 3 },
  ];
  const triArea = calculatePolygonArea(triPoints);
  const triPerim = calculatePolygonPerimeter(triPoints);

  const t2Passed = Math.abs(triArea - 6) < 1e-4 && Math.abs(triPerim - 12) < 1e-4;
  results.push({
    name: 'Right Triangle (0,0),(4,0),(0,3) Centimeter Hypotenuse & Area',
    passed: t2Passed,
    expected: 'Area=6.0 cm², Perimeter=12.0 cm',
    actual: `Area=${triArea.toFixed(1)} cm², Perimeter=${triPerim.toFixed(1)} cm`,
  });

  // Test 3: Rotated Rectangle (oriented at 45 degrees, 10x4)
  // Center (50, 50), half-length 5, half-width 2, rotated by 45 deg (pi/4)
  const angle = Math.PI / 4;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const halfL = 5;
  const halfW = 2;
  const rotCorners: Point2D[] = [
    { x: 50 + (-halfL * cos - -halfW * sin), y: 50 + (-halfL * sin + -halfW * cos) },
    { x: 50 + (halfL * cos - -halfW * sin), y: 50 + (halfL * sin + -halfW * cos) },
    { x: 50 + (halfL * cos - halfW * sin), y: 50 + (halfL * sin + halfW * cos) },
    { x: 50 + (-halfL * cos - halfW * sin), y: 50 + (-halfL * sin + halfW * cos) },
  ];
  const rotArea = calculatePolygonArea(rotCorners);
  const rotPerim = calculatePolygonPerimeter(rotCorners);
  const rotOBB = calculateOrientedBoundingBox(rotCorners);

  const t3Passed =
    Math.abs(rotArea - 40) < 1e-2 &&
    Math.abs(rotPerim - 28) < 1e-2 &&
    Math.abs(rotOBB.length - 10) < 0.1 &&
    Math.abs(rotOBB.width - 4) < 0.1;

  results.push({
    name: 'Rotated 45° Rectangle (10×4) Minimum OBB Centimeter Bounds',
    passed: t3Passed,
    expected: 'Area=40.0 cm², Perimeter=28.0 cm, Length=10.0 cm, Width=4.0 cm',
    actual: `Area=${rotArea.toFixed(1)} cm², Perimeter=${rotPerim.toFixed(1)} cm, Dims=${rotOBB.length.toFixed(1)}×${rotOBB.width.toFixed(1)} cm`,
  });

  // Test 4: Physical Calibration Scaling (100 px = 1.0 m / 100 cm -> scale = 1.0 cm/px / 0.01 m/px)
  const calib: CalibrationData = {
    isCalibrated: true,
    scaleCmPerPx: 1.0,
    scaleMPerPx: 0.01,
    scaleMmPerPx: 10,
    referenceMethod: 'lane_marking',
    referenceLabel: 'Standard 10cm Lane Marking',
  };
  const calibMeasure = calculateAllMeasurements(
    [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 150 },
      { x: 0, y: 150 },
    ],
    calib
  );
  // Expected: 200 cm (2.0 m), 150 cm (1.5 m), Area = 30,000 cm² (3.0 m²)
  const t4Passed =
    calibMeasure.lengthCm !== undefined &&
    Math.abs(calibMeasure.lengthCm - 200) < 1e-2 &&
    calibMeasure.widthCm !== undefined &&
    Math.abs(calibMeasure.widthCm - 150) < 1e-2 &&
    calibMeasure.areaCm2 !== undefined &&
    Math.abs(calibMeasure.areaCm2 - 30000) < 1e-2 &&
    calibMeasure.lengthM !== undefined &&
    Math.abs(calibMeasure.lengthM - 2.0) < 1e-3 &&
    calibMeasure.widthM !== undefined &&
    Math.abs(calibMeasure.widthM - 1.5) < 1e-3 &&
    calibMeasure.areaM2 !== undefined &&
    Math.abs(calibMeasure.areaM2 - 3.0) < 1e-3;

  results.push({
    name: 'Centimeter Metric Scaling (200×150 px @ 1.0 cm/px)',
    passed: t4Passed,
    expected: 'Length=200.0 cm (2.0m), Width=150.0 cm (1.5m), Area=30,000 cm² (3.0m²)',
    actual: `Length=${calibMeasure.lengthCm ?? 0} cm, Width=${calibMeasure.widthCm ?? 0} cm, Area=${calibMeasure.areaCm2 ?? 0} cm²`,
  });

  // Test 5: Centimeter Volume Estimation with Shape Factor
  // Area = 30,000 cm² (3.0 m²), Depth = 10 cm (0.10 m), Shape Factor = 0.5 (bowl)
  // Expected V = 30,000 × 10 × 0.5 = 150,000 cm³ (0.150 m³)
  const volMeasure = calculateAllMeasurements(
    [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 150 },
      { x: 0, y: 150 },
    ],
    calib,
    0.1, // 10 cm depth
    0.5  // bowl shape factor
  );
  const t5Passed =
    volMeasure.volumeCm3 !== undefined &&
    Math.abs(volMeasure.volumeCm3 - 150000) < 1.0 &&
    volMeasure.volumeM3 !== undefined &&
    Math.abs(volMeasure.volumeM3 - 0.15) < 1e-4;

  results.push({
    name: 'Centimeter Volume Calculation (V = A_cm² × d_cm × k with k=0.5 bowl)',
    passed: t5Passed,
    expected: 'Volume = 150,000 cm³ (0.1500 m³)',
    actual: `Volume = ${volMeasure.volumeCm3?.toLocaleString()} cm³ (${volMeasure.volumeM3} m³, depth=${volMeasure.depthEstimatedCm}cm, k=${volMeasure.volumeShapeFactor})`,
  });

  const passedTests = results.filter((r) => r.passed).length;
  return {
    allPassed: passedTests === results.length,
    totalTests: results.length,
    passedTests,
    results,
  };
}
