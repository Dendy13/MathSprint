import { createContext, useContext, useState, useEffect } from 'react';
import { setAuthToken, clearAuthToken } from '../api/client.js';
import { auth } from '../config/firebase.js';
import { onIdTokenChanged } from 'firebase/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Muat data profil dari localStorage agar UI langsung tampil cepat
    const saved = localStorage.getItem('mathsprint_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setUser(parsed);
        setAuthToken(parsed.token || 'mock-token');
      } catch { /* ignore */ }
    }

    // 2. Dengarkan perubahan Token Firebase secara otomatis (Auto Refresh Token)
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const freshToken = await firebaseUser.getIdToken();
          setAuthToken(freshToken);
          
          setUser(prev => {
            if (!prev) return null;
            const updated = { ...prev, token: freshToken };
            localStorage.setItem('mathsprint_user', JSON.stringify(updated));
            return updated;
          });
        } catch (err) {
          console.error("Gagal refresh token", err);
        }
      } else {
        // Jika sesi firebase benar-benar hilang (ter-logout)
        // Kita tidak otomatis hapus localStorage di sini agar tidak konflik dengan transisi manual
      }
      setLoading(false);
    });

    return () => unsubscribe();
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
