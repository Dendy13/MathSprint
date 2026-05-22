import { useState, useEffect } from 'react';
import { getFriendList, getPendingRequests, sendFriendRequest, respondFriendRequest, removeFriend } from '../api/friend.js';
import { formatRP, getRankTier } from '../utils/helpers.js';
import './FriendsPage.css';

export default function FriendsPage() {
  const [tab, setTab] = useState('list');
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [searchUid, setSearchUid] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fl, rq] = await Promise.all([getFriendList(), getPendingRequests()]);
      setFriends(fl.friends || []);
      setRequests(rq || []);
    } catch { }
    setLoading(false);
  };

  const handleSendRequest = async () => {
    if (!searchUid.trim()) return;
    try {
      await sendFriendRequest(searchUid.trim());
      setMsg('Friend request terkirim!');
      setSearchUid('');
    } catch (e) { setMsg(e.message); }
  };

  const handleRespond = async (id, action) => {
    try {
      await respondFriendRequest(id, action);
      loadData();
    } catch (e) { setMsg(e.message); }
  };

  const handleRemove = async (uid) => {
    if (!confirm('Hapus teman ini?')) return;
    try { await removeFriend(uid); loadData(); } catch (e) { setMsg(e.message); }
  };

  return (
    <div className="page">
      <h1 style={{ marginBottom: 8 }}>👥 Teman</h1>
      <p className="text-muted" style={{ marginBottom: 24 }}>Kelola daftar teman dan undangan</p>

      <div className="friends-tabs">
        {[['list', `🤝 Teman (${friends.length})`], ['requests', `📨 Permintaan (${requests.length})`], ['add', '➕ Tambah']].map(([k, l]) => (
          <button key={k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {msg && <div className="toast animate-fade-in" style={{ margin: '12px 0', display: 'inline-block' }}>{msg}</div>}

      {tab === 'list' && (
        <div className="friends-grid">
          {friends.length === 0 ? (
            <div className="empty-state"><span style={{ fontSize: 40 }}>🤗</span><h3>Belum ada teman</h3><p className="text-muted">Tambahkan teman untuk bermain bersama!</p></div>
          ) : friends.map(f => {
            const tier = getRankTier(f.current_rank_point);
            return (
              <div key={f.uid} className="friend-card card">
                <div className="friend-info">
                  <span className="friend-tier">{tier.emoji}</span>
                  <div>
                    <div className="friend-name">{f.display_name}</div>
                    <div className="friend-rp" style={{ color: tier.color }}>{formatRP(f.current_rank_point)} RP</div>
                  </div>
                </div>
                <div className="friend-actions">
                  <button className="btn btn-danger btn-sm" onClick={() => handleRemove(f.uid)}>Hapus</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'requests' && (
        <div className="friends-grid">
          {requests.length === 0 ? (
            <div className="empty-state"><span style={{ fontSize: 40 }}>📭</span><h3>Tidak ada permintaan</h3></div>
          ) : requests.map(r => (
            <div key={r.request_id} className="friend-card card">
              <div className="friend-info">
                <span className="friend-tier">📨</span>
                <div>
                  <div className="friend-name">{r.from_display_name}</div>
                  <div className="text-muted" style={{ fontSize: '0.8rem' }}>Ingin berteman</div>
                </div>
              </div>
              <div className="friend-actions">
                <button className="btn btn-primary btn-sm" onClick={() => handleRespond(r.request_id, 'accepted')}>Terima</button>
                <button className="btn btn-ghost btn-sm" onClick={() => handleRespond(r.request_id, 'rejected')}>Tolak</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'add' && (
        <div className="card" style={{ maxWidth: 400 }}>
          <h3 style={{ marginBottom: 12 }}>Tambah Teman</h3>
          <div className="input-group">
            <label className="input-label">UID Pemain</label>
            <input className="input" placeholder="Masukkan UID pemain" value={searchUid} onChange={e => setSearchUid(e.target.value)} id="input-friend-uid" />
            <span className="game-hint" style={{ marginTop: '8px', display: 'block' }}>Minta temanmu untuk menyalin UID mereka dari halaman Profil.</span>
          </div>
          <button className="btn btn-primary btn-full" onClick={handleSendRequest} id="btn-send-request">Kirim Permintaan</button>
        </div>
      )}
    </div>
  );
}
