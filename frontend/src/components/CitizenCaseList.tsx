import React, { useState } from 'react';
import { RoadCase, CaseStatus } from '../types';
import { BeforeAfterSlider } from './BeforeAfterSlider';
import { RoadGoogleMap } from './RoadGoogleMap';
import { DamageCanvas } from './DamageCanvas';
import {
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Filter,
  Search,
  ArrowLeft,
  Calendar,
  Building,
  Ruler,
  FileCheck,
  Landmark,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface CitizenCaseListProps {
  cases: RoadCase[];
  selectedCaseId?: string | null;
  onSelectCase: (caseId: string | null) => void;
  onNewReport: () => void;
  onOpenGovtPortal?: (targetCase?: RoadCase) => void;
  mapsApiKey?: string;
}

export const CitizenCaseList: React.FC<CitizenCaseListProps> = ({
  cases,
  selectedCaseId,
  onSelectCase,
  onNewReport,
  onOpenGovtPortal,
  mapsApiKey,
}) => {
  const { currentUser } = useAuth();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [ownershipFilter, setOwnershipFilter] = useState<'all' | 'mine'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeRegionId, setActiveRegionId] = useState<string | undefined>(undefined);

  const selectedCase = cases.find((c) => c.id === selectedCaseId);

  // Status badge styling
  const getStatusBadge = (status: CaseStatus) => {
    switch (status) {
      case 'Resolved':
        return 'bg-[#2F7657]/15 text-[#2F7657] border-[#2F7657]/30';
      case 'Awaiting Verification':
        return 'bg-[#79583A]/15 text-[#79583A] border-[#79583A]/30';
      case 'Repair In Progress':
        return 'bg-[#9A6B25]/15 text-[#9A6B25] border-[#9A6B25]/30';
      case 'Assigned':
      case 'Accepted':
        return 'bg-[#4B4136]/15 text-[#4B4136] border-[#4B4136]/30';
      case 'Rejected':
        return 'bg-[#B44343]/15 text-[#B44343] border-[#B44343]/30';
      default:
        return 'bg-[#746A5C]/15 text-[#746A5C] border-[#746A5C]/30';
    }
  };

  const filteredCases = cases.filter((c) => {
    if (ownershipFilter === 'mine' && currentUser) {
      const matchEmail = currentUser.email && c.citizenEmail && c.citizenEmail.toLowerCase() === currentUser.email.toLowerCase();
      const matchName = currentUser.name && c.citizenName && c.citizenName.toLowerCase() === currentUser.name.toLowerCase();
      if (!matchEmail && !matchName) return false;
    }

    const matchesStatus =
      filterStatus === 'all'
        ? true
        : filterStatus === 'active'
        ? c.status !== 'Resolved' && c.status !== 'Rejected'
        : filterStatus === 'resolved'
        ? c.status === 'Resolved'
        : c.status.toLowerCase() === filterStatus.toLowerCase();

    const matchesSearch =
      c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.roadName && c.roadName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.assignedDepartment && c.assignedDepartment.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesStatus && matchesSearch;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* If a case is selected, render full citizen case detail */}
      {selectedCase ? (
        <div className="space-y-6">
          {/* Back Navigation Bar */}
          <div className="flex items-center justify-between border-b border-[#DCD0BD] pb-4">
            <button
              onClick={() => onSelectCase(null)}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#79583A] hover:underline"
            >
              <ArrowLeft size={14} />
              <span>Back to All Road Complaints</span>
            </button>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusBadge(selectedCase.status)}`}>
                {selectedCase.status}
              </span>
            </div>
          </div>

          {/* Case Hero Overview */}
          <div className="rounded-2xl border border-[#DCD0BD] bg-[#FFFDF8] p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div>
                <span className="text-[11px] font-mono font-bold text-[#746A5C]">
                  CASE REF: {selectedCase.id}
                </span>
                <h2 className="text-xl font-bold text-[#302A23] mt-0.5">{selectedCase.roadName}</h2>
                <div className="flex flex-wrap items-center gap-3 text-xs text-[#746A5C] mt-2">
                  <span className="flex items-center gap-1">
                    <MapPin size={13} className="text-[#79583A]" />
                    {selectedCase.location.latitude.toFixed(5)}, {selectedCase.location.longitude.toFixed(5)}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Building size={13} className="text-[#79583A]" />
                    {selectedCase.assignedDepartment || 'Pending Assignment'}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar size={13} className="text-[#79583A]" />
                    Submitted: {new Date(selectedCase.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                {selectedCase.overallSeverity && (
                  <span
                    className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold uppercase ${
                      selectedCase.overallSeverity === 'critical'
                        ? 'bg-[#B44343]/15 text-[#B44343]'
                        : selectedCase.overallSeverity === 'high'
                        ? 'bg-[#9A6B25]/15 text-[#9A6B25]'
                        : 'bg-[#79583A]/15 text-[#79583A]'
                    }`}
                  >
                    {selectedCase.overallSeverity} Severity
                  </span>
                )}
                {onOpenGovtPortal && (
                  <button
                    type="button"
                    onClick={() => onOpenGovtPortal(selectedCase)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#2F7657]/40 bg-[#2F7657]/10 text-[#2F7657] hover:bg-[#2F7657]/20 transition text-xs font-bold shadow-2xs cursor-pointer"
                    title="Open official Government Grievance Redressal Portal dossier and 72h SLA tracker"
                  >
                    <Landmark size={13} />
                    <span>
                      {selectedCase.governmentIntegration?.externalReferenceId
                        ? `Govt: ${selectedCase.governmentIntegration.externalReferenceId}`
                        : 'Govt Grievance Sync (Free)'}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {selectedCase.citizenDescription && (
              <div className="p-3 rounded-lg bg-[#EEE4D2]/40 border border-[#DCD0BD] text-xs text-[#4B4136]">
                <strong className="text-[#302A23]">Citizen Notes:</strong> {selectedCase.citizenDescription}
              </div>
            )}

            {/* Google Map of Road Complaint Location */}
            <div className="pt-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[#302A23] mb-1.5">
                <span className="flex items-center gap-1.5">
                  <MapPin size={13} className="text-[#79583A]" />
                  <span>Google Maps Geolocation</span>
                </span>
                <span className="text-[11px] text-[#746A5C]">
                  {selectedCase.location.latitude.toFixed(6)}, {selectedCase.location.longitude.toFixed(6)}
                </span>
              </div>
              <RoadGoogleMap
                apiKey={mapsApiKey}
                singlePin={{
                  location: selectedCase.location,
                  roadName: selectedCase.roadName,
                }}
                height="220px"
                defaultZoom={15}
              />
            </div>
          </div>

          {/* Before & After Comparison Section if Repair Evidence Exists */}
          {selectedCase.repairEvidences && selectedCase.repairEvidences.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-bold text-base text-[#302A23]">Repair Evidence & Visual Verification</h3>
              {(() => {
                const finalEvidence =
                  selectedCase.repairEvidences.find((e) => e.stage === 'completed') ||
                  selectedCase.repairEvidences[selectedCase.repairEvidences.length - 1];

                const firstRegion = selectedCase.damageRegions[0];

                return (
                  <BeforeAfterSlider
                    beforeImageUrl={selectedCase.originalImageUrl}
                    afterImageUrl={finalEvidence.imageUrl}
                    beforeLabel="Original Road Damage"
                    afterLabel="Completed Road Patch"
                    beforeDetails={{
                      date: selectedCase.createdAt,
                      damageType: firstRegion?.typeLabel || 'Pothole Defect',
                      severity: selectedCase.overallSeverity,
                      area: firstRegion?.measurements.areaM2
                        ? `${firstRegion.measurements.areaM2} m²`
                        : `${firstRegion?.measurements.areaPx2} px²`,
                    }}
                    afterDetails={{
                      date: finalEvidence.timestamp,
                      contractor: finalEvidence.contractorName,
                      materials: finalEvidence.materialsUsed,
                      verifiedBy: selectedCase.verification?.verifierName,
                    }}
                  />
                );
              })()}
            </div>
          )}

          {/* Verification Sign-Off Card if Resolved */}
          {selectedCase.verification && (
            <div className="rounded-xl border border-[#2F7657]/40 bg-[#2F7657]/10 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-[#2F7657]" />
                  <h4 className="font-bold text-sm text-[#2F7657]">Official Repair Verification Audit</h4>
                </div>
                <span className="text-xs text-[#2F7657] font-semibold">
                  Sign-off: {new Date(selectedCase.verification.verifiedAt).toLocaleDateString()}
                </span>
              </div>

              <p className="text-xs text-[#302A23] leading-relaxed">
                {selectedCase.verification.notes}
              </p>

              {/* Verified Criteria Pills */}
              <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
                {selectedCase.verification.checklist.surfaceFlatnessConfirmed && (
                  <span className="px-2 py-0.5 rounded bg-white/70 border border-[#2F7657]/30 text-[#2F7657] font-medium">
                    ✓ Surface Flatness Confirmed
                  </span>
                )}
                {selectedCase.verification.checklist.edgeSealingInspected && (
                  <span className="px-2 py-0.5 rounded bg-white/70 border border-[#2F7657]/30 text-[#2F7657] font-medium">
                    ✓ Edge Seam Rubberized & Sealed
                  </span>
                )}
                {selectedCase.verification.checklist.trafficSafetyReopened && (
                  <span className="px-2 py-0.5 rounded bg-white/70 border border-[#2F7657]/30 text-[#2F7657] font-medium">
                    ✓ Traffic Safely Reopened
                  </span>
                )}
                <span className="px-2 py-0.5 rounded bg-white/70 border border-[#2F7657]/30 text-[#2F7657] font-medium">
                  Inspector: {selectedCase.verification.verifierName} ({selectedCase.verification.verifierBadge})
                </span>
              </div>
            </div>
          )}

          {/* Two-Column Details: Original Evidence & Full Audit Trail */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Original Photo & Interactive Damage Canvas (6 cols) */}
            <div className="lg:col-span-6 space-y-3">
              <DamageCanvas
                imageUrl={selectedCase.originalImageUrl}
                imageDimensions={selectedCase.imageDimensions}
                regions={selectedCase.damageRegions}
                activeRegionId={activeRegionId || selectedCase.damageRegions[0]?.id}
                calibration={selectedCase.calibration}
                readOnly={true}
                onSelectRegion={(id) => setActiveRegionId(id)}
              />

              <div className="rounded-xl border border-[#DCD0BD] bg-[#FFFDF8] p-4 space-y-3">

              {/* Detected Regions List */}
              <div className="space-y-2 pt-1">
                <div className="text-xs font-semibold text-[#746A5C]">
                  Mathematical Measurements ({selectedCase.damageRegions.length} region{selectedCase.damageRegions.length === 1 ? '' : 's'}):
                </div>
                {selectedCase.damageRegions.map((r, idx) => (
                  <div key={r.id} className="p-2.5 rounded-lg bg-[#EEE4D2]/40 border border-[#DCD0BD] text-xs space-y-1">
                    <div className="flex items-center justify-between font-semibold text-[#302A23]">
                      <span>Region #{idx + 1}: {r.typeLabel}</span>
                      <span className="text-[11px] text-[#79583A]">{Math.round(r.confidence * 100)}% confidence</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-[#746A5C] pt-1">
                      <div>
                        Length: <strong className="text-[#302A23]">{r.measurements.lengthCm ? `${r.measurements.lengthCm.toFixed(1)} cm` : `${r.measurements.lengthPx} px`}</strong>
                      </div>
                      <div>
                        Width: <strong className="text-[#302A23]">{r.measurements.widthCm ? `${r.measurements.widthCm.toFixed(1)} cm` : `${r.measurements.widthPx} px`}</strong>
                      </div>
                      <div>
                        Area: <strong className="text-[#302A23]">{r.measurements.areaCm2 ? `${r.measurements.areaCm2.toLocaleString()} cm²` : `${r.measurements.areaPx2} px²`}</strong>
                      </div>
                      <div>
                        Depth: <strong className="text-[#302A23]">{r.measurements.depthEstimatedCm ? `${r.measurements.depthEstimatedCm.toFixed(1)} cm` : (r.measurements.depthEstimatedM ? `${(r.measurements.depthEstimatedM * 100).toFixed(1)} cm` : 'Pending inspection')}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

            {/* Right: Chronological Status Audit Trail (6 cols) */}
            <div className="lg:col-span-6 rounded-xl border border-[#DCD0BD] bg-[#FFFDF8] p-4 space-y-3">
              <h4 className="font-bold text-sm text-[#302A23]">Repair Lifecycle & Audit Trail</h4>
              <div className="space-y-3 divide-y divide-[#DCD0BD]/60">
                {selectedCase.auditTrail?.map((log, idx) => (
                  <div key={log.id || idx} className={idx > 0 ? 'pt-3' : ''}>
                    <div className="flex items-start justify-between gap-2 text-xs">
                      <div className="font-semibold text-[#302A23] flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#79583A]" />
                        <span>{log.action}</span>
                      </div>
                      <span className="text-[10px] text-[#746A5C]">
                        {new Date(log.timestamp).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#746A5C] mt-1 pl-3.5">
                      By: <strong className="text-[#302A23]">{log.actorName}</strong> ({log.actorRole})
                    </div>
                    {log.notes && (
                      <p className="text-[11px] text-[#4B4136] mt-1 pl-3.5 italic">
                        "{log.notes}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Case List Overview */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#DCD0BD] pb-4">
            <div>
              <h1 className="text-2xl font-bold text-[#302A23] tracking-tight">Citizen Road Complaints</h1>
              <p className="text-xs text-[#746A5C] mt-1">
                Track status updates, assigned public works crews, and before/after repair evidence for reported roadways.
              </p>
            </div>
            <button
              onClick={onNewReport}
              className="px-4 py-2 rounded-xl bg-[#79583A] hover:bg-[#61442B] text-white font-semibold text-xs transition shadow-xs self-start"
            >
              + Report New Defect
            </button>
          </div>

          {/* Search and Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[#FFFDF8] border border-[#DCD0BD]">
            {/* Search */}
            <div className="relative flex-1 min-w-[220px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#746A5C]" />
              <input
                type="text"
                placeholder="Search by case ID, street, or department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-[#DCD0BD] bg-[#FFFDF8] text-xs text-[#302A23] focus:outline-[#79583A]"
              />
            </div>

            {/* Ownership Toggle (All vs My Reports) */}
            <div className="flex items-center p-0.5 rounded-lg bg-[#EEE4D2]/60 border border-[#DCD0BD] text-xs font-semibold">
              <button
                type="button"
                onClick={() => setOwnershipFilter('all')}
                className={`px-2.5 py-1 rounded-md transition ${
                  ownershipFilter === 'all'
                    ? 'bg-white text-[#302A23] shadow-xs'
                    : 'text-[#746A5C] hover:text-[#302A23]'
                }`}
              >
                All Reports ({cases.length})
              </button>
              <button
                type="button"
                onClick={() => setOwnershipFilter('mine')}
                className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 ${
                  ownershipFilter === 'mine'
                    ? 'bg-[#79583A] text-white shadow-xs'
                    : 'text-[#746A5C] hover:text-[#302A23]'
                }`}
              >
                <User size={11} />
                <span>My Reports</span>
              </button>
            </div>

            {/* Filter Status */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[#746A5C]">Status:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-[#DCD0BD] bg-[#FFFDF8] text-xs text-[#302A23] font-medium"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="resolved">Resolved / Verified</option>
                <option value="Submitted">Submitted</option>
                <option value="Assigned">Assigned</option>
                <option value="Repair In Progress">Repair In Progress</option>
                <option value="Awaiting Verification">Awaiting Verification</option>
              </select>
            </div>
          </div>

          {/* Cases List */}
          {filteredCases.length === 0 ? (
            <div className="rounded-2xl border border-[#DCD0BD] bg-[#FFFDF8] p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#EEE4D2] text-[#746A5C] mx-auto flex items-center justify-center">
                <FileCheck size={24} />
              </div>
              <h3 className="font-bold text-base text-[#302A23]">No road complaints found</h3>
              <p className="text-xs text-[#746A5C] max-w-sm mx-auto">
                No cases match the selected filter criteria. Upload a road photograph to create the first complaint.
              </p>
              <button
                onClick={onNewReport}
                className="px-4 py-2 rounded-xl bg-[#79583A] text-white text-xs font-semibold hover:bg-[#61442B] transition"
              >
                Report Road Damage
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCases.map((c) => {
                const firstDmg = c.damageRegions[0];
                const hasRepair = c.repairEvidences && c.repairEvidences.length > 0;

                return (
                  <div
                    key={c.id}
                    onClick={() => onSelectCase(c.id)}
                    className="group rounded-xl border border-[#DCD0BD] bg-[#FFFDF8] p-4 hover:border-[#79583A] hover:shadow-md transition cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[11px] font-mono font-bold text-[#746A5C]">
                          {c.id}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${getStatusBadge(c.status)}`}>
                          {c.status}
                        </span>
                      </div>

                      <h3 className="font-bold text-sm text-[#302A23] mt-1 group-hover:text-[#79583A] transition">
                        {c.roadName}
                      </h3>

                      {/* Image Thumbnail & Metrics */}
                      <div className="flex items-center gap-3 mt-3">
                        <div className="w-20 h-20 rounded-lg overflow-hidden bg-neutral-900 border border-[#DCD0BD] shrink-0">
                          <img
                            src={c.originalImageUrl}
                            alt={c.roadName}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        <div className="flex-1 text-xs text-[#746A5C] space-y-1">
                          <div className="text-[#302A23] font-semibold truncate">
                            {firstDmg ? firstDmg.typeLabel : 'Surface Defect'}
                          </div>
                          <div>
                            Dimensions:{' '}
                            <strong className="text-[#302A23]">
                              {firstDmg?.measurements.lengthCm
                                ? `${firstDmg.measurements.lengthCm.toFixed(1)} cm × ${firstDmg.measurements.widthCm.toFixed(1)} cm`
                                : `${firstDmg?.measurements.lengthPx || 0}px × ${firstDmg?.measurements.widthPx || 0}px`}
                            </strong>
                          </div>
                          <div className="truncate">
                            Dept: <span className="text-[#302A23]">{c.assignedDepartment || 'Pending Assignment'}</span>
                          </div>
                          {hasRepair && (
                            <div className="text-[#2F7657] font-semibold flex items-center gap-1 text-[11px]">
                              <CheckCircle2 size={12} /> Before/After photos available
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-[#DCD0BD]/60 flex items-center justify-between text-[11px] text-[#746A5C]">
                      <span>Submitted: {new Date(c.createdAt).toLocaleDateString()}</span>
                      <span className="flex items-center gap-0.5 text-[#79583A] font-semibold group-hover:underline">
                        <span>View Progress</span>
                        <ChevronRight size={13} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
