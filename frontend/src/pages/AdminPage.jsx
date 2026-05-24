import { useState, useEffect } from 'react';
import { createToken, listTokens, revokeToken, getSystemStats, getSystemConfig, updateSystemConfig, listUsers, updateUser } from '../api/admin.js';
import { useAuth } from '../context/AuthContext.jsx';
import './AdminPage.css';

export default function AdminPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, config, users
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Dashboard Tab State
  const [tokens, setTokens] = useState({ tokens: [], total: 0, used_count: 0, available_count: 0 });
  const [stats, setStats] = useState(null);
  const [tokenSearch, setTokenSearch] = useState('');
  const [label, setLabel] = useState('');
  const [expiry, setExpiry] = useState(30);

  // Config Tab State
  const [config, setConfig] = useState(null);

  // Users Tab State
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [editingUser, setEditingUser] = useState(null);

  useEffect(() => { 
    if (user?.account_type === 'developer') {
      loadDashboardData();
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'config' && !config) loadConfig();
    if (activeTab === 'users' && users.length === 0) loadUsers();
  }, [activeTab]);

  const showMsg = (text) => {
    setMsg(text);
    setTimeout(() => setMsg(''), 3000);
  };

  const loadDashboardData = async () => {
    try {
      const [t, s] = await Promise.all([listTokens(), getSystemStats()]);
      setTokens(t);
      setStats(s);
    } catch (e) { showMsg(e.message); }
  };

  const loadConfig = async () => {
    try {
      const c = await getSystemConfig();
      setConfig(c);
    } catch (e) { showMsg(e.message); }
  };

  const loadUsers = async () => {
    try {
      const res = await listUsers(100);
      setUsers(res.users || []);
    } catch (e) { showMsg(e.message); }
  };

  // --- Handlers for Dashboard ---
  const handleCreateToken = async () => {
    setLoading(true);
    try {
      await createToken({ label: label || null, expires_in_days: expiry });
      setLabel('');
      showMsg('Token berhasil dibuat!');
      loadDashboardData();
    } catch (e) { showMsg(e.message); }
    setLoading(false);
  };

  const handleRevokeToken = async (id) => {
    if (!confirm('Cabut token ini?')) return;
    try { await revokeToken(id); showMsg('Token dicabut.'); loadDashboardData(); } catch (e) { showMsg(e.message); }
  };

  const copyToken = (val) => {
    navigator.clipboard.writeText(val);
    showMsg('Token disalin ke clipboard!');
  };

  // --- Handlers for Config ---
  const handleToggleConfig = async (key) => {
    if (!config) return;
    const newConfig = { ...config, [key]: !config[key] };
    setConfig(newConfig);
    try {
      await updateSystemConfig(newConfig);
      showMsg('Konfigurasi diperbarui.');
    } catch (e) {
      showMsg(e.message);
      setConfig(config); // Revert
    }
  };

  // --- Handlers for Users ---
  const handleSaveUser = async () => {
    if (!editingUser) return;
    try {
      await updateUser(editingUser.uid, {
        display_name: editingUser.display_name,
        account_type: editingUser.account_type,
        current_rank_point: parseInt(editingUser.current_rank_point) || 1200
      });
      showMsg('Akun berhasil diubah!');
      setEditingUser(null);
      loadUsers();
    } catch (e) { showMsg(e.message); }
  };

  if (user?.account_type !== 'developer') {
    return <div className="page page-centered"><h2>⛔ Akses Ditolak</h2><p className="text-muted">Halaman ini hanya untuk Developer.</p></div>;
  }

  const filteredTokens = tokens.tokens?.filter(t => 
    t.token_value.includes(tokenSearch) || 
    (t.label && t.label.toLowerCase().includes(tokenSearch.toLowerCase())) ||
    (t.used_by_name && t.used_by_name.toLowerCase().includes(tokenSearch.toLowerCase()))
  );

  const filteredUsers = users.filter(u => 
    u.display_name.toLowerCase().includes(userSearch.toLowerCase()) || 
    u.uid.includes(userSearch)
  );

  return (
    <div className="page">
      <h1 style={{ marginBottom: 8 }}>⚙️ Admin Panel</h1>
      <p className="text-muted" style={{ marginBottom: 24 }}>Kelola sistem MathSprint</p>

      {msg && <div className="toast animate-fade-in" style={{ marginBottom: 16, display: 'inline-block' }}>{msg}</div>}

      <div className="tabs" style={{ marginBottom: 24, display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
        <button className={`btn btn-sm ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('dashboard')}>Statistik & Token</button>
        <button className={`btn btn-sm ${activeTab === 'config' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('config')}>Sistem Konfigurasi</button>
        <button className={`btn btn-sm ${activeTab === 'users' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('users')}>Manajemen Akun</button>
      </div>

      {/* --- DASHBOARD TAB --- */}
      {activeTab === 'dashboard' && (
        <div className="tab-content animate-fade-in">
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

          <div className="card" style={{ maxWidth: 480, marginBottom: 24 }}>
            <h3 style={{ marginBottom: 16 }}>🎟️ Buat Token Guru</h3>
            <div className="input-group">
              <label className="input-label">Label (opsional)</label>
              <input className="input" placeholder='Contoh: "Token untuk Bu Sari"' value={label} onChange={e => setLabel(e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">Masa berlaku (hari)</label>
              <input className="input" type="number" min={1} max={365} value={expiry} onChange={e => setExpiry(parseInt(e.target.value) || 30)} />
            </div>
            <button className="btn btn-primary btn-full" onClick={handleCreateToken} disabled={loading}>
              {loading ? <span className="spinner" /> : '✨ Buat Token'}
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3>Daftar Token ({tokens.total})</h3>
            <input className="input" style={{ width: 250 }} placeholder="Cari token atau label..." value={tokenSearch} onChange={e => setTokenSearch(e.target.value)} />
          </div>
          
          <div className="admin-table">
            <div className="admin-header">
              <span>Token</span><span>Label</span><span>Status</span><span>Dipakai Oleh</span><span></span>
            </div>
            {filteredTokens?.length === 0 ? <div className="text-center text-muted" style={{ padding: 20 }}>Tidak ada token ditemukan.</div> : 
              filteredTokens?.map(t => (
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
                      <button className="btn btn-danger btn-sm" onClick={() => handleRevokeToken(t.token_id)}>Cabut</button>
                    )}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* --- CONFIG TAB --- */}
      {activeTab === 'config' && config && (
        <div className="tab-content animate-fade-in card" style={{ maxWidth: 600 }}>
          <h3 style={{ marginBottom: 24 }}>🎛️ Feature Toggles</h3>
          <div className="config-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
            <div>
              <h4 style={{ marginBottom: 4 }}>Maintenance Mode</h4>
              <p className="text-muted" style={{ fontSize: '0.85rem' }}>Tutup akses pemain (hanya developer yang bisa masuk).</p>
            </div>
            <button className={`btn ${config.maintenance_mode ? 'btn-red' : 'btn-ghost'}`} onClick={() => handleToggleConfig('maintenance_mode')}>
              {config.maintenance_mode ? 'MATIKAN SISTEM' : 'Normal'}
            </button>
          </div>
          <div className="config-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
            <div>
              <h4 style={{ marginBottom: 4 }}>Mode Solo</h4>
              <p className="text-muted" style={{ fontSize: '0.85rem' }}>Buka atau tutup mode latihan Solo 60 detik.</p>
            </div>
            <button className={`btn ${config.solo_mode_enabled ? 'btn-green' : 'btn-red'}`} onClick={() => handleToggleConfig('solo_mode_enabled')}>
              {config.solo_mode_enabled ? 'ON' : 'OFF'}
            </button>
          </div>
          <div className="config-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ marginBottom: 4 }}>Pendaftaran Guru</h4>
              <p className="text-muted" style={{ fontSize: '0.85rem' }}>Izinkan pendaftaran akun Guru dengan token.</p>
            </div>
            <button className={`btn ${config.teacher_registration_enabled ? 'btn-green' : 'btn-red'}`} onClick={() => handleToggleConfig('teacher_registration_enabled')}>
              {config.teacher_registration_enabled ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      )}

      {/* --- USERS TAB --- */}
      {activeTab === 'users' && (
        <div className="tab-content animate-fade-in">
          {editingUser ? (
            <div className="card" style={{ maxWidth: 480 }}>
              <h3 style={{ marginBottom: 16 }}>✏️ Edit Pemain</h3>
              <div className="input-group">
                <label className="input-label">Display Name</label>
                <input className="input" value={editingUser.display_name} onChange={e => setEditingUser({...editingUser, display_name: e.target.value})} />
              </div>
              <div className="input-group">
                <label className="input-label">Rank Point (RP)</label>
                <input className="input" type="number" value={editingUser.current_rank_point} onChange={e => setEditingUser({...editingUser, current_rank_point: e.target.value})} />
              </div>
              <div className="input-group">
                <label className="input-label">Tipe Akun</label>
                <select className="input" value={editingUser.account_type} onChange={e => setEditingUser({...editingUser, account_type: e.target.value})}>
                  <option value="user">User (Pemain)</option>
                  <option value="teacher">Teacher (Guru)</option>
                  <option value="developer">Developer (Admin)</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSaveUser}>Simpan</button>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setEditingUser(null)}>Batal</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3>Daftar Pemain ({users.length})</h3>
                <input className="input" style={{ width: 300 }} placeholder="Cari nama atau UID..." value={userSearch} onChange={e => setUserSearch(e.target.value)} />
              </div>
              
              <div className="admin-table">
                <div className="admin-header" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}>
                  <span>Nama</span><span>UID</span><span>Tipe Akun</span><span>RP</span><span>Aksi</span>
                </div>
                {filteredUsers.length === 0 ? <div className="text-center text-muted" style={{ padding: 20 }}>Tidak ada pemain ditemukan.</div> : 
                  filteredUsers.map(u => (
                    <div key={u.uid} className="admin-row" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}>
                      <span style={{ fontWeight: 600 }}>{u.display_name}</span>
                      <span className="text-muted" style={{ fontSize: '0.75rem' }}>{u.uid.slice(0, 8)}...</span>
                      <span><span className={`badge badge-${u.account_type === 'developer' ? 'purple' : u.account_type === 'teacher' ? 'blue' : 'accent'}`}>{u.account_type}</span></span>
                      <span>{u.current_rank_point} RP</span>
                      <span>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditingUser(u)}>Edit</button>
                      </span>
                    </div>
                  ))
                }
              </div>
            </>
          )}
        </div>
      )}

    </div>
  );
}
