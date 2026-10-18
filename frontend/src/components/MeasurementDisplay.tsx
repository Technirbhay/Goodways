import React, { useState } from 'react';
import { DamageRegion, CalibrationData } from '../types';
import { Ruler, ShieldAlert, Info, Layers, CheckCircle, Calculator, ChevronDown, ChevronUp } from 'lucide-react';

interface MeasurementDisplayProps {
  region: DamageRegion;
  calibration: CalibrationData;
  onUpdateCalibration: (newCalibration: CalibrationData) => void;
  onUpdateManualDepth: (depthM: number, shapeFactor: number) => void;
}

export const MeasurementDisplay: React.FC<MeasurementDisplayProps> = ({
  region,
  calibration,
  onUpdateCalibration,
  onUpdateManualDepth,
}) => {
  const [showCalibrationDrawer, setShowCalibrationDrawer] = useState(false);
  const [showFormulas, setShowFormulas] = useState(false);

  // Calibration preset values
  const [customKnownLengthCm, setCustomKnownLengthCm] = useState<string>('12'); // default 12cm
  const [selectedPreset, setSelectedPreset] = useState<string>('lane_marking');

  // Manual depth entry state
  const [depthInputCm, setDepthInputCm] = useState<string>(
    region.measurements.depthEstimatedM ? (region.measurements.depthEstimatedM * 100).toFixed(1) : ''
  );
  const [shapeFactor, setShapeFactor] = useState<number>(region.measurements.volumeShapeFactor || 0.5);

  const m = region.measurements;

  // Apply calibration preset
  const handleApplyPreset = (presetKey: string) => {
    setSelectedPreset(presetKey);
    let knownM = 0.12;
    let label = 'Standard 120mm Road Stripe';

    if (presetKey === 'manhole') {
      knownM = 0.60;
      label = 'Standard 600mm Manhole Cover';
    } else if (presetKey === 'curb') {
      knownM = 0.15;
      label = 'Standard 150mm Concrete Curb';
    } else if (presetKey === 'card') {
      knownM = 0.0856;
      label = 'Standard 85.6mm Reference Card';
    } else if (presetKey === 'custom') {
      const parsed = parseFloat(customKnownLengthCm);
      knownM = isNaN(parsed) || parsed <= 0 ? 0.12 : parsed / 100;
      label = `Custom Reference (${(knownM * 100).toFixed(1)} cm)`;
    }

    // If ruler pixel length exists, calculate scale
    const pxLen = calibration.referencePixelLength || 100;
    const scaleMPerPx = knownM / pxLen;
    const scaleMmPerPx = scaleMPerPx * 1000;

    onUpdateCalibration({
      isCalibrated: true,
      scaleMPerPx,
      scaleMmPerPx,
      referenceMethod: presetKey as any,
      referenceLabel: label,
      referenceLengthM: knownM,
      referencePixelLength: pxLen,
      perspectiveNote: 'Planar surface approximation across pavement plane',
    });
  };

  const handleApplyDepth = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedCm = parseFloat(depthInputCm);
    if (!isNaN(parsedCm) && parsedCm > 0) {
      onUpdateManualDepth(parsedCm / 100, shapeFactor);
    } else {
      onUpdateManualDepth(0, shapeFactor);
    }
  };

  return (
    <div className="space-y-4">
      {/* Primary Mathematical Measurements Card */}
      <div className="rounded-xl border border-[#DCD0BD] bg-[#FFFDF8] p-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#DCD0BD] pb-2.5 mb-3">
          <div className="flex items-center gap-2">
            <Calculator size={16} className="text-[#79583A]" />
            <h3 className="font-semibold text-sm text-[#302A23]">Mathematical Measurement Engine</h3>
          </div>
          {calibration.isCalibrated ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#2F7657]/10 text-[#2F7657]">
              <CheckCircle size={11} /> Calibrated Scale (cm)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#2F7657]/10 text-[#2F7657]">
              <CheckCircle size={11} /> Centimeter Metric Engine (Active)
            </span>
          )}
        </div>

        {/* 4-Cell Measurement Grid in Centimeters (Primary) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
          {/* Length in cm */}
          <div className="rounded-lg bg-[#EEE4D2]/40 p-2.5 border border-[#DCD0BD]/60">
            <div className="text-[11px] text-[#746A5C] uppercase tracking-wider font-semibold">Length (cm)</div>
            <div className="text-lg font-bold text-[#302A23] mt-0.5">
              <span>{typeof m?.lengthCm === 'number' && !isNaN(m.lengthCm) ? `${m.lengthCm.toFixed(1)} cm` : '—'}</span>
            </div>
            <div className="text-[10px] text-[#746A5C] mt-0.5">
              {typeof m?.lengthM === 'number' && m.lengthM >= 1 ? `${m.lengthM.toFixed(2)} m • ` : ''}
              {typeof m?.lengthPx === 'number' ? `${m.lengthPx.toFixed(1)} px` : '—'}
            </div>
          </div>

          {/* Width in cm */}
          <div className="rounded-lg bg-[#EEE4D2]/40 p-2.5 border border-[#DCD0BD]/60">
            <div className="text-[11px] text-[#746A5C] uppercase tracking-wider font-semibold">Width (cm)</div>
            <div className="text-lg font-bold text-[#302A23] mt-0.5">
              <span>{typeof m?.widthCm === 'number' && !isNaN(m.widthCm) ? `${m.widthCm.toFixed(1)} cm` : '—'}</span>
            </div>
            <div className="text-[10px] text-[#746A5C] mt-0.5">
              {typeof m?.widthM === 'number' && m.widthM >= 1 ? `${m.widthM.toFixed(2)} m • ` : ''}
              {typeof m?.widthPx === 'number' ? `${m.widthPx.toFixed(1)} px` : '—'}
            </div>
          </div>

          {/* Surface Area in cm² */}
          <div className="rounded-lg bg-[#EEE4D2]/40 p-2.5 border border-[#DCD0BD]/60">
            <div className="text-[11px] text-[#746A5C] uppercase tracking-wider font-semibold">Surface Area (cm²)</div>
            <div className="text-lg font-bold text-[#302A23] mt-0.5">
              <span>{typeof m?.areaCm2 === 'number' && !isNaN(m.areaCm2) ? `${m.areaCm2.toLocaleString()} cm²` : '—'}</span>
            </div>
            <div className="text-[10px] text-[#746A5C] mt-0.5">
              {typeof m?.areaM2 === 'number' ? `${m.areaM2.toFixed(3)} m² • ` : ''}
              {typeof m?.areaPx2 === 'number' ? `${m.areaPx2.toLocaleString()} px²` : '—'}
            </div>
          </div>

          {/* Perimeter in cm */}
          <div className="rounded-lg bg-[#EEE4D2]/40 p-2.5 border border-[#DCD0BD]/60">
            <div className="text-[11px] text-[#746A5C] uppercase tracking-wider font-semibold">Perimeter (cm)</div>
            <div className="text-lg font-bold text-[#302A23] mt-0.5">
              <span>{typeof m?.perimeterCm === 'number' && !isNaN(m.perimeterCm) ? `${m.perimeterCm.toFixed(1)} cm` : '—'}</span>
            </div>
            <div className="text-[10px] text-[#746A5C] mt-0.5">
              {typeof m?.perimeterM === 'number' && m.perimeterM >= 1 ? `${m.perimeterM.toFixed(2)} m • ` : ''}
              {typeof m?.perimeterPx === 'number' ? `${m.perimeterPx.toFixed(1)} px` : '—'}
            </div>
          </div>
        </div>

        {/* Road Surface & Exclusion Verification Badge */}
        <div className="mt-2.5 p-2 rounded-lg bg-[#2F7657]/10 border border-[#2F7657]/20 flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
          <div className="flex items-center gap-1.5 font-semibold text-[#2F7657]">
            <CheckCircle size={12} />
            <span>
              Surface: {region.surfaceType === 'dirt_land_road' ? 'Unpaved Land / Dirt Road' : 'Paved Roadway Asphalt'}
            </span>
          </div>
          {region.excludedObjects && region.excludedObjects.length > 0 ? (
            <span className="text-[#4B4136]">
              Foreign Items Filtered: <strong className="text-[#302A23]">{region.excludedObjects.join(' • ')}</strong>
            </span>
          ) : (
            <span className="text-[#4B4136]">
              Bottles & debris strictly filtered out of boundary
            </span>
          )}
        </div>

        {/* Aspect Ratio and Geometry Details */}
        <div className="mt-3 pt-2.5 border-t border-[#DCD0BD]/60 flex flex-wrap items-center justify-between text-xs text-[#746A5C]">
          <span>
            Aspect Ratio (L/W): <strong className="text-[#302A23]">{m.aspectRatio}:1</strong>
          </span>
          <span>
            Boundary Vertices: <strong className="text-[#302A23]">{region.polygonPoints.length} points</strong>
          </span>
          <button
            onClick={() => setShowFormulas(!showFormulas)}
            className="text-[#79583A] hover:underline flex items-center gap-0.5 text-[11px]"
          >
            <span>{showFormulas ? 'Hide Formulas' : 'View Math Formulas'}</span>
            {showFormulas ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>

        {/* Mathematical Formulas Expandable Panel */}
        {showFormulas && (
          <div className="mt-3 p-3 rounded-lg bg-[#F7F2E8] border border-[#DCD0BD] text-xs space-y-1.5 text-[#302A23]">
            <p className="font-semibold text-[#79583A]">Mathematical Centimeter Engine Specifications:</p>
            <p>
              • <strong>Shoelace Area:</strong>{' '}
              <code className="bg-[#EEE4D2] px-1 py-0.5 rounded text-[11px]">
                A_px² = 0.5 × |∑(x_i·y_(i+1) - x_(i+1)·y_i)| → A_cm² = A_px² · s²_cm
              </code>
            </p>
            <p>
              • <strong>Closed Perimeter:</strong>{' '}
              <code className="bg-[#EEE4D2] px-1 py-0.5 rounded text-[11px]">
                P_px = ∑ √((x_(i+1)-x_i)² + (y_(i+1)-y_i)²) → P_cm = P_px · s_cm
              </code>
            </p>
            <p>
              • <strong>Centimeter Extent (OBB):</strong> Rotating Calipers over 2D Convex Hull for minimum-area bounding box extent (L_cm = L_px · s_cm, W_cm = W_px · s_cm).
            </p>
            <p>
              • <strong>Asphalt Volume:</strong>{' '}
              <code className="bg-[#EEE4D2] px-1 py-0.5 rounded text-[11px]">
                V_cm³ = Area_cm² × Depth_cm × k (k=0.5 for bowl, k=1.0 for milled box)
              </code>
            </p>
          </div>
        )}
      </div>

      {/* Metric Scale Calibration Drawer */}
      <div className="rounded-xl border border-[#DCD0BD] bg-[#FFFDF8] p-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ruler size={16} className="text-[#79583A]" />
            <div>
              <h4 className="font-semibold text-sm text-[#302A23]">Metric Scale Calibration</h4>
              <p className="text-[11px] text-[#746A5C]">
                {calibration.isCalibrated
                  ? `Active: ${calibration.referenceLabel} (${(calibration.scaleMmPerPx || 0).toFixed(2)} mm/px)`
                  : 'Convert pixel dimensions into real-world meters & centimeters'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCalibrationDrawer(!showCalibrationDrawer)}
            className="text-xs font-semibold px-2.5 py-1.5 rounded border border-[#DCD0BD] bg-[#EEE4D2]/60 hover:bg-[#EEE4D2] text-[#302A23] transition"
          >
            {showCalibrationDrawer ? 'Collapse' : 'Calibrate'}
          </button>
        </div>

        {showCalibrationDrawer && (
          <div className="mt-3 pt-3 border-t border-[#DCD0BD] space-y-3">
            <div className="text-xs text-[#746A5C]">
              Select a known standard reference object in the roadway or use the canvas ruler to calibrate:
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleApplyPreset('lane_marking')}
                className={`p-2.5 rounded-lg border text-left transition ${
                  selectedPreset === 'lane_marking'
                    ? 'border-[#79583A] bg-[#EEE4D2]/80 font-medium'
                    : 'border-[#DCD0BD] hover:bg-[#EEE4D2]/40'
                }`}
              >
                <div className="font-semibold text-[#302A23]">Road Stripe (12 cm / 0.12 m)</div>
                <div className="text-[11px] text-[#746A5C]">Standard highway/arterial stripe width</div>
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset('manhole')}
                className={`p-2.5 rounded-lg border text-left transition ${
                  selectedPreset === 'manhole'
                    ? 'border-[#79583A] bg-[#EEE4D2]/80 font-medium'
                    : 'border-[#DCD0BD] hover:bg-[#EEE4D2]/40'
                }`}
              >
                <div className="font-semibold text-[#302A23]">Manhole Cover (60 cm / 0.60 m)</div>
                <div className="text-[11px] text-[#746A5C]">Standard municipal iron casting diameter</div>
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset('curb')}
                className={`p-2.5 rounded-lg border text-left transition ${
                  selectedPreset === 'curb'
                    ? 'border-[#79583A] bg-[#EEE4D2]/80 font-medium'
                    : 'border-[#DCD0BD] hover:bg-[#EEE4D2]/40'
                }`}
              >
                <div className="font-semibold text-[#302A23]">Concrete Curb (15 cm / 0.15 m)</div>
                <div className="text-[11px] text-[#746A5C]">Standard vertical curb reveal height</div>
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset('card')}
                className={`p-2.5 rounded-lg border text-left transition ${
                  selectedPreset === 'card'
                    ? 'border-[#79583A] bg-[#EEE4D2]/80 font-medium'
                    : 'border-[#DCD0BD] hover:bg-[#EEE4D2]/40'
                }`}
              >
                <div className="font-semibold text-[#302A23]">Reference Card (8.56 cm)</div>
                <div className="text-[11px] text-[#746A5C]">Standard ISO/IEC 7810 ID card length</div>
              </button>
            </div>

            {/* Custom length entry */}
            <div className="flex items-center gap-2 pt-1 text-xs">
              <span className="text-[#746A5C]">Custom Object Length:</span>
              <input
                type="number"
                step="0.1"
                min="1"
                value={customKnownLengthCm}
                onChange={(e) => setCustomKnownLengthCm(e.target.value)}
                placeholder="cm"
                className="w-20 px-2 py-1 rounded border border-[#DCD0BD] bg-[#FFFDF8] text-right font-medium"
              />
              <span className="text-[#746A5C]">cm</span>
              <button
                type="button"
                onClick={() => handleApplyPreset('custom')}
                className="px-2.5 py-1 rounded bg-[#79583A] text-white font-medium hover:bg-[#61442B] transition"
              >
                Apply Custom Scale
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Depth and Volume Engineering Panel */}
      <div className="rounded-xl border border-[#DCD0BD] bg-[#FFFDF8] p-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#DCD0BD] pb-2 mb-3">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-[#79583A]" />
            <h4 className="font-semibold text-sm text-[#302A23]">Depth & Repair Patch Volume</h4>
          </div>
          <span className="text-[11px] text-[#746A5C]">Formula: V ≈ A · d · k</span>
        </div>

        {/* Monocular RGB Limitation Explanation */}
        <div className="rounded-lg bg-[#EEE4D2]/50 p-2.5 border border-[#DCD0BD]/80 flex items-start gap-2 text-xs mb-3 text-[#4B4136]">
          <ShieldAlert size={14} className="text-[#9A6B25] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Monocular Photometry Notice:</strong> An ordinary 2D photograph does not contain physical depth data. Absolute depth requires either in-situ field measurement or calibrated sensor depth maps. Enter the measured depth below to calculate exact asphalt patch volume.
          </p>
        </div>

        {/* Calculated Volume Output */}
        <div className="grid grid-cols-2 gap-3 mb-3 text-center">
          <div className="p-2.5 rounded-lg bg-[#EEE4D2]/30 border border-[#DCD0BD]">
            <div className="text-[11px] text-[#746A5C] uppercase font-semibold">Mean Depth</div>
            <div className="text-sm font-bold text-[#302A23] mt-0.5">
              {m.depthEstimatedCm !== undefined ? `${m.depthEstimatedCm.toFixed(1)} cm` : 'Depth not measured'}
            </div>
            <div className="text-[10px] text-[#746A5C]">
              {m.depthSource === 'manual_field_entry' ? 'Verified in-situ gauge' : 'Waterlogged / Monocular RGB'}
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-[#EEE4D2]/30 border border-[#DCD0BD]">
            <div className="text-[11px] text-[#746A5C] uppercase font-semibold">Estimated Volume</div>
            <div className="text-sm font-bold text-[#302A23] mt-0.5">
              {m.volumeCm3 !== undefined ? `${m.volumeCm3.toLocaleString()} cm³` : 'Volume withheld'}
            </div>
            <div className="text-[10px] text-[#746A5C]">
              {m.volumeM3 !== undefined
                ? `≈ ${m.volumeM3.toFixed(4)} m³`
                : 'Requires field depth entry'}
            </div>
          </div>
        </div>

        {/* Field Inspector Depth Input Section */}
        <div className="space-y-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <label htmlFor="depth-input" className="font-medium text-[#302A23]">
                Inspector Depth:
              </label>
              <input
                id="depth-input"
                type="number"
                step="0.5"
                min="0"
                max="50"
                placeholder="e.g. 7.5"
                value={depthInputCm}
                onChange={(e) => setDepthInputCm(e.target.value)}
                className="w-20 px-2 py-1 rounded border border-[#DCD0BD] bg-[#FFFDF8] text-right font-medium"
              />
              <span className="text-[#746A5C]">cm</span>
            </div>

            <div className="flex items-center gap-1.5">
              <label htmlFor="shape-factor" className="font-medium text-[#302A23]">
                Crater Shape (k):
              </label>
              <select
                id="shape-factor"
                value={shapeFactor}
                onChange={(e) => setShapeFactor(parseFloat(e.target.value))}
                className="px-2 py-1 rounded border border-[#DCD0BD] bg-[#FFFDF8] font-medium"
              >
                <option value={0.5}>Parabolic Bowl (k = 0.50)</option>
                <option value={0.67}>Trapezoid Trench (k = 0.67)</option>
                <option value={1.0}>Uniform Milled Box (k = 1.00)</option>
              </select>
            </div>

            <button
              type="button"
              onClick={(e) => handleApplyDepth(e as any)}
              className="px-3 py-1 rounded bg-[#79583A] text-white font-medium hover:bg-[#61442B] transition cursor-pointer"
            >
              Update Volume
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
