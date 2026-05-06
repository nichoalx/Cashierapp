import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  lastLogin: Date;
}

interface AuthContextType {
  user: AuthUser | null;
  pendingEmail: string | null;
  pendingOtp: string | null;
  requestOtp: (email: string) => { success: boolean; error?: string };
  verifyOtp: (code: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Single placeholder user — swap for Convex auth later
const PLACEHOLDER = {
  id: 'u1',
  email: 'admin@agromuda.com',
  name: 'Administrator',
  role: 'Admin',
};

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
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

  const requestOtp = useCallback((email: string): { success: boolean; error?: string } => {
    if (email.toLowerCase() !== PLACEHOLDER.email.toLowerCase()) {
      return { success: false, error: 'Email tidak terdaftar.' };
    }
    const otp = generateOtp();
    setPendingOtp(otp);
    setPendingEmail(email);
    console.log(`%c[OTP] ${otp}`, 'font-size:20px;font-weight:bold;color:#4a90d9;');
    return { success: true };
  }, []);

  const verifyOtp = useCallback((code: string): boolean => {
    if (!pendingOtp || !pendingEmail) return false;
    if (code !== pendingOtp) return false;
    const authUser: AuthUser = {
      id: PLACEHOLDER.id,
      email: PLACEHOLDER.email,
      name: PLACEHOLDER.name,
      role: PLACEHOLDER.role,
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
    <AuthContext.Provider value={{ user, pendingEmail, pendingOtp, requestOtp, verifyOtp, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
