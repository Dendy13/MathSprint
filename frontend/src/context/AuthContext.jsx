import { createContext, useContext, useState, useEffect } from 'react';
import { setAuthToken, clearAuthToken } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('mathsprint_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setUser(parsed);
        setAuthToken(parsed.token || 'mock-token');
      } catch { /* ignore */ }
    }
    setLoading(false);
  }, []);

  const login = (userData, token = 'mock-token') => {
    const u = { ...userData, token };
    setUser(u);
    setAuthToken(token);
    localStorage.setItem('mathsprint_user', JSON.stringify(u));
  };

  const logout = () => {
    setUser(null);
    clearAuthToken();
    localStorage.removeItem('mathsprint_user');
  };

  const updateUser = (data) => {
    const updated = { ...user, ...data };
    setUser(updated);
    localStorage.setItem('mathsprint_user', JSON.stringify(updated));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export default AuthContext;
