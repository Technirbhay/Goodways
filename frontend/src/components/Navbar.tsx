import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Compass,
  Shield,
  User,
  Wifi,
  WifiOff,
  Calculator,
  PlusCircle,
  List,
  LayoutDashboard,
  CheckSquare,
  Landmark,
  MapPin,
  LogOut,
  LogIn,
  UserPlus,
  ChevronDown,
  Building,
  BadgeCheck,
} from 'lucide-react';

interface NavbarProps {
  currentRole: 'citizen' | 'official';
  onRoleChange: (role: 'citizen' | 'official') => void;
  activeView: string;
  onNavigate: (view: string) => void;
  isOnline: boolean;
  offlineDraftsCount: number;
  onOpenMathTests: () => void;
  onOpenGovtPortal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  onRoleChange,
  activeView,
  onNavigate,
  isOnline,
  offlineDraftsCount,
  onOpenMathTests,
  onOpenGovtPortal,
}) => {
  const { currentUser, isAuthenticated, logout, openAuthModal } = useAuth();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-[#FFFDF8]/95 backdrop-blur-md border-b border-[#DCD0BD] shadow-2xs font-sans">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate(currentRole === 'citizen' ? 'report' : 'admin_dashboard')}
            className="flex items-center gap-2.5 text-left group"
          >
            <div className="w-9 h-9 rounded-xl bg-[#79583A] text-white flex items-center justify-center font-black shadow-xs group-hover:bg-[#61442B] transition">
              <Compass size={20} />
            </div>
            <div>
              <div className="font-extrabold text-base tracking-tight text-[#302A23] leading-none">
                GoodWays
              </div>
              <div className="text-[10px] font-semibold text-[#746A5C] tracking-wide mt-0.5">
                AI ROAD MEASUREMENT & REPAIRS
              </div>
            </div>
          </button>
        </div>

        {/* Center Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1 text-xs font-semibold">
          {currentRole === 'citizen' ? (
            <>
              <button
                onClick={() => onNavigate('report')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  activeView === 'report'
                    ? 'bg-[#79583A] text-white shadow-xs'
                    : 'text-[#302A23] hover:bg-[#EEE4D2]'
                }`}
              >
                <PlusCircle size={14} />
                <span>Report Defect</span>
              </button>

              <button
                onClick={() => onNavigate('citizen_cases')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  activeView === 'citizen_cases'
                    ? 'bg-[#79583A] text-white shadow-xs'
                    : 'text-[#302A23] hover:bg-[#EEE4D2]'
                }`}
              >
                <List size={14} />
                <span>Track Complaints</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => onNavigate('admin_dashboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                activeView === 'admin_dashboard'
                  ? 'bg-[#79583A] text-white shadow-xs'
                  : 'text-[#302A23] hover:bg-[#EEE4D2]'
              }`}
            >
              <LayoutDashboard size={14} />
              <span>Operations Dashboard</span>
            </button>
          )}

          {/* Interactive Google Road Map Tab */}
          <button
            onClick={() => onNavigate('map')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              activeView === 'map'
                ? 'bg-[#4285F4] text-white font-bold shadow-xs'
                : 'text-[#302A23] hover:bg-[#EEE4D2]'
            }`}
            title="Interactive Google Road Map & Defect GIS Explorer"
          >
            <MapPin size={14} className={activeView === 'map' ? 'text-white' : 'text-[#EA4335]'} />
            <span>Google Road Map</span>
          </button>

          {/* Free Government Grievance Portal Sync Launcher */}
          <button
            onClick={onOpenGovtPortal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#2F7657]/30 bg-[#2F7657]/10 text-[#2F7657] hover:bg-[#2F7657]/20 transition ml-1 font-semibold"
            title="Free Government Portal Grievance Sync (CPGRAMS / NHAI / PWD)"
          >
            <Landmark size={13} />
            <span>Govt Portal</span>
          </button>

          {/* Independent Math Engine QA Test Suite Launcher */}
          <button
            onClick={onOpenMathTests}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#DCD0BD] bg-[#EEE4D2]/40 text-[#4B4136] hover:bg-[#EEE4D2] transition ml-1"
            title="Inspect & run independent QA unit tests on the deterministic geometry engine"
          >
            <Calculator size={13} className="text-[#79583A]" />
            <span>Math QA</span>
          </button>
        </nav>

        {/* Right Section: Network Status, Role Switcher, & Auth User Menu */}
        <div className="flex items-center gap-2">
          {/* Network Sync Pill */}
          <div
            className={`hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
              isOnline
                ? 'bg-[#2F7657]/10 text-[#2F7657] border-[#2F7657]/20'
                : 'bg-[#9A6B25]/15 text-[#9A6B25] border-[#9A6B25]/30'
            }`}
          >
            {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
            <span>{isOnline ? 'Online' : 'Offline'}</span>
            {offlineDraftsCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-[#9A6B25] text-white text-[10px]">
                {offlineDraftsCount} drafts
              </span>
            )}
          </div>

          {/* Role Switcher Toggle */}
          <div className="flex items-center p-0.5 rounded-xl border border-[#DCD0BD] bg-[#EEE4D2]/50 text-xs font-semibold">
            <button
              onClick={() => onRoleChange('citizen')}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg transition ${
                currentRole === 'citizen'
                  ? 'bg-[#FFFDF8] text-[#302A23] shadow-xs'
                  : 'text-[#746A5C] hover:text-[#302A23]'
              }`}
              title="Citizen View"
            >
              <User size={13} />
              <span className="hidden sm:inline">Citizen</span>
            </button>
            <button
              onClick={() => onRoleChange('official')}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg transition ${
                currentRole === 'official'
                  ? 'bg-[#2F7657] text-white shadow-xs'
                  : 'text-[#746A5C] hover:text-[#302A23]'
              }`}
              title="Authority & Inspector View"
            >
              <Shield size={13} />
              <span className="hidden sm:inline">Authority</span>
            </button>
          </div>

          {/* Authentication System Section */}
          {isAuthenticated && currentUser ? (
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-2 p-1 pl-2 rounded-xl border border-[#DCD0BD] bg-[#FFFDF8] hover:bg-[#EEE4D2]/40 transition text-xs font-semibold shadow-2xs"
              >
                <div className="flex flex-col text-right hidden sm:block">
                  <span className="text-[#302A23] text-xs font-bold leading-tight truncate max-w-[110px]">
                    {currentUser.name}
                  </span>
                  <span className="text-[10px] text-[#746A5C] leading-none uppercase">
                    {currentUser.role === 'official' ? (currentUser.department ? 'PWD Authority' : 'Authority') : 'Citizen'}
                  </span>
                </div>
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center font-extrabold text-white text-xs ${
                    currentUser.role === 'official' ? 'bg-[#2F7657]' : 'bg-[#79583A]'
                  }`}
                >
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <ChevronDown size={12} className="text-[#746A5C]" />
              </button>

              {/* Profile Dropdown Menu */}
              {isProfileMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-64 rounded-2xl bg-white border border-[#DCD0BD] shadow-xl p-3 z-50 animate-fade-in text-xs space-y-2.5">
                  <div className="border-b border-[#DCD0BD]/60 pb-2.5">
                    <div className="font-extrabold text-sm text-[#302A23]">{currentUser.name}</div>
                    <div className="text-[11px] text-[#746A5C] truncate">{currentUser.email}</div>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          currentUser.role === 'official'
                            ? 'bg-[#2F7657]/15 text-[#2F7657] border border-[#2F7657]/30'
                            : 'bg-[#79583A]/15 text-[#79583A] border border-[#79583A]/30'
                        }`}
                      >
                        {currentUser.role === 'official' ? 'Civil Authority' : 'Verified Citizen'}
                      </span>
                    </div>
                  </div>

                  {/* Authority-specific metadata */}
                  {currentUser.role === 'official' && (
                    <div className="p-2 rounded-xl bg-[#EEE4D2]/40 border border-[#DCD0BD] text-[11px] text-[#4B4136] space-y-1">
                      {currentUser.department && (
                        <div className="flex items-center gap-1">
                          <Building size={11} className="text-[#746A5C]" />
                          <span className="truncate">{currentUser.department}</span>
                        </div>
                      )}
                      {currentUser.badgeNumber && (
                        <div className="flex items-center gap-1">
                          <BadgeCheck size={11} className="text-[#2F7657]" />
                          <span>Badge ID: <strong>{currentUser.badgeNumber}</strong></span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="space-y-1 pt-1">
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        openAuthModal('login', currentUser.role === 'citizen' ? 'official' : 'citizen');
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#302A23] hover:bg-[#EEE4D2] transition flex items-center gap-2"
                    >
                      <Shield size={13} className="text-[#79583A]" />
                      <span>Switch to {currentUser.role === 'citizen' ? 'Authority Portal' : 'Citizen Portal'}</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        logout();
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#B44343] hover:bg-[#B44343]/10 transition flex items-center gap-2"
                    >
                      <LogOut size={13} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => openAuthModal('login', currentRole)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#DCD0BD] bg-white text-xs font-bold text-[#302A23] hover:bg-[#EEE4D2] transition shadow-2xs"
              >
                <LogIn size={13} />
                <span>Sign In</span>
              </button>
              <button
                onClick={() => openAuthModal('register', currentRole)}
                className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#79583A] text-white text-xs font-bold hover:bg-[#61442B] transition shadow-2xs"
              >
                <UserPlus size={13} />
                <span>Register</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Submenu */}
      <div className="flex lg:hidden items-center justify-around border-t border-[#DCD0BD] py-2 px-3 bg-[#EEE4D2]/30 text-xs font-semibold text-[#302A23]">
        {currentRole === 'citizen' ? (
          <>
            <button
              onClick={() => onNavigate('report')}
              className={`flex items-center gap-1 px-2 py-1 rounded ${activeView === 'report' ? 'text-[#79583A] font-bold' : ''}`}
            >
              <PlusCircle size={13} /> Report
            </button>
            <button
              onClick={() => onNavigate('citizen_cases')}
              className={`flex items-center gap-1 px-2 py-1 rounded ${activeView === 'citizen_cases' ? 'text-[#79583A] font-bold' : ''}`}
            >
              <List size={13} /> Complaints
            </button>
          </>
        ) : (
          <button
            onClick={() => onNavigate('admin_dashboard')}
            className={`flex items-center gap-1 px-2 py-1 rounded ${activeView === 'admin_dashboard' ? 'text-[#79583A] font-bold' : ''}`}
          >
            <LayoutDashboard size={13} /> Operations
          </button>
        )}
        <button
          onClick={() => onNavigate('map')}
          className={`flex items-center gap-1 px-2 py-1 rounded ${activeView === 'map' ? 'text-[#4285F4] font-bold' : ''}`}
        >
          <MapPin size={13} className="text-[#EA4335]" /> Google Map
        </button>
        <button
          onClick={onOpenGovtPortal}
          className="flex items-center gap-1 text-[#2F7657] font-semibold"
        >
          <Landmark size={13} /> Govt
        </button>
        <button
          onClick={() => openAuthModal('login', currentRole)}
          className="flex items-center gap-1 text-[#79583A]"
        >
          <User size={13} /> {isAuthenticated ? 'Profile' : 'Login'}
        </button>
      </div>
    </header>
  );
};
