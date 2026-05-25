import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { updateProfile, getProfile, linkTeacher, getTeacherStudents } from '../api/auth.js';
import { getRankTier } from '../utils/helpers.js';
import './ProfilePage.css';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('stats');
  
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

  // Teacher Code state
  const [teacherCodeInput, setTeacherCodeInput] = useState('');
  const [teacherCodeError, setTeacherCodeError] = useState('');
  const [teacherCodeSuccess, setTeacherCodeSuccess] = useState('');
  const [linkingTeacher, setLinkingTeacher] = useState(false);
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Stats from backend
  const [stats, setStats] = useState({
    current_rank_point: 100,
    total_matches: 0,
    wins: 0,
    losses: 0,
    learning_streak_days: 0,
    my_teacher_code: null,
    linked_teacher_codes: []
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
        losses: data.losses,
        learning_streak_days: data.learning_streak_days,
        my_teacher_code: data.my_teacher_code,
        linked_teacher_codes: data.linked_teacher_codes || []
      });
      
      if (data.account_type === 'teacher' && data.my_teacher_code) {
        loadStudents();
      }

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

  const loadStudents = async () => {
    setLoadingStudents(true);
    try {
      const data = await getTeacherStudents();
      setStudents(data);
    } catch (err) {
      console.error('Gagal memuat daftar siswa', err);
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleLinkTeacher = async () => {
    const code = teacherCodeInput.trim().toUpperCase();
    if (!code) return;
    setLinkingTeacher(true);
    setTeacherCodeError('');
    setTeacherCodeSuccess('');
    try {
      const res = await linkTeacher({ teacher_code: code });
      setTeacherCodeSuccess(res.message);
      setStats(prev => ({ ...prev, linked_teacher_codes: res.linked_teacher_codes }));
      setTeacherCodeInput('');
    } catch (err) {
      setTeacherCodeError(err.response?.data?.detail || err.message || 'Gagal menautkan kode guru');
    } finally {
      setLinkingTeacher(false);
    }
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

      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
        <button className={`btn btn-ghost ${activeTab === 'stats' ? 'text-accent' : ''}`} onClick={() => setActiveTab('stats')} style={{ borderBottom: activeTab === 'stats' ? '2px solid var(--accent)' : 'none', borderRadius: 0 }}>📊 Statistik</button>
        {user?.account_type === 'teacher' && <button className={`btn btn-ghost ${activeTab === 'teacher' ? 'text-accent' : ''}`} onClick={() => setActiveTab('teacher')} style={{ borderBottom: activeTab === 'teacher' ? '2px solid var(--accent)' : 'none', borderRadius: 0 }}>👨‍🏫 Dasbor Guru</button>}
        {user?.account_type === 'user' && <button className={`btn btn-ghost ${activeTab === 'teacher' ? 'text-accent' : ''}`} onClick={() => setActiveTab('teacher')} style={{ borderBottom: activeTab === 'teacher' ? '2px solid var(--accent)' : 'none', borderRadius: 0 }}>🏫 Kelas & Guru</button>}
        <button className={`btn btn-ghost ${activeTab === 'settings' ? 'text-accent' : ''}`} onClick={() => setActiveTab('settings')} style={{ borderBottom: activeTab === 'settings' ? '2px solid var(--accent)' : 'none', borderRadius: 0 }}>⚙️ Pengaturan</button>
      </div>

      {activeTab === 'stats' && (
        <>
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
        </>
      )}

      {/* Teacher Section */}
      {activeTab === 'teacher' && (
        <div style={{ marginTop: 16 }}>
        {user?.account_type === 'teacher' && stats.my_teacher_code && (
          <div className="card" style={{ padding: 24, marginBottom: 24 }}>
            <h3 style={{ marginBottom: 16 }}><i className="fa-solid fa-chalkboard-user" style={{ marginRight: 8 }}></i> Dasbor Guru</h3>
            <p className="text-muted" style={{ marginBottom: 16 }}>Bagikan kode ini kepada siswa Anda agar mereka dapat menautkan akunnya.</p>
            <div className="uid-container" style={{ justifyContent: 'flex-start', background: 'rgba(0,0,0,0.2)', padding: '12px 16px' }}>
              <span className="uid-label" style={{ fontSize: '1.2rem' }}>KODE GURU:</span>
              <span className="uid-value" style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: 2 }}>{stats.my_teacher_code}</span>
              <button className="btn btn-sm btn-secondary" onClick={() => navigator.clipboard.writeText(stats.my_teacher_code)}>Salin Kode</button>
            </div>
            
            <h4 style={{ marginTop: 24, marginBottom: 12 }}>Daftar Siswa Tertaut ({students.length})</h4>
            {loadingStudents ? (
              <div className="spinner" style={{ width: 20, height: 20, margin: '20px auto' }}></div>
            ) : students.length > 0 ? (
              <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Siswa</th>
                      <th>Rank</th>
                      <th>Matches</th>
                      <th>Win Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map(s => {
                      const t = getRankTier(s.current_rank_point);
                      return (
                        <tr key={s.uid}>
                          <td style={{ fontWeight: 600 }}>{s.display_name}</td>
                          <td><span style={{ color: t.color, fontWeight: 700 }}><i className={`fa-solid ${t.icon}`} style={{ marginRight: 4 }}></i> {t.fullName}</span></td>
                          <td>{s.total_matches}</td>
                          <td>{s.win_rate}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted">Belum ada siswa yang menautkan kode Anda.</p>
            )}
          </div>
        )}

        {user?.account_type === 'user' && (
          <div className="card" style={{ padding: 24, marginBottom: 24 }}>
            <h3 style={{ marginBottom: 16 }}><i className="fa-solid fa-school" style={{ marginRight: 8 }}></i> Kelas & Guru</h3>
            {stats.linked_teacher_codes && stats.linked_teacher_codes.length > 0 ? (
              <div style={{ marginBottom: 20 }}>
                <p className="text-muted" style={{ marginBottom: 8 }}>Akun Anda telah ditautkan dengan Kode Guru:</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {stats.linked_teacher_codes.map(code => (
                    <span key={code} className="badge badge-accent" style={{ fontSize: '1rem', padding: '6px 12px' }}>{code}</span>
                  ))}
                </div>
              </div>
            ) : null}

            <div style={{ borderTop: stats.linked_teacher_codes?.length > 0 ? '1px solid var(--border)' : 'none', paddingTop: stats.linked_teacher_codes?.length > 0 ? 20 : 0 }}>
              <p className="text-muted" style={{ marginBottom: 12 }}>Tautkan akun ini ke Guru Anda menggunakan Kode Guru.</p>
              <div style={{ display: 'flex', gap: 12 }}>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="Contoh: TEACH-ABC12" 
                  value={teacherCodeInput}
                  onChange={e => setTeacherCodeInput(e.target.value.toUpperCase())}
                  style={{ textTransform: 'uppercase', flex: 1 }}
                />
                <button 
                  className="btn btn-primary" 
                  onClick={handleLinkTeacher} 
                  disabled={linkingTeacher || !teacherCodeInput.trim()}
                >
                  {linkingTeacher ? 'Menautkan...' : 'Tautkan'}
                </button>
              </div>
              {teacherCodeError && <p className="error-text" style={{ marginTop: 8 }}>{teacherCodeError}</p>}
              {teacherCodeSuccess && <p className="success-text" style={{ marginTop: 8, color: 'var(--green)' }}>{teacherCodeSuccess}</p>}
          </div>
        )}
      </div>
      )}

      {activeTab === 'settings' && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 32, flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <button className="btn btn-secondary" onClick={() => setIsChangingPassword(true)} style={{ width: 250 }}>
            🔒 Ubah Kata Sandi
          </button>
          <button className="btn btn-ghost" onClick={() => {
            const { logout } = require('../context/AuthContext.jsx'); // fallback
            // We use the logout from useAuth instead
            document.getElementById('btn-logout')?.click();
          }} style={{ width: 250, color: 'var(--red)' }}>
            <i className="fa-solid fa-right-from-bracket" style={{ marginRight: 8 }}></i> Keluar Akun
          </button>
        </div>
      )}

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
