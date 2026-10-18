/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { RoadCase, Department } from './types';
import { getOfflineDrafts, updateDraftStatus } from './utils/offlineDb';
import { Navbar } from './components/Navbar';
import { CitizenReportView } from './components/CitizenReportView';
import { CitizenCaseList } from './components/CitizenCaseList';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminCaseDetail } from './components/AdminCaseDetail';
import { MathTestModal } from './components/MathTestModal';
import { GovtPortalModal } from './components/GovtPortalModal';
import { RoadMapSection } from './components/RoadMapSection';
import { AuthModal } from './components/AuthModal';
import { useAuth } from './context/AuthContext';
import { apiUrl } from './api';
import { Compass, ShieldCheck, HeartHandshake } from 'lucide-react';

export default function App() {
  const { currentUser, token, logout } = useAuth();
  const [currentRole, setCurrentRole] = useState<'citizen' | 'official'>('citizen');
  const [activeView, setActiveView] = useState<string>('report');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  // Sync role with logged-in user
  useEffect(() => {
    if (currentUser?.role) {
      setCurrentRole(currentUser.role);
    }
  }, [currentUser]);

  const [cases, setCases] = useState<RoadCase[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Network and offline drafts
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [offlineDraftsCount, setOfflineDraftsCount] = useState<number>(0);

  // Math Engine QA Modal
  const [isMathTestOpen, setIsMathTestOpen] = useState<boolean>(false);

  // Free Government Grievance Portal Modal
  const [isGovtPortalOpen, setIsGovtPortalOpen] = useState<boolean>(false);
  const [govtPortalActiveCase, setGovtPortalActiveCase] = useState<RoadCase | undefined>(undefined);

  // Google Maps Platform API key (strictly validated to prevent InvalidKeyMapError)
  const rawClientKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || '';
  const initialValidKey = rawClientKey.startsWith('AIza') && rawClientKey.length >= 30 ? rawClientKey : '';
  const [mapsApiKey, setMapsApiKey] = useState<string>(initialValidKey);

  // Fetch initial cases, departments, and public config from backend
  const fetchCasesAndDepartments = async () => {
    try {
      const hasValidSession = Boolean(currentUser && token && token !== 'tok-default-demo');
      const authHeaders: Record<string, string> = hasValidSession
        ? {
            Authorization: `Bearer ${token || ''}`,
            'X-User-Email': currentUser?.email || '',
          }
        : {};
      const [casesRes, deptsRes, configRes] = await Promise.all([
        hasValidSession ? fetch(apiUrl('/api/cases'), { headers: authHeaders }) : Promise.resolve(null),
        fetch(apiUrl('/api/departments')),
        fetch(apiUrl('/api/config')).catch(() => null),
      ]);

      if (casesRes?.ok) {
        const casesData = await casesRes.json();
        setCases(casesData);
      } else if (casesRes?.status === 401) {
        logout();
        setCases([]);
      }
      if (deptsRes.ok) {
        const deptsData = await deptsRes.json();
        setDepartments(deptsData);
      }
      if (configRes && configRes.ok) {
        const configData = await configRes.json();
        if (configData.mapsApiKey && configData.mapsApiKey.startsWith('AIza') && configData.mapsApiKey.length >= 30) {
          setMapsApiKey(configData.mapsApiKey);
        }
      }
    } catch (err) {
      console.warn('Could not fetch initial data from backend:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Check and sync pending offline drafts from IndexedDB
  const syncOfflineDrafts = async () => {
    try {
      const drafts = await getOfflineDrafts();
      const pending = drafts.filter((d) => d.syncStatus === 'pending_sync' || d.syncStatus === 'failed');
      setOfflineDraftsCount(pending.length);

      const hasValidSession = Boolean(currentUser && token && token !== 'tok-default-demo');
      if (navigator.onLine && hasValidSession && pending.length > 0) {
        for (const draft of pending) {
          try {
            await updateDraftStatus(draft.localId, 'uploading');
            const res = await fetch(apiUrl('/api/cases'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(currentUser
                  ? { Authorization: `Bearer ${token || ''}`, 'X-User-Email': currentUser.email }
                  : {}),
              },
              body: JSON.stringify(draft.caseData),
            });

            if (res.ok) {
              const created = await res.json();
              await updateDraftStatus(draft.localId, 'submitted', created.id);
              setCases((prev) => [created, ...prev]);
            } else {
              await updateDraftStatus(draft.localId, 'failed', undefined, `HTTP ${res.status}`);
            }
          } catch (syncErr: any) {
            await updateDraftStatus(draft.localId, 'failed', undefined, syncErr.message);
          }
        }
        // Re-count pending after sync attempt
        const updatedDrafts = await getOfflineDrafts();
        setOfflineDraftsCount(
          updatedDrafts.filter((d) => d.syncStatus === 'pending_sync' || d.syncStatus === 'failed').length
        );
      }
    } catch (e) {
      console.warn('IndexedDB sync error:', e);
    }
  };

  useEffect(() => {
    fetchCasesAndDepartments();
    syncOfflineDrafts();

    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineDrafts();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [currentUser, token]);

  // Handle new case created from CitizenReportView
  const handleCaseCreated = (newCase: RoadCase) => {
    setCases((prev) => [newCase, ...prev.filter((c) => c.id !== newCase.id)]);
    setSelectedCaseId(newCase.id);
    setActiveView('citizen_cases');
  };

  // Handle case update from Admin
  const handleUpdateCase = (updatedCase: RoadCase) => {
    setCases((prev) => prev.map((c) => (c.id === updatedCase.id ? updatedCase : c)));
  };

  // Navigation handlers
  const handleRoleChange = (newRole: 'citizen' | 'official') => {
    setCurrentRole(newRole);
    if (newRole === 'official') {
      setActiveView(selectedCaseId ? 'admin_case_detail' : 'admin_dashboard');
    } else {
      setActiveView(selectedCaseId ? 'citizen_cases' : 'report');
    }
  };

  const handleNavigate = (view: string) => {
    if (
      (view === 'admin_dashboard' || view === 'admin_case_detail') &&
      (!currentUser || currentUser.role !== 'official' || currentUser.approvalStatus !== 'approved')
    ) {
      alert('Access Denied: The Operations Center requires an approved government official account.');
      setActiveView('report');
      return;
    }
    setActiveView(view);
    if (view === 'report') {
      setSelectedCaseId(null);
    }
  };

  const handleSelectCaseFromAdmin = (caseId: string) => {
    setSelectedCaseId(caseId);
    setActiveView('admin_case_detail');
  };

  const handleSelectCaseFromCitizen = (caseId: string | null) => {
    setSelectedCaseId(caseId);
  };

  const handleOpenGovtPortal = (targetCase?: RoadCase) => {
    const chosen = targetCase || selectedCase || cases[0];
    setGovtPortalActiveCase(chosen);
    setIsGovtPortalOpen(true);
  };

  const selectedCase = cases.find((c) => c.id === selectedCaseId);

  return (
    <div className="min-h-screen bg-[#F7F2E8] text-[#302A23] flex flex-col font-sans">
      {/* Top Application Navbar */}
      <Navbar
        currentRole={currentRole}
        onRoleChange={handleRoleChange}
        activeView={activeView}
        onNavigate={handleNavigate}
        isOnline={isOnline}
        offlineDraftsCount={offlineDraftsCount}
        onOpenMathTests={() => setIsMathTestOpen(true)}
        onOpenGovtPortal={() => handleOpenGovtPortal()}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6">
        {isLoading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-10 h-10 border-3 border-[#79583A] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-semibold text-[#746A5C]">Loading GoodWays Infrastructure Database...</p>
          </div>
        ) : (
          <>
            {/* Citizen: Report Damage */}
            {currentRole === 'citizen' && activeView === 'report' && (
              <CitizenReportView
                onCaseCreated={handleCaseCreated}
                onNavigateToCase={(caseId) => {
                  setSelectedCaseId(caseId);
                  setActiveView('citizen_cases');
                }}
                onOpenGovtPortal={handleOpenGovtPortal}
                mapsApiKey={mapsApiKey}
              />
            )}

            {/* Citizen: My Cases & Tracking */}
            {currentRole === 'citizen' && activeView === 'citizen_cases' && (
              <CitizenCaseList
                cases={cases}
                selectedCaseId={selectedCaseId}
                onSelectCase={handleSelectCaseFromCitizen}
                onNewReport={() => {
                  setSelectedCaseId(null);
                  setActiveView('report');
                }}
                onOpenGovtPortal={handleOpenGovtPortal}
                mapsApiKey={mapsApiKey}
              />
            )}

            {/* Official: Operations Dashboard with Strict Authorization Guard */}
            {activeView === 'admin_dashboard' && (
              currentUser && currentUser.role === 'official' && currentUser.approvalStatus === 'approved' ? (
                <AdminDashboard
                  cases={cases}
                  departments={departments}
                  onSelectCase={handleSelectCaseFromAdmin}
                  mapsApiKey={mapsApiKey}
                />
              ) : (
                <div className="p-8 rounded-2xl bg-white border border-[#DCD0BD] text-center space-y-3 shadow-sm">
                  <h3 className="text-lg font-bold text-[#B44343]">Access Denied: Authentication Required</h3>
                  <p className="text-xs text-[#746A5C] max-w-md mx-auto">
                    The Public Works Operations Center is restricted to approved government officials and administrators. Please sign in with an authorized authority account.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveView('report')}
                    className="px-4 py-2 rounded-xl bg-[#79583A] text-white font-bold text-xs hover:bg-[#61442B] transition"
                  >
                    Return to Public Portal
                  </button>
                </div>
              )
            )}

            {/* Official: Single Case Review & Triage Detail */}
            {activeView === 'admin_case_detail' && selectedCase && (
              currentUser && currentUser.role === 'official' && currentUser.approvalStatus === 'approved' ? (
                <AdminCaseDetail
                  roadCase={selectedCase}
                  departments={departments}
                  onBack={() => {
                    setSelectedCaseId(null);
                    setActiveView('admin_dashboard');
                  }}
                  onUpdateCase={handleUpdateCase}
                  onOpenGovtPortal={handleOpenGovtPortal}
                  mapsApiKey={mapsApiKey}
                />
              ) : (
                <div className="p-8 rounded-2xl bg-white border border-[#DCD0BD] text-center space-y-3 shadow-sm">
                  <h3 className="text-lg font-bold text-[#B44343]">Access Denied</h3>
                  <p className="text-xs text-[#746A5C]">Restricted to authorized officials.</p>
                </div>
              )
            )}

            {/* Google Road Map & Infrastructure GIS View */}
            {activeView === 'map' && (
              <RoadMapSection
                cases={cases}
                onSelectCase={(caseId) => {
                  setSelectedCaseId(caseId);
                  if (currentRole === 'official') {
                    setActiveView('admin_case_detail');
                  } else {
                    setActiveView('citizen_cases');
                  }
                }}
                onOpenGovtPortal={handleOpenGovtPortal}
                mapsApiKey={mapsApiKey}
              />
            )}
          </>
        )}
      </main>

      {/* Mathematical Geometry Engine QA Modal */}
      <MathTestModal
        isOpen={isMathTestOpen}
        onClose={() => setIsMathTestOpen(false)}
      />

      {/* Free Government Grievance Portal Sync Modal (CPGRAMS / NHAI / PWD) */}
      <GovtPortalModal
        isOpen={isGovtPortalOpen}
        onClose={() => setIsGovtPortalOpen(false)}
        roadCase={govtPortalActiveCase || selectedCase || cases[0]}
        onCaseUpdated={(updated) => {
          handleUpdateCase(updated);
          setGovtPortalActiveCase(updated);
        }}
      />

      {/* Citizen & Civil Authority Authentication Modal */}
      <AuthModal
        departments={departments}
        onRoleChanged={handleRoleChange}
      />

      {/* Footer */}
      <footer className="border-t border-[#DCD0BD] bg-[#FFFDF8] py-4 px-4 text-xs text-[#746A5C]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-[#302A23]">GoodWays</span>
            <span>•</span>
            <span>Civil Infrastructure Road Damage Detection & Repair Verification</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Deterministic Gauss Shoelace Geometry</span>
            <span>•</span>
            <span>Gemini 3.8 Flash Vision</span>
            <span>•</span>
            <button
              onClick={() => setIsMathTestOpen(true)}
              className="text-[#79583A] font-semibold hover:underline"
            >
              Run Engine Tests
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
