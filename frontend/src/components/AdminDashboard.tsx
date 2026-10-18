import React, { useState } from 'react';
import { RoadCase, Department, CaseStatus } from '../types';
import { RoadGoogleMap } from './RoadGoogleMap';
import { apiUrl } from '../api';
import { useAuth } from '../context/AuthContext';
import {
  Building,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Flame,
  Search,
  Filter,
  ArrowRight,
  ShieldAlert,
  Users,
  Wrench,
  CheckSquare,
  MapPin,
  Map as MapIcon,
  ShieldCheck,
  Key,
  Copy,
  Check,
  Lock,
  UserCheck,
  UserX,
} from 'lucide-react';

interface AdminDashboardProps {
  cases: RoadCase[];
  departments: Department[];
  onSelectCase: (caseId: string) => void;
  mapsApiKey?: string;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  cases,
  departments,
  onSelectCase,
  mapsApiKey,
}) => {
  const { currentUser, token } = useAuth();
  const authHeaders = {
    Authorization: `Bearer ${token || ''}`,
    'X-User-Email': currentUser?.email || '',
  };
  const [activeTab, setActiveTab] = useState<'all' | 'priority' | 'verification' | 'in_progress' | 'city_map' | 'authority_management'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all');

  // Authority personnel state
  const [authorities, setAuthorities] = useState<any[]>([]);
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [authActionMsg, setAuthActionMsg] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const fetchAuthorities = async () => {
    setIsLoadingAuth(true);
    try {
      const res = await fetch(apiUrl('/api/admin/authorities'), { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setAuthorities(data);
      }
    } catch (e) {
      console.warn('Failed to load authorities:', e);
    } finally {
      setIsLoadingAuth(false);
    }
  };

  React.useEffect(() => {
    fetchAuthorities();
  }, []);

  const handleApproveOfficer = async (userId: string) => {
    try {
      const res = await fetch(apiUrl('/api/admin/authorities/approve'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ userId, approverName: 'Chief Super Admin' }),
      });
      const data = await res.json();
      if (res.ok) {
        setAuthActionMsg(data.message || 'Officer approved successfully');
        fetchAuthorities();
        setTimeout(() => setAuthActionMsg(null), 3000);
      }
    } catch (err: any) {
      setAuthActionMsg(err.message || 'Approval failed');
    }
  };

  const handleRevokeOfficer = async (userId: string) => {
    try {
      const res = await fetch(apiUrl('/api/admin/authorities/revoke'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ userId, approverName: 'Chief Super Admin' }),
      });
      const data = await res.json();
      if (res.ok) {
        setAuthActionMsg(data.message || 'Access revoked');
        fetchAuthorities();
        setTimeout(() => setAuthActionMsg(null), 3000);
      }
    } catch (err: any) {
      setAuthActionMsg(err.message || 'Action failed');
    }
  };

  const pendingAuthCount = authorities.filter((a) => a.approvalStatus === 'pending').length;

  // Compute live operational metrics from real database data
  const total = cases.length;
  const pendingReview = cases.filter((c) => c.status === 'Submitted' || c.status === 'Pending Review').length;
  const assigned = cases.filter((c) => c.status === 'Accepted' || c.status === 'Assigned').length;
  const inProgress = cases.filter((c) => c.status === 'Repair In Progress').length;
  const awaitingVerification = cases.filter((c) => c.status === 'Awaiting Verification').length;
  const resolved = cases.filter((c) => c.status === 'Resolved').length;
  const highPriority = cases.filter(
    (c) => c.overallSeverity === 'critical' || c.overallSeverity === 'high' || (c.priorityScore && c.priorityScore >= 75)
  ).length;

  // Filter cases based on tab, search, and department
  const filteredCases = cases.filter((c) => {
    if (activeTab === 'priority') {
      const isPri = c.overallSeverity === 'critical' || c.overallSeverity === 'high' || (c.priorityScore && c.priorityScore >= 75);
      if (!isPri) return false;
    } else if (activeTab === 'verification') {
      if (c.status !== 'Awaiting Verification') return false;
    } else if (activeTab === 'in_progress') {
      if (c.status !== 'Repair In Progress' && c.status !== 'Assigned') return false;
    }

    if (selectedDeptFilter !== 'all' && c.assignedDepartment !== selectedDeptFilter) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = c.id.toLowerCase().includes(q);
      const matchRoad = (c.roadName || '').toLowerCase().includes(q);
      const matchDept = (c.assignedDepartment || '').toLowerCase().includes(q);
      if (!matchId && !matchRoad && !matchDept) return false;
    }

    return true;
  });

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

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#DCD0BD] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[#302A23] tracking-tight">Public Works Operations Center</h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#79583A] text-white">
              Official Administration
            </span>
          </div>
          <p className="text-xs text-[#746A5C] mt-1">
            Real-time complaint triage, department forwarding, contractor work orders, and repair quality assurance.
          </p>
        </div>
      </div>

      {/* Operational Metrics Cards (7 Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-center">
        {/* Total */}
        <div className="rounded-xl border border-[#DCD0BD] bg-[#FFFDF8] p-3 shadow-xs">
          <div className="text-[10px] text-[#746A5C] uppercase font-bold tracking-wider">Total Reports</div>
          <div className="text-xl font-extrabold text-[#302A23] mt-1">{total}</div>
        </div>

        {/* Pending Review */}
        <div className="rounded-xl border border-[#DCD0BD] bg-[#FFFDF8] p-3 shadow-xs">
          <div className="text-[10px] text-[#9A6B25] uppercase font-bold tracking-wider">Pending Review</div>
          <div className="text-xl font-extrabold text-[#9A6B25] mt-1">{pendingReview}</div>
        </div>

        {/* Assigned */}
        <div className="rounded-xl border border-[#DCD0BD] bg-[#FFFDF8] p-3 shadow-xs">
          <div className="text-[10px] text-[#4B4136] uppercase font-bold tracking-wider">Assigned</div>
          <div className="text-xl font-extrabold text-[#4B4136] mt-1">{assigned}</div>
        </div>

        {/* In Progress */}
        <div className="rounded-xl border border-[#DCD0BD] bg-[#FFFDF8] p-3 shadow-xs">
          <div className="text-[10px] text-[#79583A] uppercase font-bold tracking-wider">In Progress</div>
          <div className="text-xl font-extrabold text-[#79583A] mt-1">{inProgress}</div>
        </div>

        {/* Awaiting Verification */}
        <div className="rounded-xl border border-[#DCD0BD] bg-[#FFFDF8] p-3 shadow-xs">
          <div className="text-[10px] text-[#79583A] uppercase font-bold tracking-wider">Verification</div>
          <div className="text-xl font-extrabold text-[#79583A] mt-1">{awaitingVerification}</div>
        </div>

        {/* Resolved */}
        <div className="rounded-xl border border-[#DCD0BD] bg-[#FFFDF8] p-3 shadow-xs">
          <div className="text-[10px] text-[#2F7657] uppercase font-bold tracking-wider">Resolved</div>
          <div className="text-xl font-extrabold text-[#2F7657] mt-1">{resolved}</div>
        </div>

        {/* High Priority */}
        <div className="rounded-xl border border-[#DCD0BD] bg-[#FFFDF8] p-3 shadow-xs">
          <div className="text-[10px] text-[#B44343] uppercase font-bold tracking-wider">High Priority</div>
          <div className="text-xl font-extrabold text-[#B44343] mt-1">{highPriority}</div>
        </div>
      </div>

      {/* Tabs and Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[#FFFDF8] border border-[#DCD0BD]">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === 'all'
                ? 'bg-[#79583A] text-white shadow-xs'
                : 'text-[#302A23] hover:bg-[#EEE4D2]'
            }`}
          >
            All Cases ({total})
          </button>
          <button
            onClick={() => setActiveTab('priority')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition ${
              activeTab === 'priority'
                ? 'bg-[#B44343] text-white shadow-xs'
                : 'text-[#B44343] hover:bg-[#B44343]/10'
            }`}
          >
            <Flame size={13} />
            <span>Priority Queue ({highPriority})</span>
          </button>
          <button
            onClick={() => setActiveTab('verification')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition ${
              activeTab === 'verification'
                ? 'bg-[#79583A] text-white shadow-xs'
                : 'text-[#79583A] hover:bg-[#79583A]/10'
            }`}
          >
            <CheckSquare size={13} />
            <span>Awaiting Verification ({awaitingVerification})</span>
          </button>
          <button
            onClick={() => setActiveTab('in_progress')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition ${
              activeTab === 'in_progress'
                ? 'bg-[#9A6B25] text-white shadow-xs'
                : 'text-[#9A6B25] hover:bg-[#9A6B25]/10'
            }`}
          >
            <Wrench size={13} />
            <span>Active Repairs ({inProgress})</span>
          </button>
          <button
            onClick={() => setActiveTab('city_map')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition ${
              activeTab === 'city_map'
                ? 'bg-[#79583A] text-white shadow-xs'
                : 'text-[#79583A] hover:bg-[#79583A]/10 font-bold'
            }`}
          >
            <MapIcon size={13} />
            <span>Interactive City Map</span>
          </button>

          <button
            onClick={() => setActiveTab('authority_management')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              activeTab === 'authority_management'
                ? 'bg-[#2F7657] text-white shadow-xs'
                : 'text-[#2F7657] hover:bg-[#2F7657]/10 font-bold'
            }`}
          >
            <Users size={13} />
            <span>Authority Access & Approvals</span>
            {pendingAuthCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-[#B44343] text-white animate-pulse">
                {pendingAuthCount}
              </span>
            )}
          </button>
        </div>

        {/* Search & Department Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px]">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#746A5C]" />
            <input
              type="text"
              placeholder="Search ID, street..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1 rounded-lg border border-[#DCD0BD] bg-[#FFFDF8] text-xs text-[#302A23] focus:outline-[#79583A]"
            />
          </div>

          <select
            value={selectedDeptFilter}
            onChange={(e) => setSelectedDeptFilter(e.target.value)}
            className="px-2.5 py-1 rounded-lg border border-[#DCD0BD] bg-[#FFFDF8] text-xs text-[#302A23] font-medium"
          >
            <option value="all">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Conditional: City Map View or Cases Table View */}
      {activeTab === 'city_map' ? (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1 text-xs text-[#746A5C]">
            <span className="font-semibold text-[#302A23]">
              Showing {filteredCases.length} road damage cases plotted on Google Maps across the municipal district
            </span>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#B44343]" /> Critical</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#9A6B25]" /> High</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#79583A]" /> Medium</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#2F7657]" /> Resolved</span>
            </div>
          </div>
          <RoadGoogleMap
            apiKey={mapsApiKey}
            cases={filteredCases}
            onSelectCase={onSelectCase}
            height="540px"
            defaultZoom={12}
          />
        </div>
      ) : (
        /* Cases Table View */
        <div className="rounded-xl border border-[#DCD0BD] bg-[#FFFDF8] overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#EEE4D2]/50 border-b border-[#DCD0BD] text-[#746A5C] uppercase text-[10px] tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Case ID</th>
                  <th className="py-3 px-4">Roadway / Landmark</th>
                  <th className="py-3 px-4">Primary Defect</th>
                  <th className="py-3 px-4">Measurements (cm)</th>
                  <th className="py-3 px-4">Severity / Priority</th>
                  <th className="py-3 px-4">Assigned Department</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCD0BD]/60 text-[#302A23]">
                {filteredCases.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#746A5C]">
                      No cases match the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredCases.map((c) => {
                    const firstDmg = c.damageRegions[0];
                    return (
                      <tr
                        key={c.id}
                        onClick={() => onSelectCase(c.id)}
                        className="hover:bg-[#EEE4D2]/25 transition cursor-pointer"
                      >
                        <td className="py-3 px-4 font-mono font-bold text-[#746A5C] whitespace-nowrap">
                          {c.id}
                        </td>
                        <td className="py-3 px-4 font-semibold max-w-[180px] truncate">
                          {c.roadName}
                        </td>
                        <td className="py-3 px-4 text-[#4B4136] whitespace-nowrap">
                          {firstDmg ? firstDmg.typeLabel : 'Pavement Defect'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {firstDmg?.measurements.lengthCm ? (
                            <span>
                              {firstDmg.measurements.lengthCm.toFixed(1)} cm × {firstDmg.measurements.widthCm.toFixed(1)} cm
                              <span className="text-[10px] text-[#2F7657] font-semibold ml-1">(calibrated)</span>
                            </span>
                          ) : firstDmg?.measurements.lengthM ? (
                            <span>
                              {firstDmg.measurements.lengthM}m × {firstDmg.measurements.widthM}m
                            </span>
                          ) : (
                            <span className="text-[#746A5C]">
                              {firstDmg?.measurements.lengthPx || 0}px × {firstDmg?.measurements.widthPx || 0}px
                            </span>
                          )}
                        </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            c.overallSeverity === 'critical'
                              ? 'bg-[#B44343]/15 text-[#B44343]'
                              : c.overallSeverity === 'high'
                              ? 'bg-[#9A6B25]/15 text-[#9A6B25]'
                              : 'bg-[#79583A]/15 text-[#79583A]'
                          }`}
                        >
                          {c.overallSeverity} ({c.priorityScore})
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-[180px] truncate text-[#746A5C]">
                        {c.assignedDepartment || 'Unassigned'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${getStatusBadge(c.status)}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectCase(c.id);
                          }}
                          className="px-2.5 py-1 rounded bg-[#79583A] text-white text-[11px] font-semibold hover:bg-[#61442B] transition inline-flex items-center gap-1"
                        >
                          <span>Review</span>
                          <ArrowRight size={11} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    )}

    {/* Authority Access Management & Officer Approvals Panel */}
    {activeTab === 'authority_management' && (
      <div className="space-y-4">
        {/* Top Banner with Master Passkey */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-[#2F7657]/10 via-[#2F7657]/5 to-[#EEE4D2]/40 border border-[#2F7657]/30 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[#2F7657] text-white">
                <ShieldCheck size={18} />
              </span>
              <h3 className="font-bold text-base text-[#302A23]">
                Government Authority Access Governance & RBAC
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#2F7657] text-white uppercase tracking-wider">
                Restricted Enrollment
              </span>
            </div>
            <p className="text-xs text-[#746A5C] max-w-xl">
              Per road safety protocols, citizens cannot access the Authority Dashboard. Official registrations require Super Admin approval or a verified Government Passkey.
            </p>
          </div>

          {/* Master Admin Key Box */}
          <div className="p-3 rounded-xl bg-white border border-[#DCD0BD] shadow-xs flex flex-col gap-1.5 min-w-[280px]">
            <div className="text-[10px] text-[#746A5C] font-bold uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Key size={11} className="text-[#9A6B25]" />
                <span>Super Admin Authorization Passkey</span>
              </span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#2F7657]/15 text-[#2F7657] font-semibold">Active</span>
            </div>
            <div className="flex items-center justify-between font-mono font-bold text-xs text-[#302A23] bg-[#EEE4D2]/40 px-2.5 py-1.5 rounded-lg border border-[#DCD0BD]">
              <span>Configured securely in the backend environment</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText('The admin invite code is managed by the deployment administrator.');
                  setCopiedKey(true);
                  setTimeout(() => setCopiedKey(false), 2000);
                }}
                className="p-1 rounded text-[#746A5C] hover:text-[#302A23] hover:bg-white"
                title="Copy passkey to clipboard"
              >
                {copiedKey ? <Check size={13} className="text-[#2F7657]" /> : <Copy size={13} />}
              </button>
            </div>
            <div className="text-[10px] text-[#746A5C]">
              Share with authorized NHAI / PWD field engineers for instant activation.
            </div>
          </div>
        </div>

        {authActionMsg && (
          <div className="p-3 rounded-xl bg-[#2F7657]/10 border border-[#2F7657]/30 text-xs text-[#2F7657] font-semibold flex items-center gap-2">
            <CheckCircle2 size={15} />
            <span>{authActionMsg}</span>
          </div>
        )}

        {/* Officers and Applications Table */}
        <div className="rounded-2xl border border-[#DCD0BD] bg-[#FFFDF8] shadow-sm overflow-hidden">
          <div className="p-4 border-b border-[#DCD0BD] bg-[#EEE4D2]/30 flex items-center justify-between">
            <div>
              <h4 className="font-bold text-sm text-[#302A23] flex items-center gap-2">
                <span>Registered Authority Officers & Verification Queue</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#79583A]/15 text-[#79583A]">
                  {authorities.length} Personnel
                </span>
              </h4>
              <p className="text-xs text-[#746A5C]">
                Review credentials, approve pending engineers, or revoke authority permissions.
              </p>
            </div>
            <button
              onClick={fetchAuthorities}
              className="px-3 py-1.5 rounded-lg bg-white border border-[#DCD0BD] text-xs font-semibold text-[#302A23] hover:bg-[#EEE4D2] transition"
            >
              Refresh Personnel
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#EEE4D2]/40 text-[#746A5C] font-bold uppercase tracking-wider text-[10px] border-b border-[#DCD0BD]">
                <tr>
                  <th className="py-3 px-4">Officer Details</th>
                  <th className="py-3 px-4">Department & Jurisdiction</th>
                  <th className="py-3 px-4">Badge / Employee ID</th>
                  <th className="py-3 px-4">Approval Status</th>
                  <th className="py-3 px-4">Authorization</th>
                  <th className="py-3 px-4 text-right">Access Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCD0BD]/60 text-[#302A23]">
                {isLoadingAuth ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#746A5C]">
                      Loading authority personnel directory...
                    </td>
                  </tr>
                ) : authorities.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#746A5C]">
                      No authority personnel registered yet.
                    </td>
                  </tr>
                ) : (
                  authorities.map((officer) => (
                    <tr key={officer.id} className="hover:bg-[#EEE4D2]/20 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-sm text-[#302A23] flex items-center gap-1.5">
                          <span>{officer.name}</span>
                          {officer.isSuperAdmin && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-[#2F7657] text-white">
                              SUPER ADMIN
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#746A5C]">{officer.email}</div>
                        {officer.phone && <div className="text-[10px] text-[#746A5C]">{officer.phone}</div>}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-xs text-[#302A23]">{officer.department || 'Roads Division'}</div>
                        <div className="text-[11px] text-[#746A5C]">{officer.designation || 'Engineer'}</div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-xs font-semibold text-[#79583A]">
                        {officer.badgeNumber || 'N/A'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {officer.approvalStatus === 'approved' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#2F7657]/15 text-[#2F7657] border border-[#2F7657]/30">
                            <ShieldCheck size={12} />
                            <span>Approved Officer</span>
                          </span>
                        ) : officer.approvalStatus === 'pending' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#9A6B25]/15 text-[#9A6B25] border border-[#9A6B25]/30 animate-pulse">
                            <Clock size={12} />
                            <span>Pending Approval</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#B44343]/15 text-[#B44343] border border-[#B44343]/30">
                            <Lock size={12} />
                            <span>Revoked / Suspended</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-[11px] text-[#746A5C]">
                        {officer.authorizedBy || (officer.isSuperAdmin ? 'Root System Initializer' : 'Admin Approved')}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {officer.isSuperAdmin ? (
                          <span className="text-[11px] font-semibold text-[#746A5C] italic">Root Authority</span>
                        ) : officer.approvalStatus === 'pending' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleApproveOfficer(officer.id)}
                              className="px-2.5 py-1 rounded-lg bg-[#2F7657] text-white text-[11px] font-bold hover:bg-[#255f46] transition flex items-center gap-1 cursor-pointer"
                            >
                              <UserCheck size={12} />
                              <span>Approve</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRevokeOfficer(officer.id)}
                              className="px-2.5 py-1 rounded-lg bg-[#B44343]/10 text-[#B44343] border border-[#B44343]/30 text-[11px] font-bold hover:bg-[#B44343] hover:text-white transition flex items-center gap-1 cursor-pointer"
                            >
                              <UserX size={12} />
                              <span>Reject</span>
                            </button>
                          </div>
                        ) : officer.approvalStatus === 'approved' ? (
                          <button
                            type="button"
                            onClick={() => handleRevokeOfficer(officer.id)}
                            className="px-2.5 py-1 rounded-lg border border-[#B44343]/30 text-[#B44343] hover:bg-[#B44343] hover:text-white text-[11px] font-semibold transition cursor-pointer"
                          >
                            Revoke Access
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleApproveOfficer(officer.id)}
                            className="px-2.5 py-1 rounded-lg bg-[#2F7657] text-white text-[11px] font-semibold hover:bg-[#255f46] transition cursor-pointer"
                          >
                            Re-activate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )}
  </div>
);
};
