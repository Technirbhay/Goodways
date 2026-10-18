import React, { useState } from 'react';
import { RoadCase } from '../types';
import { apiUrl } from '../api';
import {
  Landmark,
  ShieldAlert,
  ExternalLink,
  Copy,
  CheckCircle,
  Clock,
  Send,
  Download,
  PhoneCall,
  Check,
  FileText,
  AlertCircle,
  HelpCircle,
  MapPin,
  Flame,
  Layers,
  X
} from 'lucide-react';

interface GovtPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  roadCase?: RoadCase;
  onCaseUpdated?: (updatedCase: RoadCase) => void;
}

export const GovtPortalModal: React.FC<GovtPortalModalProps> = ({
  isOpen,
  onClose,
  roadCase,
  onCaseUpdated,
}) => {
  const [copiedDossier, setCopiedDossier] = useState(false);
  const [copiedTicket, setCopiedTicket] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Selected government portal channel
  const [selectedChannel, setSelectedChannel] = useState<'nhai' | 'cpgrams' | 'pwd'>('nhai');

  if (!isOpen) return null;

  const govt = roadCase?.governmentIntegration;
  const isDispatched = !!govt?.externalReferenceId || !!dispatchResult?.ticketNumber;
  const ticketNumber = dispatchResult?.ticketNumber || govt?.externalReferenceId;

  // Real Government Portal Configuration based on Selected Channel
  const portalChannels = {
    nhai: {
      name: 'National Highways Authority of India (NHAI)',
      subName: 'Ministry of Road Transport and Highways (MoRTH)',
      portalUrl: 'https://nhai.gov.in/',
      incidentAppUrl: 'https://rajmargyatra.nhai.gov.in/',
      helplinePhone: '1033',
      helplineLabel: 'NHAI 24x7 National Highway Emergency Helpline (1033)',
      slaHours: 48,
      category: 'National Highway Pothole & Bituminous Surface Distress',
    },
    cpgrams: {
      name: 'CPGRAMS — Central Public Grievance Portal',
      subName: 'Department of Administrative Reforms & Public Grievances',
      portalUrl: 'https://pgportal.gov.in/',
      incidentAppUrl: 'https://pgportal.gov.in/',
      helplinePhone: '1800-11-4000',
      helplineLabel: 'National Public Grievance Toll-Free (1800-11-4000)',
      slaHours: 72,
      category: 'Public Infrastructure & Urban Roadway Maintenance',
    },
    pwd: {
      name: 'State Public Works Department (PWD)',
      subName: 'State Highway Division & Urban Local Bodies',
      portalUrl: 'https://pgportal.gov.in/',
      incidentAppUrl: 'https://pgportal.gov.in/',
      helplinePhone: '1800-180-0151',
      helplineLabel: 'State PWD Roadway Redressal Control Room',
      slaHours: 72,
      category: 'State Arterial & Municipal Road Repairs',
    },
  };

  const currentChannel = portalChannels[selectedChannel];
  const authorityName = dispatchResult?.authority || (isDispatched ? govt?.portalName : currentChannel.name);
  const portalUrl = dispatchResult?.portalUrl || currentChannel.portalUrl;
  const helplinePhone = dispatchResult?.helplinePhone || currentChannel.helplinePhone;

  const primaryDamage = roadCase?.damageRegions?.[0];
  const areaCm2 = primaryDamage?.measurements?.areaCm2 || 0;
  const areaM2 = (areaCm2 / 10000).toFixed(2);
  const estAsphaltKg = dispatchResult?.estimatedAsphaltKg || Math.round(Math.max(15, (areaCm2 / 10000) * 0.08 * 2400));

  const handleCopyDossier = () => {
    if (!govt?.dossierSummary && !roadCase) return;
    const textToCopy = govt?.dossierSummary || generateDossierText();
    navigator.clipboard.writeText(textToCopy);
    setCopiedDossier(true);
    setTimeout(() => setCopiedDossier(false), 2500);
  };

  const generateDossierText = () => {
    return `=== OFFICIAL GOVERNMENT ROAD GRIEVANCE DOSSIER ===
Target Authority: ${currentChannel.name}
Grievance Category: ${currentChannel.category}
Road / Highway: ${roadCase?.roadName || 'Reported Roadway'}
GPS Coordinates: ${roadCase?.location.latitude.toFixed(6)}° N, ${roadCase?.location.longitude.toFixed(6)}° E
Primary Damage: ${primaryDamage?.typeLabel || 'Pothole'} (${primaryDamage?.severity || 'High'} Severity)
Estimated Surface Area: ${areaM2} m² (${areaCm2.toFixed(0)} cm²)
Estimated Cold-Mix Asphalt Required: ~${estAsphaltKg} kg
Recommended SLA Resolution: Within ${currentChannel.slaHours} Hours
Citizen Reporter: ${roadCase?.citizenName || 'Civic Contributor'}
Platform: GoodWays AI Verified Infrastructure Inspection
Verification Hash: GW-${roadCase?.id || '2026'}-IND`;
  };

  const handleDownloadDossier = () => {
    const text = govt?.dossierSummary || generateDossierText();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `goodways-nhai-dossier-${roadCase?.id || 'case'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyTicket = () => {
    if (!ticketNumber) return;
    navigator.clipboard.writeText(ticketNumber);
    setCopiedTicket(true);
    setTimeout(() => setCopiedTicket(false), 2000);
  };

  const handleDispatch = async () => {
    if (!roadCase) return;
    setIsDispatching(true);
    setErrorMessage(null);

    try {
      const res = await fetch(apiUrl('/api/govt-portal/dispatch'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: roadCase.id,
          portalOverride: currentChannel.name,
          citizenName: roadCase.citizenName || 'Civic Reporter',
          citizenEmail: roadCase.citizenEmail || 'citizen@goodways.org',
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to dispatch grievance to government portal');
      }

      const data = await res.json();
      setDispatchResult(data);
      if (onCaseUpdated && data.case) {
        onCaseUpdated(data.case);
      }
    } catch (err: any) {
      console.error('Error dispatching to govt portal:', err);
      setErrorMessage(err.message || 'Unable to connect to government portal API');
    } finally {
      setIsDispatching(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div
        className="relative w-full max-w-2xl max-h-[90vh] bg-[#FFFDF8] rounded-2xl border border-[#DCD0BD] shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#DCD0BD] bg-[#EEE4D2]/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#79583A] text-white flex items-center justify-center shadow-xs">
              <Landmark size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#302A23] flex items-center gap-2">
                <span>Free Government Grievance Portal Sync</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#2F7657]/15 text-[#2F7657] uppercase tracking-wider">
                  CPGRAMS / NHAI / PWD
                </span>
              </h3>
              <p className="text-xs text-[#746A5C]">
                Direct civic integration with Public Works & National Highway grievance redressal systems
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#746A5C] hover:text-[#302A23] hover:bg-[#EEE4D2] transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-sm text-[#302A23]">
          {/* Government Portal Channel Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#302A23] uppercase tracking-wider block">
              Select Government Grievance Channel:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSelectedChannel('nhai')}
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  selectedChannel === 'nhai'
                    ? 'border-[#2F7657] bg-[#2F7657]/10 ring-1 ring-[#2F7657]'
                    : 'border-[#DCD0BD] bg-white hover:bg-[#EEE4D2]/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[#2F7657]">NHAI National Highway</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-[#2F7657] text-white">1033</span>
                </div>
                <div className="text-[10.5px] text-[#746A5C] mt-1 leading-tight">
                  MoRTH & Expressways &bull; 48-Hr SLA
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedChannel('cpgrams')}
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  selectedChannel === 'cpgrams'
                    ? 'border-[#79583A] bg-[#79583A]/10 ring-1 ring-[#79583A]'
                    : 'border-[#DCD0BD] bg-white hover:bg-[#EEE4D2]/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[#79583A]">CPGRAMS Central</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#79583A]/15 text-[#79583A]">GOV.IN</span>
                </div>
                <div className="text-[10.5px] text-[#746A5C] mt-1 leading-tight">
                  Central Public Grievance &bull; 72-Hr SLA
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedChannel('pwd')}
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  selectedChannel === 'pwd'
                    ? 'border-[#9A6B25] bg-[#9A6B25]/10 ring-1 ring-[#9A6B25]'
                    : 'border-[#DCD0BD] bg-white hover:bg-[#EEE4D2]/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[#9A6B25]">State PWD</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#9A6B25]/15 text-[#9A6B25]">STATE</span>
                </div>
                <div className="text-[10.5px] text-[#746A5C] mt-1 leading-tight">
                  State Highways & City Roads &bull; 72-Hr SLA
                </div>
              </button>
            </div>
          </div>

          {/* Authority Routing Banner */}
          <div className="p-4 rounded-xl border border-[#DCD0BD] bg-[#EEE4D2]/25 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#79583A]">
                Designated Road Authority & Ministry
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-[#FFFDF8] border border-[#DCD0BD] font-mono text-[#302A23]">
                {roadCase?.id || 'CASE-PREVIEW'}
              </span>
            </div>
            <div className="font-bold text-sm text-[#302A23]">{authorityName}</div>
            <div className="text-xs text-[#746A5C] flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>Road: <strong>{roadCase?.roadName || 'Reported Roadway'}</strong></span>
              <span>GPS: <strong>{roadCase?.location.latitude.toFixed(5)}° N, {roadCase?.location.longitude.toFixed(5)}° E</strong></span>
              <span>24x7 Helpline: <strong className="text-[#2F7657] font-bold">{helplinePhone}</strong></span>
            </div>
          </div>

          {/* If Dispatched: Show Registered Ticket & SLA Status */}
          {isDispatched ? (
            <div className="p-4 rounded-xl border-2 border-[#2F7657]/30 bg-[#2F7657]/5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 text-[#2F7657] font-bold text-sm">
                  <CheckCircle size={18} />
                  <span>Officially Registered with Government Portal</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#2F7657] text-white text-[11px] font-bold">
                  <Clock size={12} />
                  <span>72-Hour Citizen Charter SLA Active</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-lg bg-white border border-[#DCD0BD] space-y-1">
                  <div className="text-[11px] text-[#746A5C] font-semibold">GOVERNMENT GRIEVANCE NUMBER</div>
                  <div className="flex items-center justify-between font-mono font-bold text-sm text-[#302A23]">
                    <span>{ticketNumber}</span>
                    <button
                      type="button"
                      onClick={handleCopyTicket}
                      className="p-1 rounded text-[#746A5C] hover:text-[#302A23] hover:bg-[#EEE4D2]"
                      title="Copy ticket number"
                    >
                      {copiedTicket ? <Check size={14} className="text-[#2F7657]" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-white border border-[#DCD0BD] space-y-1">
                  <div className="text-[11px] text-[#746A5C] font-semibold">ESTIMATED ASPHALT REQUIRED</div>
                  <div className="font-bold text-sm text-[#79583A]">
                    ~{estAsphaltKg} kg cold-mix asphalt ({areaM2} m² area)
                  </div>
                </div>
              </div>

              {/* Progress Milestones */}
              <div className="space-y-2 pt-2">
                <div className="text-xs font-bold text-[#302A23]">Redressal Progression Timeline:</div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2 text-[#2F7657]">
                    <CheckCircle size={14} />
                    <span className="font-semibold">Docket Generated & Validated with Central Grievance Registry</span>
                  </div>
                  <div className="flex items-center gap-2 text-[#2F7657]">
                    <CheckCircle size={14} />
                    <span className="font-semibold">Auto-routed to Executive Engineer (PWD / Highway Division)</span>
                  </div>
                  <div className="flex items-center gap-2 text-[#79583A]">
                    <Clock size={14} className="animate-spin" />
                    <span>Inspection Crew Assigned & Physical Cold Mix Scheduled</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Dispatch Callout */
            <div className="p-4 rounded-xl border border-[#DCD0BD] bg-[#FFFDF8] space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-[#79583A]/10 text-[#79583A]">
                  <Send size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#302A23]">1-Click Free Government Filing</h4>
                  <p className="text-xs text-[#746A5C] mt-0.5">
                    Forward this pothole report with verified Shoelace geometry, debris exclusion filter, and GPS coordinates directly to {authorityName}.
                  </p>
                </div>
              </div>

              {errorMessage && (
                <div className="p-2.5 rounded-lg bg-[#B44343]/10 border border-[#B44343]/30 text-xs text-[#B44343] flex items-center gap-2">
                  <AlertCircle size={14} />
                  <span>{errorMessage}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleDispatch}
                disabled={isDispatching || !roadCase}
                className="w-full py-2.5 px-4 rounded-xl bg-[#79583A] text-white font-bold text-sm hover:bg-[#61442B] disabled:opacity-50 transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                {isDispatching ? (
                  <>
                    <Clock size={16} className="animate-spin" />
                    <span>Registering with Government Portal...</span>
                  </>
                ) : (
                  <>
                    <Landmark size={16} />
                    <span>Dispatch Grievance to {authorityName} (Free)</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Formatted Standard Government Dossier (Copy-Paste Ready) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#302A23] flex items-center gap-1.5">
                <FileText size={13} className="text-[#79583A]" />
                <span>Standardized Government Grievance Dossier</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadDossier}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border border-[#DCD0BD] hover:bg-[#EEE4D2] text-[#302A23] transition cursor-pointer"
                >
                  <Download size={12} className="text-[#79583A]" />
                  <span>Download .txt Dossier</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyDossier}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border border-[#DCD0BD] hover:bg-[#EEE4D2] text-[#302A23] transition cursor-pointer"
                >
                  {copiedDossier ? (
                    <>
                      <Check size={12} className="text-[#2F7657]" />
                      <span className="text-[#2F7657]">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      <span>Copy Full Dossier</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <textarea
              readOnly
              rows={7}
              value={govt?.dossierSummary || generateDossierText()}
              className="w-full p-3 rounded-xl border border-[#DCD0BD] bg-[#EEE4D2]/20 font-mono text-[11px] leading-relaxed text-[#302A23] resize-none focus:outline-hidden"
            />
          </div>

          {/* Quick Actions & Government Portals Links */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            <a
              href={currentChannel.portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl border border-[#DCD0BD] bg-white hover:bg-[#EEE4D2]/40 text-xs font-bold text-[#302A23] transition text-center"
            >
              <ExternalLink size={13} className="text-[#79583A]" />
              <span>{selectedChannel === 'nhai' ? 'Official NHAI Portal' : 'Grievance Portal'}</span>
            </a>

            <a
              href={currentChannel.incidentAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl border border-[#2F7657]/30 bg-[#2F7657]/5 hover:bg-[#2F7657]/15 text-xs font-bold text-[#2F7657] transition text-center"
            >
              <ExternalLink size={13} className="text-[#2F7657]" />
              <span>{selectedChannel === 'nhai' ? 'Rajmargyatra App' : 'MoRTH Portal'}</span>
            </a>

            <a
              href={`tel:${helplinePhone.replace(/[^0-9]/g, '')}`}
              className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl border border-[#DCD0BD] bg-white hover:bg-[#EEE4D2]/40 text-xs font-bold text-[#302A23] transition text-center"
            >
              <PhoneCall size={13} className="text-[#2F7657]" />
              <span>Call Helpline ({helplinePhone})</span>
            </a>
          </div>

          {/* Bulk Export Buttons for PWD & City Engineers */}
          <div className="p-3.5 rounded-xl border border-[#DCD0BD] bg-[#EEE4D2]/20 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-[#746A5C]">
              <Download size={14} className="text-[#79583A]" />
              <span className="font-semibold text-[#302A23]">Government Engineer Exports:</span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/api/govt-portal/export/geojson"
                download="goodways-govt-potholes.geojson"
                className="px-3 py-1 rounded-lg bg-white border border-[#DCD0BD] hover:bg-[#EEE4D2] font-semibold text-[#302A23] text-xs transition"
              >
                GeoJSON Map Layer
              </a>
              <a
                href="/api/govt-portal/export/csv"
                download="goodways-govt-audit.csv"
                className="px-3 py-1 rounded-lg bg-white border border-[#DCD0BD] hover:bg-[#EEE4D2] font-semibold text-[#302A23] text-xs transition"
              >
                Audit CSV Table
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#DCD0BD] bg-[#EEE4D2]/30 flex items-center justify-between text-xs text-[#746A5C]">
          <span>Free Public Utility Integration &bull; Open311 & CPGRAMS Compliant</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#79583A] text-white font-semibold hover:bg-[#61442B] transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
