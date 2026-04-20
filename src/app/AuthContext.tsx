import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  lastLogin: Date;
}

interface AuthContextType {
  user: AuthUser | null;
  pendingOtp: string | null;
  pendingEmail: string | null;
  login: (email: string, password: string) => { success: boolean; error?: string };
  verifyOtp: (otp: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Hardcoded accounts — add new ones here
const ACCOUNTS: { email: string; password: string; name: string; role: string; id: string }[] = [
  { id: 'u1', email: 'admin@agromuda.com', password: 'Admin2026', name: 'Administrator', role: 'Admin' },
  { id: 'u2', email: 'operator@agromuda.com', password: 'Ops2026', name: 'Operator', role: 'Operator' },
  { id: 'u3', email: 'manager@agromuda.com', password: 'Mgr2026', name: 'Manager', role: 'Manager' },
];

function generateOtp(): string {
  return String(Math.floor(10000000 + Math.random() * 90000000));
}

function loadUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem('ama_user');
    if (!raw) return null;
    const u = JSON.parse(raw);
    return { ...u, lastLogin: new Date(u.lastLogin) };
  } catch { return null; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(loadUser);
  const [pendingOtp, setPendingOtp] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  const login = useCallback((email: string, password: string): { success: boolean; error?: string } => {
    const account = ACCOUNTS.find(a => a.email.toLowerCase() === email.toLowerCase() && a.password === password);
    if (!account) return { success: false, error: 'Email atau password salah.' };
    const otp = generateOtp();
    setPendingOtp(otp);
    setPendingEmail(email);
    // In production: send email here
    console.log(`[DEV] OTP for ${email}: ${otp}`);
    return { success: true };
  }, []);

  const verifyOtp = useCallback((otp: string): boolean => {
    if (!pendingOtp || !pendingEmail) return false;
    if (otp !== pendingOtp) return false;
    const account = ACCOUNTS.find(a => a.email.toLowerCase() === pendingEmail.toLowerCase());
    if (!account) return false;
    const authUser: AuthUser = {
      id: account.id,
      email: account.email,
      name: account.name,
      role: account.role,
      lastLogin: new Date(),
    };
    setUser(authUser);
    localStorage.setItem('ama_user', JSON.stringify(authUser));
    setPendingOtp(null);
    setPendingEmail(null);
    return true;
  }, [pendingOtp, pendingEmail]);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('ama_user');
    setPendingOtp(null);
    setPendingEmail(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, pendingOtp, pendingEmail, login, verifyOtp, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
