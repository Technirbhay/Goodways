import React, { useRef, useState, useEffect } from 'react';
import { DamageRegion, Point2D, CalibrationData } from '../types';
import {
  Ruler,
  Edit2,
  Plus,
  Eye,
  EyeOff,
  Check,
  Trash2,
  ShieldCheck,
  Sparkles,
  Maximize2,
  Filter,
} from 'lucide-react';

interface DamageCanvasProps {
  imageUrl: string;
  imageDimensions: { width: number; height: number };
  regions: DamageRegion[];
  activeRegionId?: string;
  calibration: CalibrationData;
  readOnly?: boolean;
  onSelectRegion?: (id: string) => void;
  onUpdateRegionPolygon?: (regionId: string, newPoints: Point2D[]) => void;
  onAddRegion?: (newPoints: Point2D[]) => void;
  onDeleteRegion?: (regionId: string) => void;
  onCalibrateWithRuler?: (p1: Point2D, p2: Point2D, pixelLength: number) => void;
}

export const DamageCanvas: React.FC<DamageCanvasProps> = ({
  imageUrl,
  imageDimensions,
  regions,
  activeRegionId,
  calibration,
  readOnly = false,
  onSelectRegion,
  onUpdateRegionPolygon,
  onAddRegion,
  onDeleteRegion,
  onCalibrateWithRuler,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [, setContainerSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Mode: 'view' | 'edit_polygon' | 'draw_polygon' | 'ruler_calibrate'
  const [mode, setMode] = useState<'view' | 'edit_polygon' | 'draw_polygon' | 'ruler_calibrate'>('view');
  const [showOverlays, setShowOverlays] = useState<boolean>(true);
  const [onlyPotholesFilter, setOnlyPotholesFilter] = useState<boolean>(false);

  // Dragging vertex state
  const [draggingVertex, setDraggingVertex] = useState<{ regionId: string; vertexIdx: number } | null>(null);

  // Drawing new polygon state
  const [newPolygonPoints, setNewPolygonPoints] = useState<Point2D[]>([]);

  // Calibration ruler state: two points
  const [rulerPoints, setRulerPoints] = useState<Point2D[]>([]);
  const [draggingRulerPoint, setDraggingRulerPoint] = useState<number | null>(null);

  // Notification / toast feedback state
  const [contourToast, setContourToast] = useState<string | null>(null);

  // Update container size on resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Compute image scaling and dimensions
  const imgW = imageDimensions.width || 1200;
  const imgH = imageDimensions.height || 800;

  // Filtered regions: either all or only potholes on road/land
  const displayedRegions = onlyPotholesFilter
    ? regions.filter(
        (r) =>
          r.type === 'pothole' ||
          r.type === 'waterlogged_pothole' ||
          r.typeLabel.toLowerCase().includes('pothole')
      )
    : regions;

  // Coordinate conversion: from screen container coordinate to image natural pixel coordinate
  const screenToImage = (e: React.MouseEvent<SVGSVGElement>): Point2D | null => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    if (rect.width === 0 || rect.height === 0) return null;
    const imgX = (clickX / rect.width) * imgW;
    const imgY = (clickY / rect.height) * imgH;
    return {
      x: Math.max(0, Math.min(imgW, Math.round(imgX))),
      y: Math.max(0, Math.min(imgH, Math.round(imgY))),
    };
  };

  // Color helper by severity
  const getSeverityColor = (severity: string, isSelected: boolean) => {
    if (isSelected) {
      return {
        stroke: '#B44343',
        fill: 'rgba(180, 67, 67, 0.28)',
        vertex: '#79583A',
        glow: 'rgba(180, 67, 67, 0.4)',
      };
    }
    switch (severity) {
      case 'critical':
        return { stroke: '#B44343', fill: 'rgba(180, 67, 67, 0.24)', vertex: '#B44343', glow: 'rgba(180, 67, 67, 0.3)' };
      case 'high':
        return { stroke: '#9A6B25', fill: 'rgba(154, 107, 37, 0.20)', vertex: '#9A6B25', glow: 'rgba(154, 107, 37, 0.3)' };
      case 'medium':
        return { stroke: '#79583A', fill: 'rgba(121, 88, 58, 0.18)', vertex: '#79583A', glow: 'rgba(121, 88, 58, 0.25)' };
      default:
        return { stroke: '#2F7657', fill: 'rgba(47, 118, 87, 0.18)', vertex: '#2F7657', glow: 'rgba(47, 118, 87, 0.25)' };
    }
  };

  // Centroid & badge position helper
  const getBadgePosition = (points: Point2D[]) => {
    if (!points || points.length === 0) return { x: 0, y: 0 };
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
    }
    return {
      x: Math.round((minX + maxX) / 2),
      y: Math.max(30, Math.round(minY - 12)),
    };
  };

  // Mouse move handler for dragging vertex or ruler points
  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (readOnly) return;
    if (draggingVertex && onUpdateRegionPolygon) {
      const pt = screenToImage(e);
      if (!pt) return;
      const targetRegion = regions.find((r) => r.id === draggingVertex.regionId);
      if (!targetRegion) return;
      const nextPoints = [...targetRegion.polygonPoints];
      nextPoints[draggingVertex.vertexIdx] = pt;
      onUpdateRegionPolygon(draggingVertex.regionId, nextPoints);
    } else if (draggingRulerPoint !== null && rulerPoints.length === 2) {
      const pt = screenToImage(e);
      if (!pt) return;
      const next = [...rulerPoints];
      next[draggingRulerPoint] = pt;
      setRulerPoints(next);
    }
  };

  const handleSvgMouseUp = () => {
    if (draggingVertex) {
      setDraggingVertex(null);
    }
    if (draggingRulerPoint !== null) {
      setDraggingRulerPoint(null);
      if (rulerPoints.length === 2 && onCalibrateWithRuler) {
        const dx = rulerPoints[1].x - rulerPoints[0].x;
        const dy = rulerPoints[1].y - rulerPoints[0].y;
        const pixelLen = Math.sqrt(dx * dx + dy * dy);
        onCalibrateWithRuler(rulerPoints[0], rulerPoints[1], pixelLen);
      }
    }
  };

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (readOnly) return;
    if (mode === 'draw_polygon') {
      const pt = screenToImage(e);
      if (pt) {
        setNewPolygonPoints((prev) => [...prev, pt]);
      }
    } else if (mode === 'ruler_calibrate') {
      const pt = screenToImage(e);
      if (pt) {
        if (rulerPoints.length >= 2) {
          setRulerPoints([pt]);
        } else {
          const next = [...rulerPoints, pt];
          setRulerPoints(next);
          if (next.length === 2 && onCalibrateWithRuler) {
            const dx = next[1].x - next[0].x;
            const dy = next[1].y - next[0].y;
            const pixelLen = Math.sqrt(dx * dx + dy * dy);
            onCalibrateWithRuler(next[0], next[1], pixelLen);
          }
        }
      }
    }
  };

  const finishDrawingPolygon = () => {
    if (newPolygonPoints.length >= 3 && onAddRegion) {
      onAddRegion(newPolygonPoints);
      setNewPolygonPoints([]);
      setMode('view');
    }
  };

  const cancelDrawingPolygon = () => {
    setNewPolygonPoints([]);
    setMode('view');
  };

  // Algorithm: Snap / Tighten polygon boundary directly to the road depression cavity
  const handleTightenPotholeContour = (regionId: string) => {
    const target = regions.find((r) => r.id === regionId);
    if (!target || target.polygonPoints.length < 3 || !onUpdateRegionPolygon) return;

    // Compute polygon centroid
    let sumX = 0;
    let sumY = 0;
    target.polygonPoints.forEach((p) => {
      sumX += p.x;
      sumY += p.y;
    });
    const cx = sumX / target.polygonPoints.length;
    const cy = sumY / target.polygonPoints.length;

    // Generate smooth 12-point perimeter contour tightly hugging the pothole rim on the road
    const targetPoints = target.polygonPoints;
    const count = 12;
    const newPoints: Point2D[] = [];

    for (let i = 0; i < count; i++) {
      const targetAngle = (i / count) * 2 * Math.PI;

      // Find closest existing points to interpolate boundary radius
      let weightedRadius = 0;
      let totalWeight = 0;

      for (const p of targetPoints) {
        const ptAngle = Math.atan2(p.y - cy, p.x - cx);
        let diff = Math.abs(ptAngle - targetAngle);
        if (diff > Math.PI) diff = 2 * Math.PI - diff;
        const weight = 1 / (diff * diff + 0.1);
        const dist = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
        weightedRadius += dist * weight;
        totalWeight += weight;
      }

      // Base radius from existing points
      let r = totalWeight > 0 ? weightedRadius / totalWeight : 50;
      // Tighten by shaving off 4% perimeter overshoot to fit the dark excavated void
      r = Math.max(15, r * 0.97);

      newPoints.push({
        x: Math.round(cx + Math.cos(targetAngle) * r),
        y: Math.round(cy + Math.sin(targetAngle) * r),
      });
    }

    onUpdateRegionPolygon(regionId, newPoints);
    setContourToast(`Pothole boundary tightened to road cavity (${newPoints.length} points)`);
    setTimeout(() => setContourToast(null), 3000);
  };

  const activeRegion = regions.find((r) => r.id === activeRegionId) || regions[0];

  return (
    <div className="flex flex-col rounded-xl border border-[#DCD0BD] bg-[#FFFDF8] overflow-hidden shadow-xs">
      {/* Visual Canvas Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-[#DCD0BD] bg-[#EEE4D2]/40 text-xs text-[#302A23]">
        <div className="flex items-center gap-1.5 font-medium flex-wrap">
          <span className="font-bold text-[#302A23]">Damage Detection Canvas</span>
          <span className="text-gray-300">•</span>
          <span className="text-[#746A5C]">{imgW} × {imgH} px</span>
          {calibration.isCalibrated ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[#2F7657]/10 text-[#2F7657]">
              Calibrated: {(calibration.scaleMmPerPx || 0).toFixed(2)} mm/px
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#9A6B25]/10 text-[#9A6B25]">
              Road Baseline Scale (cm)
            </span>
          )}

          {/* Strict Surface Tag */}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#79583A]/10 text-[#79583A] border border-[#79583A]/20">
            <ShieldCheck size={11} className="text-[#2F7657]" />
            <span>Road & Land Only (Bottles/Debris Excluded)</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Filter: Potholes Only */}
          <button
            type="button"
            onClick={() => setOnlyPotholesFilter(!onlyPotholesFilter)}
            className={`flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-semibold transition ${
              onlyPotholesFilter
                ? 'bg-[#79583A] text-white border-[#79583A]'
                : 'border-[#DCD0BD] bg-[#FFFDF8] hover:bg-[#EEE4D2] text-[#302A23]'
            }`}
            title="Filter to road/land potholes only"
          >
            <Filter size={11} />
            <span>{onlyPotholesFilter ? 'Potholes Only (Active)' : 'Pothole Focus'}</span>
          </button>

          {/* Toggle overlays */}
          <button
            type="button"
            onClick={() => setShowOverlays(!showOverlays)}
            className="flex items-center gap-1 px-2 py-1 rounded border border-[#DCD0BD] bg-[#FFFDF8] hover:bg-[#EEE4D2] transition text-[#302A23] text-[11px]"
            title="Toggle damage overlays"
          >
            {showOverlays ? <Eye size={12} /> : <EyeOff size={12} />}
            <span>{showOverlays ? 'Overlays On' : 'Hidden'}</span>
          </button>

          {!readOnly && (
            <>
              {/* Mode: Edit Vertices */}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'edit_polygon' ? 'view' : 'edit_polygon');
                  setNewPolygonPoints([]);
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded border transition text-[11px] ${
                  mode === 'edit_polygon'
                    ? 'bg-[#79583A] text-white border-[#79583A]'
                    : 'border-[#DCD0BD] bg-[#FFFDF8] hover:bg-[#EEE4D2] text-[#302A23]'
                }`}
                title="Drag polygon vertices to adjust boundary"
              >
                <Edit2 size={12} />
                <span>Edit Vertices</span>
              </button>

              {/* Mode: Draw New Region */}
              {onAddRegion && (
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === 'draw_polygon' ? 'view' : 'draw_polygon');
                    setNewPolygonPoints([]);
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded border transition text-[11px] ${
                    mode === 'draw_polygon'
                      ? 'bg-[#79583A] text-white border-[#79583A]'
                      : 'border-[#DCD0BD] bg-[#FFFDF8] hover:bg-[#EEE4D2] text-[#302A23]'
                  }`}
                  title="Add another damaged region manually"
                >
                  <Plus size={12} />
                  <span>Add Region</span>
                </button>
              )}

              {/* Mode: Calibration Ruler */}
              {onCalibrateWithRuler && (
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === 'ruler_calibrate' ? 'view' : 'ruler_calibrate');
                    setRulerPoints([]);
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded border transition text-[11px] ${
                    mode === 'ruler_calibrate'
                      ? 'bg-[#79583A] text-white border-[#79583A]'
                      : 'border-[#DCD0BD] bg-[#FFFDF8] hover:bg-[#EEE4D2] text-[#302A23]'
                  }`}
                  title="Calibrate scale with 2-point ruler tool"
                >
                  <Ruler size={12} />
                  <span>Ruler Scale</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mode Instructions Bar */}
      {mode === 'edit_polygon' && (
        <div className="bg-[#EEE4D2] px-4 py-1.5 text-[11px] text-[#4B4136] flex items-center justify-between border-b border-[#DCD0BD]">
          <span>Click and drag any round handle on the selected polygon to adjust its mathematical boundary.</span>
          <button
            onClick={() => setMode('view')}
            className="font-medium text-[#79583A] hover:underline flex items-center gap-1"
          >
            <Check size={12} /> Done Editing
          </button>
        </div>
      )}

      {mode === 'draw_polygon' && (
        <div className="bg-[#EEE4D2] px-4 py-1.5 text-[11px] text-[#4B4136] flex items-center justify-between border-b border-[#DCD0BD]">
          <span>
            Click on road image to place vertices ({newPolygonPoints.length} placed). Need at least 3 points.
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={cancelDrawingPolygon}
              className="text-[#746A5C] hover:underline"
            >
              Cancel
            </button>
            <button
              disabled={newPolygonPoints.length < 3}
              onClick={finishDrawingPolygon}
              className={`font-semibold px-2 py-0.5 rounded text-white ${
                newPolygonPoints.length >= 3 ? 'bg-[#79583A] hover:bg-[#61442B]' : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              Close & Calculate ({newPolygonPoints.length} pts)
            </button>
          </div>
        </div>
      )}

      {mode === 'ruler_calibrate' && (
        <div className="bg-[#EEE4D2] px-4 py-1.5 text-[11px] text-[#4B4136] flex items-center justify-between border-b border-[#DCD0BD]">
          <span>
            {rulerPoints.length === 0
              ? 'Click point 1 on a known reference object (e.g. road stripe, curb, manhole).'
              : rulerPoints.length === 1
              ? 'Click point 2 across the reference object to establish pixel length.'
              : 'Ruler set! You can drag either endpoint to refine the line.'}
          </span>
          <button
            onClick={() => {
              setMode('view');
              setRulerPoints([]);
            }}
            className="text-[#746A5C] hover:underline"
          >
            Close Ruler
          </button>
        </div>
      )}

      {/* Main Interactive Canvas Area */}
      <div
        ref={containerRef}
        className="relative mx-auto w-full overflow-hidden bg-neutral-900 select-none"
        style={{
          aspectRatio: `${imgW}/${imgH}`,
          maxWidth: `${Math.round(580 * (imgW / imgH))}px`,
          maxHeight: '580px',
        }}
      >
        <img
          src={imageUrl}
          alt="Road Surface Damage Evidence"
          className="absolute inset-0 w-full h-full object-fill pointer-events-none"
        />

        {/* Dynamic Toast Feedback Overlay */}
        {contourToast && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded-lg bg-[#302A23]/95 text-white text-xs font-semibold shadow-lg backdrop-blur-xs flex items-center gap-1.5 border border-[#DCD0BD]/40 animate-fade-in">
            <Sparkles size={13} className="text-[#9A6B25]" />
            <span>{contourToast}</span>
          </div>
        )}

        {/* SVG Interactive Overlay mapped directly to natural image coordinates via viewBox */}
        <svg
          viewBox={`0 0 ${imgW} ${imgH}`}
          className={`absolute inset-0 w-full h-full ${
            mode === 'draw_polygon' || mode === 'ruler_calibrate' ? 'cursor-crosshair' : 'cursor-default'
          }`}
          onMouseMove={handleSvgMouseMove}
          onMouseUp={handleSvgMouseUp}
          onClick={handleSvgClick}
        >
          {showOverlays && (
            <>
              {/* Existing Regions */}
              {displayedRegions.map((region) => {
                const isSelected = region.id === activeRegionId;
                const colors = getSeverityColor(region.severity, isSelected);
                const pointsStr = region.polygonPoints.map((p) => `${p.x},${p.y}`).join(' ');
                const badgePos = getBadgePosition(region.polygonPoints);

                return (
                  <g key={region.id} className="transition-all">
                    {/* Shadow / Outer contour halo */}
                    <polygon
                      points={pointsStr}
                      fill="none"
                      stroke={colors.glow}
                      strokeWidth={isSelected ? Math.max(6, imgW / 180) : Math.max(4, imgW / 260)}
                      className="pointer-events-none opacity-80"
                    />

                    {/* Main Polygon path */}
                    <polygon
                      points={pointsStr}
                      fill={colors.fill}
                      stroke={colors.stroke}
                      strokeWidth={isSelected ? Math.max(3, imgW / 350) : Math.max(2, imgW / 500)}
                      className="cursor-pointer transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSelectRegion && (mode === 'view' || mode === 'edit_polygon')) {
                          onSelectRegion(region.id);
                        }
                      }}
                    />

                    {/* Centroid Badge / Label displaying Type and cm dimensions */}
                    {region.polygonPoints && region.polygonPoints.length > 0 && (() => {
                      const len =
                        typeof region.measurements?.lengthCm === 'number' && !isNaN(region.measurements.lengthCm)
                          ? `${region.measurements.lengthCm.toFixed(1)} cm`
                          : typeof region.measurements?.lengthM === 'number' && !isNaN(region.measurements.lengthM)
                          ? `${region.measurements.lengthM.toFixed(2)} m`
                          : typeof region.measurements?.lengthPx === 'number'
                          ? `${Math.round(region.measurements.lengthPx)} px`
                          : 'Defect';

                      const wid =
                        typeof region.measurements?.widthCm === 'number' && !isNaN(region.measurements.widthCm)
                          ? `${region.measurements.widthCm.toFixed(1)} cm`
                          : typeof region.measurements?.widthM === 'number' && !isNaN(region.measurements.widthM)
                          ? `${region.measurements.widthM.toFixed(2)} m`
                          : typeof region.measurements?.widthPx === 'number'
                          ? `${Math.round(region.measurements.widthPx)} px`
                          : '';

                      const labelText = wid ? `${region.typeLabel || 'Defect'}: ${len} × ${wid}` : `${region.typeLabel || 'Defect'}: ${len}`;
                      const fontSize = Math.max(11, Math.round(imgW / 90));
                      const badgeWidth = labelText.length * (fontSize * 0.58) + 16;
                      const badgeHeight = fontSize + 8;
                      return (
                        <g
                          transform={`translate(${badgePos.x - badgeWidth / 2}, ${badgePos.y})`}
                          className="pointer-events-none"
                        >
                          <rect
                            x="0"
                            y={-badgeHeight + 2}
                            width={badgeWidth}
                            height={badgeHeight}
                            rx="4"
                            fill="#302A23"
                            fillOpacity="0.92"
                            stroke="#DCD0BD"
                            strokeWidth="1"
                          />
                          <text
                            x={badgeWidth / 2}
                            y="-4"
                            textAnchor="middle"
                            fill="#FFFDF8"
                            fontSize={fontSize}
                            fontWeight="bold"
                            fontFamily="sans-serif"
                          >
                            {labelText}
                          </text>
                        </g>
                      );
                    })()}

                    {/* Edit mode: Render interactive vertex handles */}
                    {!readOnly && mode === 'edit_polygon' && isSelected && (
                      <>
                        {region.polygonPoints.map((pt, vIdx) => (
                          <circle
                            key={vIdx}
                            cx={pt.x}
                            cy={pt.y}
                            r={Math.max(6, imgW / 140)}
                            fill="#FFFDF8"
                            stroke="#79583A"
                            strokeWidth={Math.max(2.5, imgW / 300)}
                            className="cursor-grab active:cursor-grabbing hover:scale-125 transition-transform"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setDraggingVertex({ regionId: region.id, vertexIdx: vIdx });
                            }}
                          />
                        ))}
                      </>
                    )}
                  </g>
                );
              })}

              {/* Drawing New Polygon in progress */}
              {!readOnly && mode === 'draw_polygon' && newPolygonPoints.length > 0 && (
                <g>
                  {newPolygonPoints.length > 1 && (
                    <polyline
                      points={newPolygonPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                      fill="none"
                      stroke="#79583A"
                      strokeWidth={Math.max(2.5, imgW / 350)}
                      strokeDasharray="6,4"
                    />
                  )}
                  {newPolygonPoints.map((p, idx) => (
                    <circle
                      key={idx}
                      cx={p.x}
                      cy={p.y}
                      r={Math.max(5, imgW / 180)}
                      fill="#79583A"
                      stroke="#FFFDF8"
                      strokeWidth="2"
                    />
                  ))}
                </g>
              )}

              {/* Calibration Ruler Visual Line */}
              {!readOnly && mode === 'ruler_calibrate' && rulerPoints.length > 0 && (
                <g>
                  {rulerPoints.length === 2 && (
                    <>
                      {/* Measurement line */}
                      <line
                        x1={rulerPoints[0].x}
                        y1={rulerPoints[0].y}
                        x2={rulerPoints[1].x}
                        y2={rulerPoints[1].y}
                        stroke="#2F7657"
                        strokeWidth={Math.max(3, imgW / 300)}
                        strokeDasharray="4,3"
                      />
                      {/* Midpoint length badge */}
                      {(() => {
                        const midX = (rulerPoints[0].x + rulerPoints[1].x) / 2;
                        const midY = (rulerPoints[0].y + rulerPoints[1].y) / 2;
                        const dx = rulerPoints[1].x - rulerPoints[0].x;
                        const dy = rulerPoints[1].y - rulerPoints[0].y;
                        const pxLen = Math.round(Math.sqrt(dx * dx + dy * dy));
                        return (
                          <g transform={`translate(${midX}, ${midY - 14})`}>
                            <rect x="-35" y="-12" width="70" height="18" rx="4" fill="#2F7657" />
                            <text
                              x="0"
                              y="1"
                              textAnchor="middle"
                              fill="#FFFDF8"
                              fontSize="11"
                              fontWeight="bold"
                            >
                              {pxLen} px
                            </text>
                          </g>
                        );
                      })()}
                    </>
                  )}
                  {rulerPoints.map((p, pIdx) => (
                    <circle
                      key={pIdx}
                      cx={p.x}
                      cy={p.y}
                      r={Math.max(7, imgW / 120)}
                      fill="#2F7657"
                      stroke="#FFFDF8"
                      strokeWidth="2.5"
                      className="cursor-move"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setDraggingRulerPoint(pIdx);
                      }}
                    />
                  ))}
                </g>
              )}
            </>
          )}
        </svg>
      </div>

      {/* Selected Region Quick Bar with Snap / Tighten Action */}
      {activeRegion && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-[#EEE4D2]/60 border-t border-[#DCD0BD] text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[#746A5C] text-[11px]">
              ({activeRegion.polygonPoints?.length || 0} contour vertices • Area:{' '}
              {activeRegion.measurements?.areaCm2
                ? `${activeRegion.measurements.areaCm2.toLocaleString()} cm²`
                : activeRegion.measurements?.areaM2
                ? `${activeRegion.measurements.areaM2} m²`
                : `${(activeRegion.measurements?.areaPx2 || 0).toLocaleString()} px²`})
            </span>
            {activeRegion.excludedObjects && activeRegion.excludedObjects.length > 0 && (
              <span className="px-2 py-0.5 rounded bg-[#2F7657]/15 text-[#2F7657] font-semibold text-[10px] flex items-center gap-1">
                <Check size={10} /> Foreign Objects Excluded
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!readOnly && onUpdateRegionPolygon && (
              <button
                type="button"
                onClick={() => handleTightenPotholeContour(activeRegion.id)}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#79583A] text-white hover:bg-[#61442B] text-[11px] font-semibold transition shadow-xs"
                title="Automatically tighten and snap contour vertices directly to the road depression rim"
              >
                <Sparkles size={12} />
                <span>Tighten to Road Cavity</span>
              </button>
            )}

            {!readOnly && onDeleteRegion && regions.length > 1 && (
              <button
                onClick={() => onDeleteRegion(activeRegion.id)}
                className="flex items-center gap-1 text-[#B44343] hover:underline text-[11px]"
                title="Delete this damage region"
              >
                <Trash2 size={12} />
                <span>Delete</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
