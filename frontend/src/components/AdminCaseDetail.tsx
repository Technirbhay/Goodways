import React, { useState } from 'react';
import { RoadCase, Department, CaseStatus, Point2D } from '../types';
import { BeforeAfterSlider } from './BeforeAfterSlider';
import { RoadGoogleMap } from './RoadGoogleMap';
import { DamageCanvas } from './DamageCanvas';
import { apiUrl } from '../api';
import { calculateAllMeasurements } from '../utils/geometry';
import {
  ArrowLeft,
  Building,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Upload,
  UserCheck,
  Send,
  Loader2,
  FileText,
  ShieldCheck,
  Truck,
  Wrench,
  Landmark,
} from 'lucide-react';

interface AdminCaseDetailProps {
  roadCase: RoadCase;
  departments: Department[];
  onBack: () => void;
  onUpdateCase: (updatedCase: RoadCase) => void;
  onOpenGovtPortal?: (targetCase?: RoadCase) => void;
  mapsApiKey?: string;
}

export const AdminCaseDetail: React.FC<AdminCaseDetailProps> = ({
  roadCase,
  departments,
  onBack,
  onUpdateCase,
  onOpenGovtPortal,
  mapsApiKey,
}) => {
  // Status transition form state
  const [selectedStatus, setSelectedStatus] = useState<CaseStatus>(roadCase.status);
  const [selectedDept, setSelectedDept] = useState<string>(roadCase.assignedDepartment || departments[0]?.name || '');
  const [assignedTeam, setAssignedTeam] = useState<string>(roadCase.assignedTeam || '');
  const [estDate, setEstDate] = useState<string>(roadCase.estimatedCompletionDate || '');
  const [priorityScore, setPriorityScore] = useState<number>(roadCase.priorityScore || 50);
  const [officialName, setOfficialName] = useState<string>('Supervisor David Chen');
  const [statusNotes, setStatusNotes] = useState<string>('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [activeRegionId, setActiveRegionId] = useState<string>(roadCase.damageRegions[0]?.id || '');

  // Repair evidence upload state
  const [repairStage, setRepairStage] = useState<'in_progress' | 'completed'>('completed');
  const [repairPhotoUrl, setRepairPhotoUrl] = useState<string>('');
  const [repairNotes, setRepairNotes] = useState<string>('');
  const [contractorName, setContractorName] = useState<string>('Apex Civil Works Corp');
  const [materialsUsed, setMaterialsUsed] = useState<string>('Hot-Mix Asphalt Concrete (HMA), rubberized tack sealant');
  const [isUploadingEvidence, setIsUploadingEvidence] = useState<boolean>(false);

  // Verification checklist state
  const [verifierName, setVerifierName] = useState<string>('Inspector Elena Rostova');
  const [verifierBadge, setVerifierBadge] = useState<string>('CITY-PW-702');
  const [verifyDecision, setVerifyDecision] = useState<'approved' | 'rework_needed' | 'rejected'>('approved');
  const [verifyNotes, setVerifyNotes] = useState<string>('Surface tested flush with crown; edge seam rubberized seal intact; zero debris left on roadway.');
  const [checklist, setChecklist] = useState({
    surfaceFlatnessConfirmed: true,
    edgeSealingInspected: true,
    debrisCleared: true,
    drainageIntegrityVerified: true,
    trafficSafetyReopened: true,
  });
  const [isSubmittingVerify, setIsSubmittingVerify] = useState<boolean>(false);

  // Handle case status & department assignment update
  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(apiUrl(`/api/cases/${roadCase.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: selectedStatus,
          assignedDepartment: selectedDept,
          assignedTeam: assignedTeam.trim() || undefined,
          estimatedCompletionDate: estDate || undefined,
          priorityScore,
          actorName: officialName,
          actorRole: 'official',
          actionNotes: statusNotes || `Case assigned to ${selectedDept}`,
        }),
      });
      if (!res.ok) throw new Error('Failed to update case');
      const updated = await res.json();
      onUpdateCase(updated);
      setStatusNotes('');
    } catch (err: any) {
      alert('Error updating case: ' + err.message);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Handle repair photo upload
  const handleUploadRepairEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repairPhotoUrl) {
      alert('Please enter or select a repair photograph URL');
      return;
    }
    setIsUploadingEvidence(true);
    try {
      const res = await fetch(apiUrl(`/api/cases/${roadCase.id}/repair-evidence`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: repairStage,
          imageUrl: repairPhotoUrl,
          notes: repairNotes,
          contractorName,
          materialsUsed,
          actorName: officialName,
        }),
      });
      if (!res.ok) throw new Error('Failed to upload repair evidence');
      const updated = await res.json();
      onUpdateCase(updated);
      setRepairPhotoUrl('');
      setRepairNotes('');
    } catch (err: any) {
      alert('Error saving repair evidence: ' + err.message);
    } finally {
      setIsUploadingEvidence(false);
    }
  };

  // Handle verification sign-off
  const handleVerifySignOff = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingVerify(true);
    try {
      const res = await fetch(apiUrl(`/api/cases/${roadCase.id}/verify`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verifierName,
          verifierBadge,
          decision: verifyDecision,
          checklist,
          notes: verifyNotes,
        }),
      });
      if (!res.ok) throw new Error('Failed to complete verification');
      const updated = await res.json();
      onUpdateCase(updated);
    } catch (err: any) {
      alert('Error completing verification: ' + err.message);
    } finally {
      setIsSubmittingVerify(false);
    }
  };

  const firstDmg = roadCase.damageRegions[0];
  const finalRepair = roadCase.repairEvidences?.find((e) => e.stage === 'completed') || roadCase.repairEvidences?.[roadCase.repairEvidences.length - 1];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DCD0BD] pb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-[#79583A] hover:underline self-start"
        >
          <ArrowLeft size={14} />
          <span>Back to Operations Dashboard</span>
        </button>

        <div className="flex items-center gap-2">
          {onOpenGovtPortal && (
            <button
              type="button"
              onClick={() => onOpenGovtPortal(roadCase)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#2F7657]/40 bg-[#2F7657]/10 text-[#2F7657] hover:bg-[#2F7657]/20 transition text-xs font-bold shadow-2xs cursor-pointer"
              title="Open Government Grievance Sync (CPGRAMS / NHAI / PWD)"
            >
              <Landmark size={14} />
              <span>
                {roadCase.governmentIntegration?.externalReferenceId
                  ? `Govt Docket: ${roadCase.governmentIntegration.externalReferenceId}`
                  : 'Govt Grievance Portal Sync (Free)'}
              </span>
            </button>
          )}
          <span className="text-xs font-mono font-bold text-[#746A5C]">{roadCase.id}</span>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#79583A]/10 text-[#79583A] border border-[#79583A]/30">
            {roadCase.status}
          </span>
        </div>
      </div>

      {/* Main Grid: Overview & Workflow Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Case Evidence & Measurements (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Defect Overview Header */}
          <div className="rounded-xl border border-[#DCD0BD] bg-[#FFFDF8] p-5 shadow-xs space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#302A23]">{roadCase.roadName}</h2>
                <div className="flex flex-wrap items-center gap-3 text-xs text-[#746A5C] mt-1.5">
                  <span className="flex items-center gap-1">
                    <MapPin size={13} className="text-[#79583A]" />
                    {roadCase.location.latitude.toFixed(6)}, {roadCase.location.longitude.toFixed(6)}
                  </span>
                  <span>•</span>
                  <span>Source: {roadCase.location.source.toUpperCase()}</span>
                  <span>•</span>
                  <span>Priority Score: {roadCase.priorityScore}/100</span>
                </div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase ${
                  roadCase.overallSeverity === 'critical'
                    ? 'bg-[#B44343]/15 text-[#B44343]'
                    : roadCase.overallSeverity === 'high'
                    ? 'bg-[#9A6B25]/15 text-[#9A6B25]'
                    : 'bg-[#79583A]/15 text-[#79583A]'
                }`}
              >
                {roadCase.overallSeverity}
              </span>
            </div>

            {roadCase.summary && (
              <p className="text-xs text-[#4B4136] leading-relaxed bg-[#EEE4D2]/30 p-2.5 rounded-lg border border-[#DCD0BD]/60">
                {roadCase.summary}
              </p>
            )}

            {/* Google Maps Defect Geolocation */}
            <div className="pt-2 border-t border-[#DCD0BD]/60 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#302A23] flex items-center gap-1.5">
                  <MapPin size={13} className="text-[#79583A]" />
                  <span>Google Maps Geolocation</span>
                </span>
                <span className="text-[#746A5C] font-mono text-[11px]">
                  {roadCase.location.latitude.toFixed(6)}, {roadCase.location.longitude.toFixed(6)}
                </span>
              </div>
              <RoadGoogleMap
                apiKey={mapsApiKey}
                singlePin={{
                  location: roadCase.location,
                  roadName: roadCase.roadName,
                }}
                height="200px"
                defaultZoom={15}
              />
            </div>
          </div>

          {/* Original Road Photograph & Interactive Damage Canvas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs px-1">
              <span className="font-bold text-[#302A23]">Road Surface Defect Canvas (Official Inspection)</span>
              <span className="text-[11px] text-[#746A5C]">
                {roadCase.damageRegions.length} verified damage boundary region{roadCase.damageRegions.length === 1 ? '' : 's'}
              </span>
            </div>
            <DamageCanvas
              imageUrl={roadCase.originalImageUrl}
              imageDimensions={roadCase.imageDimensions}
              regions={roadCase.damageRegions}
              activeRegionId={activeRegionId || roadCase.damageRegions[0]?.id}
              calibration={roadCase.calibration}
              readOnly={false}
              onSelectRegion={(id) => setActiveRegionId(id)}
              onUpdateRegionPolygon={(regionId, newPoints) => {
                const updatedRegions = roadCase.damageRegions.map((r) => {
                  if (r.id !== regionId) return r;
                  return {
                    ...r,
                    polygonPoints: newPoints,
                    measurements: calculateAllMeasurements(
                      newPoints,
                      roadCase.calibration,
                      r.measurements.depthEstimatedM,
                      r.measurements.volumeShapeFactor
                    ),
                    userModified: true,
                  };
                });
                onUpdateCase({
                  ...roadCase,
                  damageRegions: updatedRegions,
                });
              }}
              onCalibrateWithRuler={(p1, p2, pxLen) => {
                const knownM = 0.12;
                const scaleMPerPx = knownM / pxLen;
                const newCalib = {
                  isCalibrated: true,
                  scaleMPerPx,
                  scaleMmPerPx: scaleMPerPx * 1000,
                  referenceMethod: 'manual_ruler' as const,
                  referenceLabel: `Canvas Ruler (${pxLen.toFixed(0)} px = 12 cm)`,
                  referenceLengthM: knownM,
                  referencePixelLength: Math.round(pxLen),
                };
                const updatedRegions = roadCase.damageRegions.map((r) => ({
                  ...r,
                  measurements: calculateAllMeasurements(
                    r.polygonPoints,
                    newCalib,
                    r.measurements.depthEstimatedM,
                    r.measurements.volumeShapeFactor
                  ),
                }));
                onUpdateCase({
                  ...roadCase,
                  calibration: newCalib,
                  damageRegions: updatedRegions,
                });
              }}
            />
          </div>

          {/* Mathematical Measurements Card */}
          <div className="rounded-xl border border-[#DCD0BD] bg-[#FFFDF8] p-4 shadow-xs space-y-3">
            <h4 className="font-bold text-sm text-[#302A23]">Mathematical Geometry & Dimension Breakdown</h4>
            {roadCase.damageRegions.map((region, idx) => (
              <div key={region.id} className="p-3 rounded-lg bg-[#EEE4D2]/40 border border-[#DCD0BD] text-xs space-y-2">
                <div className="flex items-center justify-between font-semibold text-[#302A23]">
                  <span>Region #{idx + 1}: {region.typeLabel}</span>
                  <span className="text-[11px] text-[#79583A]">Confidence: {Math.round(region.confidence * 100)}%</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[11px] pt-1">
                  <div className="p-1.5 bg-[#FFFDF8] rounded border border-[#DCD0BD]/80">
                    <div className="text-[10px] text-[#746A5C] font-semibold">Length</div>
                    <div className="font-bold text-[#302A23]">
                      {region.measurements.lengthCm ? `${region.measurements.lengthCm.toFixed(1)} cm` : `${region.measurements.lengthPx} px`}
                    </div>
                  </div>
                  <div className="p-1.5 bg-[#FFFDF8] rounded border border-[#DCD0BD]/80">
                    <div className="text-[10px] text-[#746A5C] font-semibold">Width</div>
                    <div className="font-bold text-[#302A23]">
                      {region.measurements.widthCm ? `${region.measurements.widthCm.toFixed(1)} cm` : `${region.measurements.widthPx} px`}
                    </div>
                  </div>
                  <div className="p-1.5 bg-[#FFFDF8] rounded border border-[#DCD0BD]/80">
                    <div className="text-[10px] text-[#746A5C] font-semibold">Projected Area</div>
                    <div className="font-bold text-[#302A23]">
                      {region.measurements.areaCm2 ? `${region.measurements.areaCm2.toLocaleString()} cm²` : `${region.measurements.areaPx2} px²`}
                    </div>
                  </div>
                  <div className="p-1.5 bg-[#FFFDF8] rounded border border-[#DCD0BD]/80">
                    <div className="text-[10px] text-[#746A5C] font-semibold">Volume (k={region.measurements.volumeShapeFactor || 0.5})</div>
                    <div className="font-bold text-[#302A23]">
                      {region.measurements.volumeCm3 ? `${region.measurements.volumeCm3.toLocaleString()} cm³` : 'Pending depth'}
                    </div>
                  </div>
                </div>
                {region.visibleCharacteristics && (
                  <div className="text-[11px] text-[#746A5C] pt-1">
                    <strong>Pavement Characteristics:</strong> {region.visibleCharacteristics.join(' • ')}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Before & After Interactive Slider (if repair evidence present) */}
          {finalRepair && (
            <BeforeAfterSlider
              beforeImageUrl={roadCase.originalImageUrl}
              afterImageUrl={finalRepair.imageUrl}
              beforeLabel="Damaged Roadway"
              afterLabel="Repaired Roadway"
              beforeDetails={{
                date: roadCase.createdAt,
                damageType: firstDmg?.typeLabel,
                severity: roadCase.overallSeverity,
                area: firstDmg?.measurements.areaM2 ? `${firstDmg.measurements.areaM2} m²` : undefined,
              }}
              afterDetails={{
                date: finalRepair.timestamp,
                contractor: finalRepair.contractorName,
                materials: finalRepair.materialsUsed,
                verifiedBy: roadCase.verification?.verifierName,
              }}
            />
          )}
        </div>

        {/* Right Column: Administrative Forwarding, Repair Upload, Verification (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* 1. Forwarding & Assignment Panel */}
          <form
            onSubmit={handleSaveAssignment}
            className="rounded-xl border border-[#DCD0BD] bg-[#FFFDF8] p-4 shadow-xs space-y-3.5"
          >
            <div className="flex items-center justify-between border-b border-[#DCD0BD] pb-2">
              <div className="flex items-center gap-1.5 font-bold text-sm text-[#302A23]">
                <Building size={15} className="text-[#79583A]" />
                <span>Department Routing & Assignment</span>
              </div>
              <span className="text-[11px] text-[#746A5C]">Authorized Official</span>
            </div>

            {/* Department Selection */}
            <div>
              <label htmlFor="dept-select" className="block text-xs font-semibold text-[#302A23] mb-1">
                Responsible Public Works Department
              </label>
              <select
                id="dept-select"
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-[#DCD0BD] bg-[#FFFDF8] text-xs font-medium text-[#302A23]"
              >
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.name}>
                    {dept.name} ({dept.jurisdiction})
                  </option>
                ))}
              </select>
            </div>

            {/* Assigned Contractor / Crew */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="assigned-team" className="block text-xs font-semibold text-[#302A23] mb-1">
                  Assigned Crew / Unit
                </label>
                <input
                  id="assigned-team"
                  type="text"
                  placeholder="e.g. Patch Crew #4"
                  value={assignedTeam}
                  onChange={(e) => setAssignedTeam(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#DCD0BD] bg-[#FFFDF8] text-xs font-medium"
                />
              </div>
              <div>
                <label htmlFor="est-date" className="block text-xs font-semibold text-[#302A23] mb-1">
                  Est. Completion
                </label>
                <input
                  id="est-date"
                  type="date"
                  value={estDate}
                  onChange={(e) => setEstDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#DCD0BD] bg-[#FFFDF8] text-xs font-medium"
                />
              </div>
            </div>

            {/* Case Status Lifecycle Transition */}
            <div>
              <label htmlFor="status-select" className="block text-xs font-semibold text-[#302A23] mb-1">
                Case Status Transition
              </label>
              <select
                id="status-select"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as CaseStatus)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-[#DCD0BD] bg-[#FFFDF8] text-xs font-bold text-[#79583A]"
              >
                <option value="Submitted">Submitted</option>
                <option value="Pending Review">Pending Review</option>
                <option value="Accepted">Accepted</option>
                <option value="Assigned">Assigned</option>
                <option value="Repair In Progress">Repair In Progress</option>
                <option value="Awaiting Verification">Awaiting Verification</option>
                <option value="Resolved">Resolved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            {/* Priority Score Slider */}
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-[#302A23] mb-1">
                <span>Priority Score (1-100)</span>
                <span className="font-bold text-[#79583A]">{priorityScore}</span>
              </div>
              <input
                type="range"
                min="1"
                max="100"
                value={priorityScore}
                onChange={(e) => setPriorityScore(parseInt(e.target.value, 10))}
                className="w-full accent-[#79583A]"
              />
            </div>

            {/* Official Name & Progress Notes */}
            <div>
              <label htmlFor="official-name" className="block text-xs font-semibold text-[#302A23] mb-1">
                Official Signing Action
              </label>
              <input
                id="official-name"
                type="text"
                value={officialName}
                onChange={(e) => setOfficialName(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-[#DCD0BD] bg-[#FFFDF8] text-xs font-medium mb-2"
              />
              <textarea
                rows={2}
                placeholder="Operational notes regarding assignment or priority..."
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-[#DCD0BD] bg-[#FFFDF8] text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={isUpdatingStatus}
              className="w-full py-2 rounded-lg bg-[#79583A] text-white text-xs font-bold hover:bg-[#61442B] transition flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isUpdatingStatus ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              <span>Save Case Assignment</span>
            </button>
          </form>

          {/* 2. Upload Repair Evidence Panel */}
          <form
            onSubmit={handleUploadRepairEvidence}
            className="rounded-xl border border-[#DCD0BD] bg-[#FFFDF8] p-4 shadow-xs space-y-3"
          >
            <div className="flex items-center justify-between border-b border-[#DCD0BD] pb-2">
              <div className="flex items-center gap-1.5 font-bold text-sm text-[#302A23]">
                <Wrench size={15} className="text-[#79583A]" />
                <span>Upload Repair Evidence</span>
              </div>
              <span className="text-[11px] text-[#746A5C]">Field Crew Action</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label htmlFor="repair-stage" className="block font-semibold text-[#302A23] mb-1">
                  Repair Stage
                </label>
                <select
                  id="repair-stage"
                  value={repairStage}
                  onChange={(e) => setRepairStage(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#DCD0BD] bg-[#FFFDF8] font-medium"
                >
                  <option value="in_progress">In-Progress (Milled/Subgrade)</option>
                  <option value="completed">Completed Patch (Final)</option>
                </select>
              </div>
              <div>
                <label htmlFor="contractor" className="block font-semibold text-[#302A23] mb-1">
                  Contractor / Crew
                </label>
                <input
                  id="contractor"
                  type="text"
                  value={contractorName}
                  onChange={(e) => setContractorName(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#DCD0BD] bg-[#FFFDF8]"
                />
              </div>
            </div>

            {/* Repair Photo URL or Presets */}
            <div>
              <label htmlFor="repair-photo" className="block text-xs font-semibold text-[#302A23] mb-1">
                Repair Photograph URL
              </label>
              <input
                id="repair-photo"
                type="url"
                required
                placeholder="https://... or sample"
                value={repairPhotoUrl}
                onChange={(e) => setRepairPhotoUrl(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-[#DCD0BD] bg-[#FFFDF8] text-xs"
              />
              {/* Quick sample photo buttons */}
              <div className="flex flex-wrap gap-1.5 mt-1.5 text-[10px]">
                <button
                  type="button"
                  onClick={() =>
                    setRepairPhotoUrl(
                      'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=1200&q=80'
                    )
                  }
                  className="px-2 py-0.5 rounded border border-[#DCD0BD] bg-[#EEE4D2]/40 hover:bg-[#EEE4D2] text-[#302A23]"
                >
                  Load Fresh Asphalt Sample
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setRepairPhotoUrl(
                      'https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?auto=format&fit=crop&w=1200&q=80'
                    )
                  }
                  className="px-2 py-0.5 rounded border border-[#DCD0BD] bg-[#EEE4D2]/40 hover:bg-[#EEE4D2] text-[#302A23]"
                >
                  Load Milled Base Sample
                </button>
              </div>
            </div>

            {/* Materials Used */}
            <div>
              <label htmlFor="materials" className="block text-xs font-semibold text-[#302A23] mb-1">
                Asphalt Materials & Tack Compound
              </label>
              <input
                id="materials"
                type="text"
                value={materialsUsed}
                onChange={(e) => setMaterialsUsed(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-[#DCD0BD] bg-[#FFFDF8] text-xs"
              />
            </div>

            {/* Progress Notes */}
            <div>
              <label htmlFor="rep-notes" className="block text-xs font-semibold text-[#302A23] mb-1">
                Progress Notes
              </label>
              <textarea
                id="rep-notes"
                rows={2}
                placeholder="Compacted with roller, seam sealed with hot rubberized bitumen..."
                value={repairNotes}
                onChange={(e) => setRepairNotes(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-[#DCD0BD] bg-[#FFFDF8] text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={isUploadingEvidence || !repairPhotoUrl}
              className="w-full py-2 rounded-lg bg-[#2F7657] text-white text-xs font-bold hover:bg-[#256147] transition flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isUploadingEvidence ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              <span>Submit Repair Photographic Evidence</span>
            </button>
          </form>

          {/* 3. Official Verification & Case Closure Panel */}
          <form
            onSubmit={handleVerifySignOff}
            className="rounded-xl border border-[#DCD0BD] bg-[#FFFDF8] p-4 shadow-xs space-y-3.5"
          >
            <div className="flex items-center justify-between border-b border-[#DCD0BD] pb-2">
              <div className="flex items-center gap-1.5 font-bold text-sm text-[#2F7657]">
                <ShieldCheck size={16} />
                <span>Quality Assurance & Verification Sign-Off</span>
              </div>
              <span className="text-[11px] text-[#746A5C]">Civil Inspector</span>
            </div>

            {/* Checklist */}
            <div className="space-y-1.5 text-xs text-[#302A23]">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist.surfaceFlatnessConfirmed}
                  onChange={(e) =>
                    setChecklist({ ...checklist, surfaceFlatnessConfirmed: e.target.checked })
                  }
                  className="rounded border-[#DCD0BD] text-[#2F7657] focus:ring-[#2F7657]"
                />
                <span>Surface flush with road crown (no vertical edge ledge)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist.edgeSealingInspected}
                  onChange={(e) =>
                    setChecklist({ ...checklist, edgeSealingInspected: e.target.checked })
                  }
                  className="rounded border-[#DCD0BD] text-[#2F7657] focus:ring-[#2F7657]"
                />
                <span>Perimeter joint sealed with rubberized binder</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist.debrisCleared}
                  onChange={(e) => setChecklist({ ...checklist, debrisCleared: e.target.checked })}
                  className="rounded border-[#DCD0BD] text-[#2F7657] focus:ring-[#2F7657]"
                />
                <span>Loose aggregate & ballast swept clean from roadway</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist.drainageIntegrityVerified}
                  onChange={(e) =>
                    setChecklist({ ...checklist, drainageIntegrityVerified: e.target.checked })
                  }
                  className="rounded border-[#DCD0BD] text-[#2F7657] focus:ring-[#2F7657]"
                />
                <span>Gutter drainage slope preserved (no water ponding)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist.trafficSafetyReopened}
                  onChange={(e) =>
                    setChecklist({ ...checklist, trafficSafetyReopened: e.target.checked })
                  }
                  className="rounded border-[#DCD0BD] text-[#2F7657] focus:ring-[#2F7657]"
                />
                <span>Safety pylons removed & traffic safely reopened</span>
              </label>
            </div>

            {/* Inspector Name & Badge */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label htmlFor="v-name" className="block font-semibold text-[#302A23] mb-1">
                  Inspector Name
                </label>
                <input
                  id="v-name"
                  type="text"
                  value={verifierName}
                  onChange={(e) => setVerifierName(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#DCD0BD] bg-[#FFFDF8]"
                />
              </div>
              <div>
                <label htmlFor="v-badge" className="block font-semibold text-[#302A23] mb-1">
                  Badge / License ID
                </label>
                <input
                  id="v-badge"
                  type="text"
                  value={verifierBadge}
                  onChange={(e) => setVerifierBadge(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#DCD0BD] bg-[#FFFDF8]"
                />
              </div>
            </div>

            {/* Verification Decision */}
            <div>
              <label htmlFor="decision-select" className="block text-xs font-semibold text-[#302A23] mb-1">
                Verification Outcome
              </label>
              <select
                id="decision-select"
                value={verifyDecision}
                onChange={(e) => setVerifyDecision(e.target.value as any)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-[#DCD0BD] bg-[#FFFDF8] text-xs font-bold text-[#2F7657]"
              >
                <option value="approved">Approve Repair & Mark Resolved</option>
                <option value="rework_needed">Rework Needed (Re-assign to contractor)</option>
                <option value="rejected">Reject Repair (Substandard finish)</option>
              </select>
            </div>

            {/* Inspection Sign-off Notes */}
            <div>
              <label htmlFor="v-notes" className="block text-xs font-semibold text-[#302A23] mb-1">
                Inspection Sign-off Notes
              </label>
              <textarea
                id="v-notes"
                rows={2}
                value={verifyNotes}
                onChange={(e) => setVerifyNotes(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-[#DCD0BD] bg-[#FFFDF8] text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmittingVerify}
              className="w-full py-2.5 rounded-lg bg-[#2F7657] text-white text-xs font-bold hover:bg-[#256147] transition flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isSubmittingVerify ? <Loader2 size={13} className="animate-spin" /> : <UserCheck size={13} />}
              <span>Execute Verification Sign-off</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
