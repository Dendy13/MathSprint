import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { updateProfile, getProfile } from '../api/auth.js';
import './ProfilePage.css';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  
  // Edit display name state
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Edit password state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '' });
  const [passError, setPassError] = useState('');
  const [passMsg, setPassMsg] = useState('');
  const [savingPass, setSavingPass] = useState(false);

  // Stats from backend
  const [stats, setStats] = useState({
    current_rank_point: 1200,
    total_matches: 0,
    wins: 0,
    losses: 0,
    learning_streak_days: 0
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const data = await getProfile();
      setStats({
        current_rank_point: data.current_rank_point,
        total_matches: data.total_matches,
        wins: data.wins,
        losses: data.losses,
        learning_streak_days: data.learning_streak_days
      });
      // Sync auth context if needed
      if (data.display_name !== user?.display_name) {
        updateUser({ display_name: data.display_name });
      }
    } catch (err) {
      console.error("Gagal memuat profil:", err);
    } finally {
      setLoading(false);
    }
  };

  const copyUid = () => {
    if (!user?.uid) return;
    navigator.clipboard.writeText(user.uid);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEditClick = () => {
    setNewName(user?.display_name || '');
    setIsEditing(true);
    setError('');
  };

  const handleSaveName = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setError('Nama tidak boleh kosong');
      return;
    }
    if (trimmed === user?.display_name) {
      setIsEditing(false);
      return;
    }

    setSaving(true);
    try {
      await updateProfile({ display_name: trimmed });
      updateUser({ display_name: trimmed });
      setIsEditing(false);
    } catch (err) {
      setError(err.message || 'Gagal menyimpan nama');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    const { oldPassword, newPassword } = passwordForm;
    if (!oldPassword || newPassword.length < 8) {
      setPassError('Password baru minimal 8 karakter.');
      return;
    }
    
    setSavingPass(true);
    setPassError('');
    setPassMsg('');
    
    try {
      const { EmailAuthProvider, reauthenticateWithCredential, updatePassword } = await import('firebase/auth');
      const { auth } = await import('../config/firebase.js');
      const currentUser = auth.currentUser;
      
      if (!currentUser) throw new Error('Pengguna tidak ditemukan.');

      // Re-authenticate first
      const credential = EmailAuthProvider.credential(currentUser.email, oldPassword);
      await reauthenticateWithCredential(currentUser, credential);
      
      // Update password
      await updatePassword(currentUser, newPassword);
      setPassMsg('Kata sandi berhasil diubah!');
      setTimeout(() => {
        setIsChangingPassword(false);
        setPasswordForm({ oldPassword: '', newPassword: '' });
        setPassMsg('');
      }, 2000);
      
    } catch (err) {
      if (err.code === 'auth/invalid-credential') setPassError('Kata sandi saat ini salah.');
      else setPassError(err.message || 'Gagal mengubah kata sandi.');
    } finally {
      setSavingPass(false);
    }
  };

  const getInitial = (name) => {
    return name ? name.charAt(0).toUpperCase() : '?';
  };

  const getWinRate = () => {
    if (stats.total_matches === 0) return 0;
    return Math.round((stats.wins / stats.total_matches) * 100);
  };

  if (!user) return null;

  return (
    <div className="profile-page">
      <div className="profile-header">
        <div className="profile-avatar">
          {getInitial(user.display_name)}
        </div>
        
        <div className="profile-name-container">
          <h1 className="profile-name">{user.display_name}</h1>
          <button className="edit-btn" onClick={handleEditClick} title="Edit Nama">
            ✎
          </button>
        </div>

        <div className="profile-type">
          <span className={`badge badge-${user.account_type === 'developer' ? 'purple' : user.account_type === 'teacher' ? 'blue' : 'accent'}`}>
            {user.account_type.toUpperCase()}
          </span>
        </div>

        <div className="uid-container">
          <span className="uid-label">UID:</span>
          <span className="uid-value">{user.uid}</span>
          <button className="copy-btn" onClick={copyUid}>
            {copied ? 'Disalin! ✅' : 'Salin UID'}
          </button>
        </div>
      </div>

      <h3 className="text-center" style={{ marginBottom: '24px', color: 'var(--muted)' }}>
        STATISTIK PERTANDINGAN
      </h3>

      {loading ? (
        <div className="page-centered"><div className="spinner" /></div>
      ) : (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.current_rank_point}</div>
            <div className="stat-label">Rank Point</div>
            <div className="stat-sub">Semakin tinggi semakin pro!</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.total_matches}</div>
            <div className="stat-label">Total Match</div>
            <div className="stat-sub">Main {stats.wins} Menang / {stats.losses} Kalah</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{getWinRate()}%</div>
            <div className="stat-label">Win Rate</div>
            <div className="stat-sub">Persentase kemenangan</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--orange)' }}>
              🔥 {stats.learning_streak_days}
            </div>
            <div className="stat-label">Hari Streak</div>
            <div className="stat-sub">Belajar berturut-turut</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 32 }}>
        <button className="btn btn-ghost" onClick={() => setIsChangingPassword(true)}>
          🔒 Ubah Kata Sandi
        </button>
      </div>

      {/* Edit Name Modal */}
      {isEditing && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title">Ubah Nama</h2>
            
            <div className="input-group">
              <label className="input-label">Display Name Baru</label>
              <input
                type="text"
                className={`input ${error ? 'input-error' : ''}`}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Masukkan nama baru..."
                autoFocus
              />
              {error && <span className="error-text">{error}</span>}
            </div>

            <div className="modal-actions">
              <button 
                className="btn btn-ghost" 
                onClick={() => setIsEditing(false)}
                disabled={saving}
              >
                Batal
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleSaveName}
                disabled={saving}
              >
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {isChangingPassword && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title">Ubah Kata Sandi</h2>
            
            <div className="input-group">
              <label className="input-label">Kata Sandi Saat Ini</label>
              <input
                type="password"
                className="input"
                value={passwordForm.oldPassword}
                onChange={(e) => setPasswordForm({...passwordForm, oldPassword: e.target.value})}
                placeholder="Masukkan kata sandi lama..."
                autoFocus
              />
            </div>

            <div className="input-group">
              <label className="input-label">Kata Sandi Baru</label>
              <input
                type="password"
                className={`input ${passError ? 'input-error' : ''}`}
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                placeholder="Minimal 8 karakter..."
              />
              {passError && <span className="error-text">{passError}</span>}
              {passMsg && <span style={{ color: 'var(--green)', fontSize: '0.85rem', marginTop: 4, display: 'block' }}>{passMsg}</span>}
            </div>

            <div className="modal-actions">
              <button 
                className="btn btn-ghost" 
                onClick={() => {
                  setIsChangingPassword(false);
                  setPassError('');
                  setPassMsg('');
                  setPasswordForm({ oldPassword: '', newPassword: '' });
                }}
                disabled={savingPass}
              >
                Batal
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleChangePassword}
                disabled={savingPass}
              >
                {savingPass ? 'Menyimpan...' : 'Simpan Sandi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
