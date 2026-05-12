import { createContext, useContext, useState, type ReactNode } from 'react';
import { useConvexAuth, useQuery } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { api } from '../../convex/_generated/api';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  lastLogin: Date;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isLoggingOut: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const convexUser = useQuery(api.users.me, isAuthenticated ? {} : 'skip') as any;

  // Still loading if auth token is resolving OR user doc hasn't arrived yet
  const isLoading = authLoading || (isAuthenticated && convexUser === undefined);

  const user: AuthUser | null = convexUser
    ? {
        id: convexUser._id as string,
        email: convexUser.email ?? '',
        name: convexUser.name ?? 'Nicholas',
        role: 'Admin',
        lastLogin: new Date(localStorage.getItem('ama_last_login') ?? Date.now()),
      }
    : null;

  const logout = () => {
    setIsLoggingOut(true);
    localStorage.removeItem('ama_last_login');
    void signOut();
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, isLoggingOut, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
