import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { User } from './types';
import { API_BASE_URL } from '../config';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  error: string | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('pharmasafe_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Invalid email or password.');
      }

      const data = await response.json();
      const normalizedUser = {
        ...data.user,
        role: data.user.role === 'reporter' ? 'Reporter' :
              data.user.role === 'reviewer' ? 'Reviewer' :
              data.user.role === 'admin' ? 'Admin' :
              data.user.role
      };
      setUser(normalizedUser);
      localStorage.setItem('pharmasafe_user', JSON.stringify(normalizedUser));
      localStorage.setItem('pharmasafe_token', data.token);
      setLoading(false);
    } catch (e: any) {
      const message = e?.message || 'Unable to sign in with Supabase. Please try again.';
      setLoading(false);
      setError(message);
      throw e;
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('pharmasafe_user');
    localStorage.removeItem('pharmasafe_token');
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, error, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
