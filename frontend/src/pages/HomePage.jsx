import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getProfile, getSystemConfig } from '../api/auth.js';
import { matchmake } from '../api/game.js';
import { formatRP, formatWinRate, getRankTier } from '../utils/helpers.js';
import { OP_LABELS, OP_SYMBOLS, OP_COLORS, DIFF_LABELS, DIFF_COLORS } from '../utils/constants.js';
import './HomePage.css';

export default function HomePage() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const tier = getRankTier(user?.current_rank_point || 1200);

  const [soloConfig, setSoloConfig] = useState({ op: 'add', diff: 'easy' });
  const [duelConfig, setDuelConfig] = useState({ op: 'add', diff: 'medium' });
  const [roomCode, setRoomCode] = useState('');
  const [showSolo, setShowSolo] = useState(false);
  const [showDuel, setShowDuel] = useState(false);
  const [sysConfig, setSysConfig] = useState({});
  const [loadingDuel, setLoadingDuel] = useState(false);

  useEffect(() => {
    // Sinkronisasi data terbaru dari server agar stat di menu utama akurat
    getProfile().then(data => {
      updateUser({
        current_rank_point: data.current_rank_point,
        total_matches: data.total_matches,
        wins: data.wins,
        losses: data.losses,
        learning_streak_days: data.learning_streak_days
      });
    }).catch(() => {});
    
    getSystemConfig().then(data => setSysConfig(data)).catch(() => {});
  }, []);

  const startSolo = () => {
    navigate(`/game?mode=solo&op=${soloConfig.op}&diff=${soloConfig.diff}`);
  };

  const startDuel = async () => {
    setLoadingDuel(true);
    try {
      const config = sysConfig.matchmaking_allow_custom_config ? duelConfig : { op: sysConfig.matchmaking_fixed_op || 'add', diff: sysConfig.matchmaking_fixed_diff || 'medium' };
      const room = await matchmake({ ...config, question_limit: 10, elo_wager: 25, time_limit_seconds: 60 });
      navigate(`/room/${room.room_id}`);
    } catch (err) {
      alert(err.message || 'Gagal memulai Duel');
    } finally {
      setLoadingDuel(false);
    }
  };

  return (
    <div className="page">
      {/* Hero */}
      <div className="home-hero animate-fade-in">
        <div className="hero-left">
          <span className="hero-tier-badge" style={{ color: tier.color, borderColor: tier.color }}>
            {tier.emoji} {tier.name}
          </span>
          <h1>Halo, <span className="text-accent">{user?.display_name || 'Player'}</span>!</h1>
          <p className="text-muted">Siap untuk tantangan hari ini?</p>
        </div>
        <div className="hero-stats">
          {[
            { label: 'Rank Point', value: formatRP(user?.current_rank_point || 1200), color: tier.color, icon: '🏅' },
            { label: 'Total Match', value: user?.total_matches || 0, color: 'var(--blue)', icon: '⚔️' },
            { label: 'Streak', value: `${user?.learning_streak_days || 0} hari`, color: 'var(--orange)', icon: '🔥' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <span className="stat-icon">{s.icon}</span>
              <span className="stat-value" style={{ color: s.color }}>{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="home-actions animate-slide-up">
        <h2 style={{ marginBottom: 16 }}>Mulai Bermain</h2>
        <div className="grid-2">
          {sysConfig.matchmaking_enabled && (
            <div className="action-card" onClick={() => { setShowDuel(!showDuel); setShowSolo(false); }} id="btn-duel">
              <span className="action-icon">⚔️</span>
              <h3>Duel (Matchmaking)</h3>
              <p className="text-muted">Cari lawan otomatis</p>
            </div>
          )}
          <div className="action-card" onClick={() => { setShowSolo(!showSolo); setShowDuel(false); }} id="btn-solo">
            <span className="action-icon">🎮</span>
            <h3>Latihan Solo</h3>
            <p className="text-muted">Latihan mandiri tanpa lawan</p>
          </div>
          <div className="action-card" onClick={() => navigate('/room/create')} id="btn-create-room">
            <span className="action-icon">🏠</span>
            <h3>Buat Room</h3>
            <p className="text-muted">Tantang teman dengan taruhan RP</p>
          </div>
        </div>

        {/* Solo Config */}
        {showSolo && (
          <div className="solo-config animate-fade-in">
            <h3 style={{ marginBottom: 12 }}>Konfigurasi Solo</h3>
            <div className="config-section">
              <span className="input-label">Operasi</span>
              <div className="op-grid">
                {Object.entries(OP_LABELS).map(([k, v]) => (
                  <button key={k} className={`op-btn ${soloConfig.op === k ? 'active' : ''}`}
                    style={{ '--op-color': OP_COLORS[k] }}
                    onClick={() => setSoloConfig(c => ({ ...c, op: k }))}>
                    <span className="op-symbol">{OP_SYMBOLS[k]}</span>
                    <span>{v}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="config-section">
              <span className="input-label">Kesulitan</span>
              <div className="diff-grid">
                {Object.entries(DIFF_LABELS).map(([k, v]) => (
                  <button key={k} className={`diff-btn ${soloConfig.diff === k ? 'active' : ''}`}
                    style={{ '--diff-color': DIFF_COLORS[k] }}
                    onClick={() => setSoloConfig(c => ({ ...c, diff: k }))}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <button className="btn btn-primary btn-full" onClick={startSolo} id="btn-start-solo">🚀 Mulai Latihan</button>
          </div>
        )}

        {/* Duel Config */}
        {showDuel && sysConfig.matchmaking_enabled && (
          <div className="solo-config animate-fade-in">
            <h3 style={{ marginBottom: 12 }}>Mencari Lawan...</h3>
            {sysConfig.matchmaking_allow_custom_config ? (
              <>
                <div className="config-section">
                  <span className="input-label">Operasi</span>
                  <div className="op-grid">
                    {Object.entries(OP_LABELS).map(([k, v]) => (
                      <button key={k} className={`op-btn ${duelConfig.op === k ? 'active' : ''}`}
                        style={{ '--op-color': OP_COLORS[k] }}
                        onClick={() => setDuelConfig(c => ({ ...c, op: k }))}>
                        <span className="op-symbol">{OP_SYMBOLS[k]}</span>
                        <span>{v}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="config-section">
                  <span className="input-label">Kesulitan</span>
                  <div className="diff-grid">
                    {Object.entries(DIFF_LABELS).map(([k, v]) => (
                      <button key={k} className={`diff-btn ${duelConfig.diff === k ? 'active' : ''}`}
                        style={{ '--diff-color': DIFF_COLORS[k] }}
                        onClick={() => setDuelConfig(c => ({ ...c, diff: k }))}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-muted" style={{ marginBottom: 20 }}>Mode Duel saat ini menggunakan konfigurasi default server.</p>
            )}
            <button className="btn btn-primary btn-full" onClick={startDuel} disabled={loadingDuel} id="btn-start-duel">
              {loadingDuel ? 'Mencari...' : '⚔️ Cari Lawan Sekarang'}
            </button>
          </div>
        )}

        {/* Join Room */}
        <div className="join-section">
          <h3>Atau masuk room yang sudah ada</h3>
          <div className="join-row">
            <input className="input room-code-input" placeholder="Kode Room (6 karakter)" value={roomCode}
              onChange={e => setRoomCode(e.target.value.toUpperCase().slice(0, 6))}
              maxLength={6} style={{ fontFamily: 'monospace', fontSize: '1.2rem', letterSpacing: 3, textAlign: 'center' }} id="input-room-code" />
            <button className="btn btn-secondary" disabled={roomCode.length !== 6}
              onClick={() => navigate(`/room/${roomCode}`)} id="btn-join-room">Masuk</button>
          </div>
        </div>
      </div>
    </div>
  );
}
