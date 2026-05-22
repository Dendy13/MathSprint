import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../config/firebase.js';
import { register, getProfile } from '../api/auth.js';
import { setAuthToken } from '../api/client.js';
import './LoginPage.css';

export default function LoginPage() {
  const { login } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ display_name: '', username: '', password: '', account_type: 'user', teacher_token: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    // Konversi Username menjadi format Email (Firebase hanya menerima Email)
    const formattedUsername = form.username.trim().toLowerCase().replace(/\s+/g, '');
    const fakeEmail = `${formattedUsername}@mathsprint.local`;
    
    try {
      if (mode === 'register') {
        const data = { display_name: form.display_name, email: fakeEmail, password: form.password, account_type: form.account_type };
        if (form.account_type === 'teacher') data.teacher_token = form.teacher_token;
        // Register in backend (which creates Firebase user)
        await register(data);
      }
      
      // Sign in with Firebase (for both login and after register)
      const userCredential = await signInWithEmailAndPassword(auth, fakeEmail, form.password);
      
      // Get the real Firebase ID Token
      const token = await userCredential.user.getIdToken();
      
      // Set token in API client so getProfile can use it
      setAuthToken(token);
      
      // Fetch the full profile from backend
      const profile = await getProfile();
      
      // Update Context & LocalStorage
      login(profile, token);
      
    } catch (err) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Username atau password salah');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Username ini sudah dipakai pemain lain!');
      } else {
        setError(err.message || 'Gagal masuk. Periksa kembali data kamu.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-ambient" />
      <div className="login-card animate-slide-up">
        <div className="login-header">
          <h1 className="login-title">
            <span>Math</span><span className="text-accent">Sprint</span>
          </h1>
          <p className="text-muted" style={{ marginTop: 8 }}>Platform aritmatika kompetitif real-time</p>
        </div>
        <div className="login-tabs">
          <button className={`tab ${mode === 'login' ? 'active' : ''}`} onClick={() => setMode('login')}>Masuk</button>
          <button className={`tab ${mode === 'register' ? 'active' : ''}`} onClick={() => setMode('register')}>Daftar</button>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          {mode === 'register' && (
            <div className="input-group">
              <label className="input-label">Nama Tampilan</label>
              <input className="input" placeholder="Nama yang akan dilihat lawan" value={form.display_name} onChange={e => set('display_name', e.target.value)} required minLength={2} maxLength={30} id="input-name" />
            </div>
          )}
          <div className="input-group">
            <label className="input-label">Username</label>
            <input className="input" type="text" placeholder="Masukkan username" value={form.username} onChange={e => set('username', e.target.value)} required minLength={3} id="input-username" />
          </div>
          <div className="input-group">
            <label className="input-label">Password</label>
            <input className="input" type="password" placeholder="Minimal 8 karakter" value={form.password} onChange={e => set('password', e.target.value)} required minLength={8} id="input-password" />
          </div>
          {mode === 'register' && (
            <>
              <div className="input-group">
                <label className="input-label">Tipe Akun</label>
                <div className="account-type-grid">
                  {[{ v: 'user', l: '🎮 Pemain', d: 'Main dan bersaing' }, { v: 'teacher', l: '🏫 Guru', d: 'Kelola kelas & murid' }].map(t => (
                    <button key={t.v} type="button" className={`type-card ${form.account_type === t.v ? 'active' : ''}`} onClick={() => set('account_type', t.v)}>
                      <span className="type-label">{t.l}</span>
                      <span className="type-desc">{t.d}</span>
                    </button>
                  ))}
                </div>
              </div>
              {form.account_type === 'teacher' && (
                <div className="input-group animate-fade-in">
                  <label className="input-label">Token Guru</label>
                  <input className="input" placeholder="Masukkan token dari developer" value={form.teacher_token} onChange={e => set('teacher_token', e.target.value)} required id="input-token" />
                  <span className="text-muted" style={{ fontSize: '0.75rem' }}>Token didapat dari akun Developer</span>
                </div>
              )}
            </>
          )}
          {error && <div className="error-banner">{error}</div>}
          <button className="btn btn-primary btn-full btn-lg" type="submit" disabled={loading} id="btn-submit">
            {loading ? <span className="spinner" /> : mode === 'login' ? '🚀 MASUK' : '✨ DAFTAR'}
          </button>
        </form>
      </div>
    </div>
  );
}
