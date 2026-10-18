import React, { useState, useMemo } from 'react';
import { RoadCase, Department, DamageSeverity } from '../types';
import { RoadGoogleMap } from './RoadGoogleMap';
import {
  MapPin,
  Filter,
  Search,
  ExternalLink,
  Landmark,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Clock,
  Compass,
  Layers,
  PlusCircle,
  Eye,
  Info,
  Building,
  Navigation,
} from 'lucide-react';

interface RoadMapSectionProps {
  cases: RoadCase[];
  onSelectCase: (caseId: string) => void;
  onNewReportAtLocation?: (lat: number, lng: number) => void;
  onOpenGovtPortal?: (targetCase?: RoadCase) => void;
  mapsApiKey?: string;
}

export const RoadMapSection: React.FC<RoadMapSectionProps> = ({
  cases,
  onSelectCase,
  onNewReportAtLocation,
  onOpenGovtPortal,
  mapsApiKey,
}) => {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(cases[0]?.id || null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [jurisdictionFilter, setJurisdictionFilter] = useState<string>('all');

  // Filter cases
  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchId = c.id.toLowerCase().includes(q);
        const matchRoad = (c.roadName || '').toLowerCase().includes(q);
        const matchDept = (c.assignedDepartment || '').toLowerCase().includes(q);
        const matchTicket = (c.governmentIntegration?.externalReferenceId || '').toLowerCase().includes(q);
        if (!matchId && !matchRoad && !matchDept && !matchTicket) return false;
      }

      if (severityFilter !== 'all' && c.overallSeverity !== severityFilter) {
        return false;
      }

      if (statusFilter !== 'all' && c.status !== statusFilter) {
        return false;
      }

      if (jurisdictionFilter !== 'all') {
        const j = c.governmentIntegration?.roadJurisdiction || 'municipal_urban';
        if (j !== jurisdictionFilter) return false;
      }

      return true;
    });
  }, [cases, searchQuery, severityFilter, statusFilter, jurisdictionFilter]);

  const activeCase = useMemo(() => {
    return cases.find((c) => c.id === selectedCaseId) || filteredCases[0] || cases[0];
  }, [cases, selectedCaseId, filteredCases]);

  // Statistics
  const totalPins = cases.length;
  const criticalPins = cases.filter((c) => c.overallSeverity === 'critical').length;
  const inProgressPins = cases.filter((c) => c.status === 'Repair In Progress' || c.status === 'Assigned').length;
  const resolvedPins = cases.filter((c) => c.status === 'Resolved').length;

  return (
    <div className="space-y-4">
      {/* Header with Title & Quick Stats */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#DCD0BD] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#79583A] text-white shadow-xs">
              <MapPin size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-[#302A23] tracking-tight">
                Google Road Map & Infrastructure GIS
              </h1>
              <p className="text-xs text-[#746A5C] mt-0.5">
                Live interactive roadway inspection map with real-time GPS coordinates, defect measurements, and Government Grievance synchronization.
              </p>
            </div>
          </div>
        </div>

        {/* Stats Summary Pills */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <div className="px-3 py-1.5 rounded-xl border border-[#DCD0BD] bg-[#FFFDF8] flex items-center gap-1.5 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-[#79583A]" />
            <span className="text-[#746A5C]">Total Hazards:</span>
            <strong className="text-[#302A23]">{totalPins}</strong>
          </div>
          <div className="px-3 py-1.5 rounded-xl border border-[#B44343]/30 bg-[#B44343]/10 text-[#B44343] flex items-center gap-1.5 shadow-2xs">
            <Flame size={12} />
            <span>Critical:</span>
            <strong>{criticalPins}</strong>
          </div>
          <div className="px-3 py-1.5 rounded-xl border border-[#9A6B25]/30 bg-[#9A6B25]/10 text-[#9A6B25] flex items-center gap-1.5 shadow-2xs">
            <Clock size={12} />
            <span>In Repair:</span>
            <strong>{inProgressPins}</strong>
          </div>
          <div className="px-3 py-1.5 rounded-xl border border-[#2F7657]/30 bg-[#2F7657]/10 text-[#2F7657] flex items-center gap-1.5 shadow-2xs">
            <CheckCircle2 size={12} />
            <span>Resolved:</span>
            <strong>{resolvedPins}</strong>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3.5 rounded-2xl bg-[#FFFDF8] border border-[#DCD0BD] shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#746A5C]" />
          <input
            type="text"
            placeholder="Search road name, ticket ID, or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-[#DCD0BD] bg-[#FFFDF8] text-xs text-[#302A23] focus:outline-[#79583A]"
          />
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Jurisdiction */}
          <select
            value={jurisdictionFilter}
            onChange={(e) => setJurisdictionFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-[#DCD0BD] bg-[#FFFDF8] text-xs text-[#302A23] font-medium"
          >
            <option value="all">All Jurisdictions</option>
            <option value="national_highway">National Highways (NHAI)</option>
            <option value="state_highway">State Highways (PWD)</option>
            <option value="municipal_urban">Municipal / Urban Streets</option>
          </select>

          {/* Severity */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-[#DCD0BD] bg-[#FFFDF8] text-xs text-[#302A23] font-medium"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-[#DCD0BD] bg-[#FFFDF8] text-xs text-[#302A23] font-medium"
          >
            <option value="all">All Statuses</option>
            <option value="Submitted">Submitted</option>
            <option value="Assigned">Assigned</option>
            <option value="Repair In Progress">In Progress</option>
            <option value="Awaiting Verification">Awaiting Verification</option>
            <option value="Resolved">Resolved</option>
          </select>
        </div>
      </div>

      {/* Main Map Viewer & Side Inspector Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Full Interactive Road Map (8 Cols) */}
        <div className="lg:col-span-8 space-y-3">
          <div className="relative rounded-2xl border border-[#DCD0BD] overflow-hidden bg-[#FFFDF8] shadow-sm">
            <RoadGoogleMap
              apiKey={mapsApiKey}
              cases={filteredCases.length > 0 ? filteredCases : cases}
              selectedCaseId={activeCase?.id}
              onSelectCase={(id) => setSelectedCaseId(id)}
              height="540px"
              defaultZoom={14}
            />
          </div>

          {/* Quick Helper below Map */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#FFFDF8] border border-[#DCD0BD] text-xs text-[#746A5C]">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#B44343]" />
                <span>Critical Risk</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#9A6B25]" />
                <span>High / Medium Risk</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#2F7657]" />
                <span>Resolved & Repaired</span>
              </span>
            </div>

            <div className="text-[11px] font-semibold text-[#79583A]">
              Click any pin on the map to inspect full damage specifications
            </div>
          </div>
        </div>

        {/* Right Column: Selected Defect Inspector Card (4 Cols) */}
        <div className="lg:col-span-4 space-y-3">
          {activeCase ? (
            <div className="rounded-2xl border border-[#DCD0BD] bg-[#FFFDF8] p-4.5 space-y-4 shadow-sm">
              {/* Card Top: Case ID & Severity Badge */}
              <div className="flex items-start justify-between gap-2 border-b border-[#DCD0BD]/60 pb-3">
                <div>
                  <span className="text-[11px] font-mono font-bold text-[#746A5C]">
                    {activeCase.id}
                  </span>
                  <h3 className="font-bold text-base text-[#302A23] leading-snug mt-0.5">
                    {activeCase.roadName}
                  </h3>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase ${
                    activeCase.overallSeverity === 'critical'
                      ? 'bg-[#B44343]/15 text-[#B44343] border border-[#B44343]/30'
                      : activeCase.overallSeverity === 'high'
                      ? 'bg-[#9A6B25]/15 text-[#9A6B25] border border-[#9A6B25]/30'
                      : 'bg-[#79583A]/15 text-[#79583A] border border-[#79583A]/30'
                  }`}
                >
                  {activeCase.overallSeverity}
                </span>
              </div>

              {/* Photo Thumbnail */}
              {activeCase.originalImageUrl && (
                <div className="relative rounded-xl overflow-hidden border border-[#DCD0BD] aspect-video bg-[#EEE4D2]">
                  <img
                    src={activeCase.originalImageUrl}
                    alt={activeCase.roadName}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 backdrop-blur-xs text-[10px] text-white font-mono">
                    {activeCase.location.latitude.toFixed(5)}, {activeCase.location.longitude.toFixed(5)}
                  </div>
                </div>
              )}

              {/* Measurements Matrix */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-xl bg-[#EEE4D2]/40 border border-[#DCD0BD]">
                  <span className="text-[10px] text-[#746A5C] uppercase font-bold block">Surface Area</span>
                  <strong className="text-sm text-[#302A23]">
                    {activeCase.damageRegions[0]?.measurements.areaCm2
                      ? `${activeCase.damageRegions[0].measurements.areaCm2.toLocaleString()} cm²`
                      : activeCase.damageRegions[0]?.measurements.areaM2
                      ? `${activeCase.damageRegions[0].measurements.areaM2} m²`
                      : 'Measured'}
                  </strong>
                </div>

                <div className="p-2 rounded-xl bg-[#EEE4D2]/40 border border-[#DCD0BD]">
                  <span className="text-[10px] text-[#746A5C] uppercase font-bold block">Est. Depth</span>
                  <strong className="text-sm text-[#302A23]">
                    {activeCase.damageRegions[0]?.measurements.depthEstimatedCm
                      ? `${activeCase.damageRegions[0].measurements.depthEstimatedCm.toFixed(1)} cm`
                      : 'Pending field survey'}
                  </strong>
                </div>

                <div className="p-2 rounded-xl bg-[#EEE4D2]/40 border border-[#DCD0BD]">
                  <span className="text-[10px] text-[#746A5C] uppercase font-bold block">Cold-Mix Asphalt</span>
                  <strong className="text-sm text-[#2F7657]">
                    {activeCase.damageRegions[0]?.measurements.volumeM3
                      ? `${Math.round(activeCase.damageRegions[0].measurements.volumeM3 * 2400)} kg`
                      : activeCase.damageRegions[0]?.measurements.volumeCm3
                      ? `${Math.round((activeCase.damageRegions[0].measurements.volumeCm3 / 1e6) * 2400)} kg`
                      : '~45 kg'}
                  </strong>
                </div>

                <div className="p-2 rounded-xl bg-[#EEE4D2]/40 border border-[#DCD0BD]">
                  <span className="text-[10px] text-[#746A5C] uppercase font-bold block">Priority Score</span>
                  <strong className="text-sm text-[#79583A]">
                    {activeCase.priorityScore || 85} / 100
                  </strong>
                </div>
              </div>

              {/* Government Portal Sync Status */}
              <div className="p-3 rounded-xl border border-[#2F7657]/30 bg-[#2F7657]/10 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-[#2F7657]">
                    <Landmark size={14} />
                    <span>Free Government Grievance Sync</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#2F7657] text-white">
                    {activeCase.governmentIntegration?.externalReferenceId ? 'Synced' : 'Ready to Dispatch'}
                  </span>
                </div>

                {activeCase.governmentIntegration?.externalReferenceId ? (
                  <div className="text-[11px] text-[#302A23] space-y-1">
                    <div>
                      Docket ID: <span className="font-mono font-bold text-[#2F7657]">{activeCase.governmentIntegration.externalReferenceId}</span>
                    </div>
                    <div>
                      Authority: <span className="font-semibold">{activeCase.governmentIntegration.portalName}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-[#4B4136]">
                    Dispatch this road defect to CPGRAMS / NHAI portal under 72h Citizen Charter resolution SLA.
                  </p>
                )}

                {onOpenGovtPortal && (
                  <button
                    type="button"
                    onClick={() => onOpenGovtPortal(activeCase)}
                    className="w-full py-2 rounded-lg bg-[#2F7657] text-white font-bold text-xs hover:bg-[#255f46] transition flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <Landmark size={13} />
                    <span>{activeCase.governmentIntegration?.externalReferenceId ? 'View Government Docket & SLA' : 'Dispatch Grievance to Govt (Free)'}</span>
                  </button>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <a
                  href={`https://www.google.com/maps?q=${activeCase.location.latitude},${activeCase.location.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 rounded-xl border border-[#DCD0BD] bg-[#EEE4D2]/40 hover:bg-[#EEE4D2] text-[#302A23] font-bold text-xs transition flex items-center justify-center gap-1.5"
                >
                  <Navigation size={13} className="text-[#79583A]" />
                  <span>Open Coordinates in Google Maps App</span>
                  <ExternalLink size={12} className="text-[#746A5C]" />
                </a>

                <button
                  type="button"
                  onClick={() => onSelectCase(activeCase.id)}
                  className="w-full py-2 rounded-xl bg-[#79583A] hover:bg-[#61442B] text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <Eye size={13} />
                  <span>Open Full Civil Damage Case Record</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#DCD0BD] bg-[#FFFDF8] p-8 text-center space-y-3">
              <MapPin size={24} className="text-[#746A5C] mx-auto" />
              <h4 className="font-bold text-sm text-[#302A23]">Select a Road Defect</h4>
              <p className="text-xs text-[#746A5C]">
                Click any marker on the map to review the civil measurements and dispatch repair tickets.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
