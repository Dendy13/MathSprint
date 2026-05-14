import { useState, useEffect } from 'react';
import { createToken, listTokens, revokeToken, getSystemStats } from '../api/admin.js';
import { useAuth } from '../context/AuthContext.jsx';
import './AdminPage.css';

export default function AdminPage() {
  const { user } = useAuth();
  const [tokens, setTokens] = useState({ tokens: [], total: 0, used_count: 0, available_count: 0 });
  const [stats, setStats] = useState(null);
  const [label, setLabel] = useState('');
  const [expiry, setExpiry] = useState(30);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [t, s] = await Promise.all([listTokens(), getSystemStats()]);
      setTokens(t);
      setStats(s);
    } catch { }
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      await createToken({ label: label || null, expires_in_days: expiry });
      setLabel('');
      setMsg('Token berhasil dibuat!');
      loadData();
    } catch (e) { setMsg(e.message); }
    setLoading(false);
  };

  const handleRevoke = async (id) => {
    if (!confirm('Cabut token ini?')) return;
    try { await revokeToken(id); setMsg('Token dicabut.'); loadData(); } catch (e) { setMsg(e.message); }
  };

  const copyToken = (val) => {
    navigator.clipboard.writeText(val);
    setMsg('Token disalin ke clipboard!');
  };

  if (user?.account_type !== 'developer') {
    return <div className="page page-centered"><h2>⛔ Akses Ditolak</h2><p className="text-muted">Halaman ini hanya untuk Developer.</p></div>;
  }

  return (
    <div className="page">
      <h1 style={{ marginBottom: 8 }}>⚙️ Admin Panel</h1>
      <p className="text-muted" style={{ marginBottom: 24 }}>Kelola token guru dan statistik sistem</p>

      {msg && <div className="toast animate-fade-in" style={{ marginBottom: 16, display: 'inline-block' }}>{msg}</div>}

      {/* Stats */}
      {stats && (
        <div className="grid-4" style={{ marginBottom: 32 }}>
          {[
            { l: 'Total Pemain', v: stats.total_players, i: '👥', c: 'var(--blue)' },
            { l: 'Room Aktif', v: stats.active_rooms, i: '🏠', c: 'var(--green)' },
            { l: 'Token Tersedia', v: stats.available_teacher_tokens, i: '🎟️', c: 'var(--accent)' },
            { l: 'Token Terpakai', v: stats.used_teacher_tokens, i: '✅', c: 'var(--purple)' },
          ].map(s => (
            <div key={s.l} className="stat-card">
              <span className="stat-icon">{s.i}</span>
              <span className="stat-value" style={{ color: s.c }}>{s.v}</span>
              <span className="stat-label">{s.l}</span>
            </div>
          ))}
        </div>
      )}

      {/* Create Token */}
      <div className="card" style={{ maxWidth: 480, marginBottom: 24 }}>
        <h3 style={{ marginBottom: 16 }}>🎟️ Buat Token Guru</h3>
        <div className="input-group">
          <label className="input-label">Label (opsional)</label>
          <input className="input" placeholder='Contoh: "Token untuk Bu Sari"' value={label} onChange={e => setLabel(e.target.value)} id="input-token-label" />
        </div>
        <div className="input-group">
          <label className="input-label">Masa berlaku (hari)</label>
          <input className="input" type="number" min={1} max={365} value={expiry} onChange={e => setExpiry(parseInt(e.target.value) || 30)} id="input-token-expiry" />
        </div>
        <button className="btn btn-primary btn-full" onClick={handleCreate} disabled={loading} id="btn-create-token">
          {loading ? <span className="spinner" /> : '✨ Buat Token'}
        </button>
      </div>

      {/* Token List */}
      <h3 style={{ marginBottom: 12 }}>Daftar Token ({tokens.total})</h3>
      <div className="admin-table">
        <div className="admin-header">
          <span>Token</span><span>Label</span><span>Status</span><span>Dipakai Oleh</span><span></span>
        </div>
        {tokens.tokens?.map(t => (
          <div key={t.token_id} className="admin-row">
            <span className="token-value" onClick={() => copyToken(t.token_value)} title="Klik untuk salin">
              {t.token_value.slice(0, 12)}...
            </span>
            <span className="text-muted">{t.label || '—'}</span>
            <span>
              {t.is_revoked ? <span className="badge badge-red">Dicabut</span>
                : t.is_used ? <span className="badge badge-green">Terpakai</span>
                : <span className="badge badge-accent">Tersedia</span>}
            </span>
            <span className="text-muted">{t.used_by_name || '—'}</span>
            <span>
              {!t.is_used && !t.is_revoked && (
                <button className="btn btn-danger btn-sm" onClick={() => handleRevoke(t.token_id)}>Cabut</button>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
