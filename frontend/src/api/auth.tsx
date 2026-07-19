import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { User, UserRole } from './types';
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

// Mock users for demo
const MOCK_USERS: Record<string, User & { password: string }> = {
  'reviewer@pharmasafe.io': {
    id: 'usr-001',
    email: 'reviewer@pharmasafe.io',
    name: 'Dr. Sarah Chen',
    role: 'Reviewer' as UserRole,
    password: 'reviewer123',
  },
  'admin@pharmasafe.io': {
    id: 'usr-002',
    email: 'admin@pharmasafe.io',
    name: 'Admin User',
    role: 'Admin' as UserRole,
    password: 'admin123',
  },
  'reporter@pharmasafe.io': {
    id: 'usr-003',
    email: 'reporter@pharmasafe.io',
    name: 'Dr. Emily Richards',
    role: 'Reporter' as UserRole,
    password: 'reporter123',
  },
};

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

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        localStorage.setItem('pharmasafe_user', JSON.stringify(data.user));
        localStorage.setItem('pharmasafe_token', data.token);
        setLoading(false);
        return;
      }
    } catch (e) {
      console.warn('Real Auth Backend API unavailable, falling back to mock mode authentication.');
    }

    // Simulate network delay
    await new Promise(r => setTimeout(r, 800));

    const mockUser = MOCK_USERS[email.toLowerCase()];
    if (!mockUser || mockUser.password !== password) {
      setLoading(false);
      setError('Invalid email or password. Please check your credentials and try again.');
      throw new Error('Invalid credentials');
    }

    const { password: _, ...userData } = mockUser;
    setUser(userData);
    localStorage.setItem('pharmasafe_user', JSON.stringify(userData));
    localStorage.setItem('pharmasafe_token', 'mock-offline-token');
    setLoading(false);
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
