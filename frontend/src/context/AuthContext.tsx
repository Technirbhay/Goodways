import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppUser, UserRole } from '../types';
import { apiUrl } from '../api';

interface AuthContextType {
  currentUser: AppUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (
    email: string,
    password: string,
    role?: UserRole,
    adminInviteCode?: string
  ) => Promise<{ success: boolean; error?: string; pendingApproval?: boolean; message?: string }>;
  register: (userData: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    phone?: string;
    department?: string;
    badgeNumber?: string;
    designation?: string;
    adminInviteCode?: string;
  }) => Promise<{ success: boolean; error?: string; pendingApproval?: boolean; message?: string }>;
  logout: () => void;
  quickDemoLogin: (email: string, role: UserRole) => Promise<boolean>;
  isAuthModalOpen: boolean;
  authModalTab: 'login' | 'register';
  authModalRole: UserRole;
  openAuthModal: (tab?: 'login' | 'register', role?: UserRole) => void;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_USER_KEY = 'goodways_auth_user';
const AUTH_TOKEN_KEY = 'goodways_auth_token';
const AUTH_VERSION_KEY = 'goodways_auth_version';
const AUTH_VERSION = '2026-10-render-jwt-v2';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modal control
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'register'>('login');
  const [authModalRole, setAuthModalRole] = useState<UserRole>('citizen');

  // Load saved session on mount
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem(AUTH_USER_KEY);
      const savedToken = localStorage.getItem(AUTH_TOKEN_KEY);
      const savedAuthVersion = localStorage.getItem(AUTH_VERSION_KEY);
      if (savedUser && savedToken && savedAuthVersion === AUTH_VERSION) {
        setCurrentUser(JSON.parse(savedUser));
        setToken(savedToken);
      } else {
        // Tokens from before the Render deployment are signed with a different
        // secret. Remove that stale session before the first protected request.
        localStorage.removeItem(AUTH_USER_KEY);
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.setItem(AUTH_VERSION_KEY, AUTH_VERSION);
        // Default to Demo Citizen for an immediate seamless first experience
        const defaultCitizen: AppUser = {
          id: 'user-citizen-1',
          name: 'Rahul Sharma',
          email: 'citizen@goodways.org',
          role: 'citizen',
          phone: '+91 98765 43210',
          designation: 'Active Citizen Reporter',
          approvalStatus: 'approved',
          createdAt: new Date().toISOString()
        };
        setCurrentUser(defaultCitizen);
        setToken('tok-default-demo');
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(defaultCitizen));
        localStorage.setItem(AUTH_TOKEN_KEY, 'tok-default-demo');
      }
    } catch (e) {
      console.warn('Could not restore auth session:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string, role?: UserRole, adminInviteCode?: string) => {
    try {
      const res = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role, adminInviteCode }),
      });

      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          error: data.error || 'Login failed',
          pendingApproval: data.pendingApproval
        };
      }

      setCurrentUser(data.user);
      setToken(data.token);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
      localStorage.setItem(AUTH_TOKEN_KEY, data.token);
      localStorage.setItem(AUTH_VERSION_KEY, AUTH_VERSION);
      setIsAuthModalOpen(false);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network connection failed' };
    }
  };

  const register = async (userData: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    phone?: string;
    department?: string;
    badgeNumber?: string;
    designation?: string;
    adminInviteCode?: string;
  }) => {
    try {
      const res = await fetch(apiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Registration failed' };
      }

      if (data.pendingApproval) {
        return {
          success: false,
          pendingApproval: true,
          message: data.message || 'Authority registration submitted! Pending Super Admin authorization.'
        };
      }

      setCurrentUser(data.user);
      setToken(data.token);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
      localStorage.setItem(AUTH_TOKEN_KEY, data.token);
      localStorage.setItem(AUTH_VERSION_KEY, AUTH_VERSION);
      setIsAuthModalOpen(false);
      return { success: true, message: data.message };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network connection failed' };
    }
  };

  const logout = () => {
    setCurrentUser(null);
    setToken(null);
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_VERSION_KEY);
  };

  const quickDemoLogin = async (email: string, role: UserRole): Promise<boolean> => {
    const password = email.includes('citizen') ? 'citizen123' : 'authority123';
    const res = await login(email, password, role);
    return res.success;
  };

  const openAuthModal = (tab: 'login' | 'register' = 'login', role: UserRole = 'citizen') => {
    setAuthModalTab(tab);
    setAuthModalRole(role);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        token,
        isAuthenticated: !!currentUser,
        isLoading,
        login,
        register,
        logout,
        quickDemoLogin,
        isAuthModalOpen,
        authModalTab,
        authModalRole,
        openAuthModal,
        closeAuthModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
