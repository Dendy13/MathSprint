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
  const [form, setForm] = useState({ username: '', email: '', display_name: '', password: '', account_type: 'user', teacher_token: '' });
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotInput, setForgotInput] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    // Konversi Username menjadi format Email (Firebase hanya menerima Email)
    let loginEmail = '';
    
    if (mode === 'login') {
      const input = form.username.trim();
      if (input.includes('@')) {
        loginEmail = input; // Input is an actual email
      } else {
        const formattedUsername = input.toLowerCase().replace(/\s+/g, '');
        loginEmail = `${formattedUsername}@mathsprint.local`; // Input is a username
      }
    } else {
      // Register mode
      if (form.account_type === 'teacher') {
        loginEmail = form.email.trim();
      } else {
        const formattedUsername = form.username.trim().toLowerCase().replace(/\s+/g, '');
        loginEmail = `${formattedUsername}@mathsprint.local`;
      }
    }
    
    try {
      if (mode === 'register') {
        const displayName = form.account_type === 'teacher' ? form.display_name : form.username;
        const data = { display_name: displayName, email: loginEmail, password: form.password, account_type: form.account_type };
        if (form.account_type === 'teacher') data.teacher_token = form.teacher_token;
        // Register in backend (which creates Firebase user)
        await register(data);
      }
      
      // Sign in with Firebase (for both login and after register)
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, form.password);
      
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
      } else if (err.code === 'auth/invalid-email') {
        setError('Format email tidak valid.');
      } else {
        setError(err.message || 'Gagal masuk. Periksa kembali data kamu.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');
    const input = forgotInput.trim();
    if (!input) return;

    if (input.includes('@')) {
      try {
        setLoading(true);
        const { sendPasswordResetEmail } = await import('firebase/auth');
        await sendPasswordResetEmail(auth, input);
        setMsg('Tautan reset kata sandi telah dikirim ke email Anda. Silakan periksa kotak masuk (atau folder spam).');
        setForgotInput('');
      } catch (err) {
        if (err.code === 'auth/user-not-found') setError('Email tidak terdaftar.');
        else setError(err.message);
      } finally {
        setLoading(false);
      }
    } else {
      setError('Pemain tidak bisa mereset sandi sendiri. Silakan minta Guru atau Admin untuk mereset sandi akun kamu di Dasbor.');
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
        {showForgot ? (
          <form onSubmit={handleForgotPassword} className="login-form animate-fade-in">
            <h3 style={{ marginBottom: 8, textAlign: 'center' }}>Lupa Sandi?</h3>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: 16, textAlign: 'center' }}>
              Masukkan Email (Guru) atau Username (Pemain) kamu.
            </p>
            <div className="input-group">
              <input className="input" type="text" placeholder="Email / Username" value={forgotInput} onChange={e => setForgotInput(e.target.value)} required />
            </div>
            {error && <div className="error-banner">{error}</div>}
            {msg && <div className="toast animate-fade-in" style={{ backgroundColor: 'var(--green)', color: '#fff', marginBottom: 16 }}>{msg}</div>}
            
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} type="submit" disabled={loading}>
                {loading ? <span className="spinner" /> : 'Kirim'}
              </button>
              <button className="btn btn-ghost" style={{ flex: 1 }} type="button" onClick={() => {setShowForgot(false); setError(''); setMsg('');}}>Batal</button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="login-form animate-fade-in">
            {mode === 'register' && form.account_type === 'teacher' ? (
              <>
                <div className="input-group">
                  <label className="input-label">Email Asli</label>
                  <input className="input" type="email" placeholder="contoh@sekolah.com" value={form.email} onChange={e => set('email', e.target.value)} required id="input-email" />
                </div>
                <div className="input-group">
                  <label className="input-label">Nama Tampilan</label>
                  <input className="input" type="text" placeholder="Contoh: Pak Budi" value={form.display_name} onChange={e => set('display_name', e.target.value)} required id="input-displayname" />
                </div>
              </>
            ) : (
              <div className="input-group">
                <label className="input-label">{mode === 'login' ? 'Username / Email' : 'Username'}</label>
                <input className="input" type="text" placeholder={`Masukkan ${mode === 'login' ? 'username atau email' : 'username'}`} value={form.username} onChange={e => set('username', e.target.value)} required minLength={3} id="input-username" />
              </div>
            )}
            
            <div className="input-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="input-label" style={{ marginBottom: 0 }}>Password</label>
                {mode === 'login' && (
                  <button type="button" className="btn-link" onClick={() => {setShowForgot(true); setError('');}} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.8rem', cursor: 'pointer', padding: 0 }}>Lupa Sandi?</button>
                )}
              </div>
              <input className="input" type="password" placeholder="Minimal 8 karakter" value={form.password} onChange={e => set('password', e.target.value)} required minLength={8} id="input-password" style={{ marginTop: 4 }}/>
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
        )}
      </div>
    </div>
  );
}
