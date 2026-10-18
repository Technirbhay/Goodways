import React, { useState, useRef } from 'react';
import { Columns, SplitSquareVertical, CheckCircle2, AlertCircle } from 'lucide-react';

interface BeforeAfterSliderProps {
  beforeImageUrl: string;
  afterImageUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
  beforeDetails?: {
    date?: string;
    damageType?: string;
    severity?: string;
    area?: string;
  };
  afterDetails?: {
    date?: string;
    contractor?: string;
    materials?: string;
    verifiedBy?: string;
  };
}

export const BeforeAfterSlider: React.FC<BeforeAfterSliderProps> = ({
  beforeImageUrl,
  afterImageUrl,
  beforeLabel = 'Original Road Damage',
  afterLabel = 'Completed Repair Verification',
  beforeDetails,
  afterDetails,
}) => {
  const [sliderPosition, setSliderPosition] = useState<number>(50); // percentage (0-100)
  const [viewMode, setViewMode] = useState<'slider' | 'side_by_side'>('slider');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = () => {
    setIsDragging(true);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };

  return (
    <div className="rounded-xl border border-[#DCD0BD] bg-[#FFFDF8] overflow-hidden shadow-xs">
      {/* Header Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#DCD0BD] bg-[#EEE4D2]/40 text-xs text-[#302A23]">
        <div className="flex items-center gap-2">
          <SplitSquareVertical size={15} className="text-[#79583A]" />
          <h4 className="font-semibold text-sm">Before & After Repair Comparison</h4>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setViewMode('slider')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded border text-xs font-medium transition ${
              viewMode === 'slider'
                ? 'bg-[#79583A] text-white border-[#79583A]'
                : 'border-[#DCD0BD] bg-[#FFFDF8] hover:bg-[#EEE4D2] text-[#302A23]'
            }`}
          >
            <SplitSquareVertical size={13} />
            <span>Interactive Slider</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('side_by_side')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded border text-xs font-medium transition ${
              viewMode === 'side_by_side'
                ? 'bg-[#79583A] text-white border-[#79583A]'
                : 'border-[#DCD0BD] bg-[#FFFDF8] hover:bg-[#EEE4D2] text-[#302A23]'
            }`}
          >
            <Columns size={13} />
            <span>Side-by-Side</span>
          </button>
        </div>
      </div>

      {/* Main Comparison Area */}
      {viewMode === 'slider' ? (
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerMove={handlePointerMove}
          className="relative w-full h-[380px] sm:h-[460px] bg-neutral-900 select-none overflow-hidden cursor-ew-resize"
        >
          {/* After image (Background) */}
          <img
            src={afterImageUrl}
            alt="Repaired road condition"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />

          {/* After Badge */}
          <div className="absolute top-3 right-3 z-10 px-2.5 py-1 rounded-md bg-[#2F7657]/90 text-white text-xs font-semibold backdrop-blur-xs flex items-center gap-1">
            <CheckCircle2 size={13} />
            <span>{afterLabel}</span>
          </div>

          {/* Before image (Clipped foreground) */}
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ width: `${sliderPosition}%` }}
          >
            <img
              src={beforeImageUrl}
              alt="Original damaged road"
              className="absolute inset-0 w-full h-full object-cover pointer-events-none max-w-none"
              style={{
                width: containerRef.current ? `${containerRef.current.clientWidth}px` : '100%',
                height: '100%',
              }}
            />
            {/* Before Badge */}
            <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-md bg-[#B44343]/90 text-white text-xs font-semibold backdrop-blur-xs flex items-center gap-1">
              <AlertCircle size={13} />
              <span>{beforeLabel}</span>
            </div>
          </div>

          {/* Draggable Divider Handle */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-white shadow-lg pointer-events-none z-20"
            style={{ left: `${sliderPosition}%` }}
          >
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white text-[#302A23] shadow-md flex items-center justify-center text-xs font-bold border border-gray-300">
              ↔
            </div>
          </div>

          {/* Helper prompt bottom */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/60 text-white text-[11px] backdrop-blur-xs pointer-events-none">
            Drag divider left/right to compare repair quality
          </div>
        </div>
      ) : (
        /* Side by Side Mode */
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[#DCD0BD]">
          {/* Before Column */}
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-[#B44343]">
              <span className="flex items-center gap-1">
                <AlertCircle size={13} /> {beforeLabel}
              </span>
              {beforeDetails?.severity && (
                <span className="capitalize px-1.5 py-0.5 rounded bg-[#B44343]/10 text-[10px]">
                  {beforeDetails.severity} severity
                </span>
              )}
            </div>
            <div className="relative rounded-lg overflow-hidden h-[240px] bg-neutral-900 border border-[#DCD0BD]">
              <img
                src={beforeImageUrl}
                alt={beforeLabel}
                className="w-full h-full object-cover"
              />
            </div>
            {beforeDetails && (
              <div className="text-[11px] text-[#746A5C] space-y-0.5 pt-1">
                {beforeDetails.damageType && <div>Defect: <strong className="text-[#302A23]">{beforeDetails.damageType}</strong></div>}
                {beforeDetails.area && <div>Measured Area: <strong className="text-[#302A23]">{beforeDetails.area}</strong></div>}
                {beforeDetails.date && <div>Captured: {new Date(beforeDetails.date).toLocaleDateString()}</div>}
              </div>
            )}
          </div>

          {/* After Column */}
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-[#2F7657]">
              <span className="flex items-center gap-1">
                <CheckCircle2 size={13} /> {afterLabel}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-[#2F7657]/10 text-[10px]">
                Verified Patch
              </span>
            </div>
            <div className="relative rounded-lg overflow-hidden h-[240px] bg-neutral-900 border border-[#DCD0BD]">
              <img
                src={afterImageUrl}
                alt={afterLabel}
                className="w-full h-full object-cover"
              />
            </div>
            {afterDetails && (
              <div className="text-[11px] text-[#746A5C] space-y-0.5 pt-1">
                {afterDetails.contractor && <div>Contractor: <strong className="text-[#302A23]">{afterDetails.contractor}</strong></div>}
                {afterDetails.materials && <div>Materials: <strong className="text-[#302A23]">{afterDetails.materials}</strong></div>}
                {afterDetails.verifiedBy && <div>Verifier: <strong className="text-[#302A23]">{afterDetails.verifiedBy}</strong></div>}
                {afterDetails.date && <div>Completed: {new Date(afterDetails.date).toLocaleDateString()}</div>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
