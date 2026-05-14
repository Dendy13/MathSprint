import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { register } from '../api/auth.js';
import './LoginPage.css';

export default function LoginPage() {
  const { login } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ display_name: '', email: '', password: '', account_type: 'user', teacher_token: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'register') {
        const data = { display_name: form.display_name, email: form.email, password: form.password, account_type: form.account_type };
        if (form.account_type === 'teacher') data.teacher_token = form.teacher_token;
        const profile = await register(data);
        login(profile);
      } else {
        // Mock login — in production use Firebase Auth SDK
        login({
          uid: 'mock-' + Date.now(),
          display_name: form.email.split('@')[0] || 'Player',
          email: form.email,
          account_type: 'user',
          current_rank_point: 1200,
          total_matches: 0, wins: 0, losses: 0,
          learning_streak_days: 0, friends_list: [],
        });
      }
    } catch (err) {
      setError(err.message);
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
              <input className="input" placeholder="Nama kamu" value={form.display_name} onChange={e => set('display_name', e.target.value)} required minLength={2} maxLength={30} id="input-name" />
            </div>
          )}
          <div className="input-group">
            <label className="input-label">Email</label>
            <input className="input" type="email" placeholder="email@contoh.com" value={form.email} onChange={e => set('email', e.target.value)} required id="input-email" />
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
