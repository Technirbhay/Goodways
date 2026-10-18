import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole, Department } from '../types';
import {
  User,
  Shield,
  Building,
  Lock,
  Mail,
  Phone,
  BadgeCheck,
  X,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Landmark,
} from 'lucide-react';

interface AuthModalProps {
  departments: Department[];
  authorityPortalEnabled: boolean;
  onRoleChanged?: (role: UserRole) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ departments, authorityPortalEnabled, onRoleChanged }) => {
  const {
    currentUser,
    isAuthModalOpen,
    authModalTab,
    authModalRole,
    closeAuthModal,
    login,
    register,
    quickDemoLogin,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>(authModalTab);
  const [selectedRole, setSelectedRole] = useState<UserRole>(authModalRole);

  // Form inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [badgeNumber, setBadgeNumber] = useState('');
  const [designation, setDesignation] = useState('');
  const [adminInviteCode, setAdminInviteCode] = useState('');
  const [showPasskeyInput, setShowPasskeyInput] = useState(false);

  // Status
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [pendingApprovalNotice, setPendingApprovalNotice] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(authModalTab);
    setSelectedRole(authorityPortalEnabled ? authModalRole : 'citizen');
    setError(null);
    setSuccessMsg(null);
    setPendingApprovalNotice(null);
    if (departments.length > 0 && !department) {
      setDepartment(departments[0].name);
    }
  }, [isAuthModalOpen, authModalTab, authModalRole, departments, authorityPortalEnabled]);

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setPendingApprovalNotice(null);
    setIsSubmitting(true);

    try {
      if (activeTab === 'login') {
        const res = await login(email, password, selectedRole, adminInviteCode);
        if (!res.success) {
          if (res.pendingApproval) {
            setPendingApprovalNotice(res.error || 'Authority account pending admin approval.');
            setShowPasskeyInput(true);
          } else {
            setError(res.error || 'Login failed. Please check credentials.');
          }
        } else {
          setSuccessMsg('Signed in successfully!');
          if (onRoleChanged) onRoleChanged(selectedRole);
          setTimeout(() => closeAuthModal(), 500);
        }
      } else {
        // Register
        if (!name.trim()) {
          setError('Full name is required');
          setIsSubmitting(false);
          return;
        }

        const res = await register({
          name,
          email,
          password,
          role: selectedRole,
          phone,
          department: selectedRole === 'official' ? department : undefined,
          badgeNumber: selectedRole === 'official' ? badgeNumber : undefined,
          designation: selectedRole === 'official' ? designation : 'Citizen Contributor',
          adminInviteCode: selectedRole === 'official' ? adminInviteCode : undefined,
        });

        if (!res.success) {
          if (res.pendingApproval) {
            setPendingApprovalNotice(
              res.message ||
                'Authority registration submitted! Access to the Authority Command Center requires approval by the Chief Administrator. You may enter the Admin Passkey (NHAI-SUPER-ADMIN-2025) to activate immediately.'
            );
            setShowPasskeyInput(true);
          } else {
            setError(res.error || 'Registration failed');
          }
        } else {
          setSuccessMsg(res.message || 'Account created successfully!');
          if (onRoleChanged) onRoleChanged(selectedRole);
          setTimeout(() => closeAuthModal(), 800);
        }
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoClick = async (demoEmail: string, role: UserRole) => {
    setIsSubmitting(true);
    setError(null);
    setSelectedRole(role);
    try {
      const ok = await quickDemoLogin(demoEmail, role);
      if (ok) {
        setSuccessMsg(`Signed in as ${role === 'citizen' ? 'Citizen' : 'Civil Authority'}`);
        if (onRoleChanged) onRoleChanged(role);
        setTimeout(() => closeAuthModal(), 400);
      } else {
        setError('Demo login failed');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-sans">
      <div className="relative w-full max-w-md bg-[#FFFDF8] rounded-3xl border border-[#DCD0BD] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Bar */}
        <div className="px-6 pt-6 pb-4 border-b border-[#DCD0BD] bg-[#EEE4D2]/40 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#79583A] text-white flex items-center justify-center shadow-xs">
              {selectedRole === 'citizen' ? <User size={20} /> : <Shield size={20} />}
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[#302A23] leading-tight">
                {activeTab === 'login' ? 'Sign In to GoodWays' : 'Create GoodWays Account'}
              </h2>
              <p className="text-xs text-[#746A5C] mt-0.5">
                {selectedRole === 'citizen'
                  ? 'Citizen Damage Reporting & SLA Resolution Tracking'
                  : 'Civil Authority & Municipal Engineering Operations'}
              </p>
            </div>
          </div>
          <button
            onClick={closeAuthModal}
            className="p-1.5 rounded-full text-[#746A5C] hover:text-[#302A23] hover:bg-[#EEE4D2] transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Role Toggle Selector */}
        <div className="px-6 pt-4 pb-2">
          <div className="flex p-1 rounded-2xl bg-[#EEE4D2]/60 border border-[#DCD0BD] text-xs font-bold">
            <button
              type="button"
              onClick={() => setSelectedRole('citizen')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl transition ${
                selectedRole === 'citizen'
                  ? 'bg-white text-[#302A23] shadow-xs'
                  : 'text-[#746A5C] hover:text-[#302A23]'
              }`}
            >
              <User size={14} className={selectedRole === 'citizen' ? 'text-[#79583A]' : ''} />
              <span>Citizen Portal</span>
            </button>
            {authorityPortalEnabled && <button
              type="button"
              onClick={() => setSelectedRole('official')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl transition ${
                selectedRole === 'official'
                  ? 'bg-white text-[#302A23] shadow-xs'
                  : 'text-[#746A5C] hover:text-[#302A23]'
              }`}
            >
              <Shield size={14} className={selectedRole === 'official' ? 'text-[#2F7657]' : ''} />
              <span>Civil Authority (PWD / NHAI)</span>
            </button>}
          </div>
        </div>

        {/* Tab Selector: Login vs Register */}
        <div className="flex border-b border-[#DCD0BD] px-6 text-xs font-bold">
          <button
            onClick={() => {
              setActiveTab('login');
              setError(null);
            }}
            className={`py-2.5 border-b-2 mr-6 transition ${
              activeTab === 'login'
                ? 'border-[#79583A] text-[#79583A]'
                : 'border-transparent text-[#746A5C] hover:text-[#302A23]'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => {
              setActiveTab('register');
              setError(null);
            }}
            className={`py-2.5 border-b-2 transition ${
              activeTab === 'register'
                ? 'border-[#79583A] text-[#79583A]'
                : 'border-transparent text-[#746A5C] hover:text-[#302A23]'
            }`}
          >
            Register New Account
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-[#B44343]/10 border border-[#B44343]/30 text-xs text-[#B44343] flex items-start gap-2">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-[#2F7657]/10 border border-[#2F7657]/30 text-xs text-[#2F7657] flex items-center gap-2">
              <CheckCircle2 size={15} className="shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {pendingApprovalNotice && (
            <div className="p-3.5 rounded-xl bg-[#9A6B25]/10 border border-[#9A6B25]/40 text-xs text-[#79583A] space-y-2">
              <div className="flex items-start gap-2">
                <Shield size={16} className="text-[#9A6B25] shrink-0 mt-0.5" />
                <span className="font-semibold">{pendingApprovalNotice}</span>
              </div>
              <div className="pt-1 border-t border-[#9A6B25]/20">
                <span className="text-[11px] font-bold block mb-1 text-[#302A23]">Enter Master Admin Key to Unlock:</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. NHAI-SUPER-ADMIN-2025"
                    value={adminInviteCode}
                    onChange={(e) => setAdminInviteCode(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-[#DCD0BD] bg-white text-xs font-mono text-[#302A23]"
                  />
                  <button
                    type="button"
                    onClick={() => setAdminInviteCode('')}
                    className="px-2.5 py-1 rounded-lg bg-[#2F7657] text-white text-[11px] font-bold hover:bg-[#255f46]"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {activeTab === 'register' && (
              <div>
                <label className="block text-xs font-bold text-[#302A23] mb-1">
                  {selectedRole === 'citizen' ? 'Full Name' : 'Officer / Engineer Full Name'}
                </label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#746A5C]" />
                  <input
                    type="text"
                    required
                    placeholder={selectedRole === 'citizen' ? 'e.g. Rahul Sharma' : 'e.g. Er. Vikram Malhotra'}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#DCD0BD] bg-white text-xs text-[#302A23] focus:outline-[#79583A]"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[#302A23] mb-1">
                {selectedRole === 'citizen' ? 'Email Address' : 'Official Government Email'}
              </label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#746A5C]" />
                <input
                  type="email"
                  required
                  placeholder={selectedRole === 'citizen' ? 'you@example.com' : 'officer@pwd.gov.in'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#DCD0BD] bg-white text-xs text-[#302A23] focus:outline-[#79583A]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#302A23] mb-1">Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#746A5C]" />
                <input
                  type="password"
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#DCD0BD] bg-white text-xs text-[#302A23] focus:outline-[#79583A]"
                />
              </div>
            </div>

            {/* In Login mode for Authority: option to enter passkey if needed */}
            {activeTab === 'login' && selectedRole === 'official' && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowPasskeyInput(!showPasskeyInput)}
                  className="text-[11px] text-[#2F7657] font-semibold flex items-center gap-1 hover:underline"
                >
                  <Shield size={12} />
                  <span>{showPasskeyInput ? 'Hide Admin Passkey' : 'Have an Admin Passkey to verify?'}</span>
                </button>
                {showPasskeyInput && (
                  <div className="mt-1.5 relative">
                    <input
                      type="text"
                      placeholder="e.g. NHAI-SUPER-ADMIN-2025"
                      value={adminInviteCode}
                      onChange={(e) => setAdminInviteCode(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border border-[#DCD0BD] bg-white text-xs font-mono text-[#302A23]"
                    />
                  </div>
                )}
              </div>
            )}

            {activeTab === 'register' && (
              <div>
                <label className="block text-xs font-bold text-[#302A23] mb-1">Phone Number (Optional)</label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#746A5C]" />
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#DCD0BD] bg-white text-xs text-[#302A23] focus:outline-[#79583A]"
                  />
                </div>
              </div>
            )}

            {/* Authority-specific registration fields */}
            {activeTab === 'register' && selectedRole === 'official' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-[#302A23] mb-1">Assigned Department</label>
                  <div className="relative">
                    <Building size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#746A5C]" />
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#DCD0BD] bg-white text-xs text-[#302A23] focus:outline-[#79583A]"
                    >
                      {departments.map((d) => (
                        <option key={d.id} value={d.name}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#302A23] mb-1">Badge ID</label>
                    <div className="relative">
                      <BadgeCheck size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#746A5C]" />
                      <input
                        type="text"
                        placeholder="e.g. PWD-749"
                        value={badgeNumber}
                        onChange={(e) => setBadgeNumber(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#DCD0BD] bg-white text-xs text-[#302A23] focus:outline-[#79583A]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#302A23] mb-1">Designation</label>
                    <input
                      type="text"
                      placeholder="e.g. Senior Engineer"
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#DCD0BD] bg-white text-xs text-[#302A23] focus:outline-[#79583A]"
                    />
                  </div>
                </div>

                {/* Authority Admin Passkey Security Requirement */}
                <div className="p-3 rounded-xl bg-[#2F7657]/5 border border-[#2F7657]/30 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#2F7657] flex items-center gap-1.5">
                      <Shield size={13} />
                      <span>Admin Passkey / Invite Code</span>
                    </label>
                    <span className="text-[10px] text-[#746A5C] font-semibold">Optional</span>
                  </div>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#746A5C]" />
                    <input
                      type="text"
                      placeholder="e.g. NHAI-SUPER-ADMIN-2025"
                      value={adminInviteCode}
                      onChange={(e) => setAdminInviteCode(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#DCD0BD] bg-white text-xs font-mono text-[#302A23] focus:outline-[#2F7657]"
                    />
                  </div>
                  <p className="text-[10.5px] text-[#746A5C] leading-snug">
                    To maintain road data integrity, only personnel permitted by the Admin can register. Without a passkey, your account will await Super Admin approval.
                  </p>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-2.5 rounded-xl text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-sm ${
                selectedRole === 'official'
                  ? 'bg-[#2F7657] hover:bg-[#255f46]'
                  : 'bg-[#79583A] hover:bg-[#61442B]'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>
                    {activeTab === 'login'
                      ? `Sign In as ${selectedRole === 'citizen' ? 'Citizen' : 'Authority'}`
                      : `Register as ${selectedRole === 'citizen' ? 'Citizen' : 'Civil Authority'}`}
                  </span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Accounts Helper */}
          <div className="pt-3 border-t border-[#DCD0BD]/60 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-[#746A5C]">
              <span className="flex items-center gap-1">
                <Sparkles size={11} className="text-[#9A6B25]" />
                <span>Instant 1-Click Evaluation Accounts</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleDemoClick('citizen@goodways.org', 'citizen')}
                className="p-2.5 rounded-xl border border-[#DCD0BD] bg-[#EEE4D2]/40 hover:bg-[#EEE4D2] text-left transition"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#302A23]">Rahul Sharma</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#79583A]/15 text-[#79583A]">Citizen</span>
                </div>
                <div className="text-[10px] text-[#746A5C] truncate">citizen@goodways.org</div>
              </button>

              {authorityPortalEnabled && <button
                type="button"
                onClick={() => handleDemoClick('inspector@pwd.gov.in', 'official')}
                className="p-2.5 rounded-xl border border-[#2F7657]/30 bg-[#2F7657]/10 hover:bg-[#2F7657]/20 text-left transition"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#2F7657]">Er. Vikram</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#2F7657] text-white">PWD Authority</span>
                </div>
                <div className="text-[10px] text-[#746A5C] truncate">inspector@pwd.gov.in</div>
              </button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
