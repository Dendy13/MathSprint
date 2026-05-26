import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { OP_LABELS, OP_SYMBOLS, OP_COLORS, DIFF_LABELS, DIFF_COLORS } from '../utils/constants.js';
import './RoomPage.css';

export default function RoomPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [config, setConfig] = useState({ op: 'add', diff: 'easy', question_limit: 10, time_limit_seconds: 60 });
  const [loading, setLoading] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(2);

  const isUser = user?.account_type === 'user';
  const hasEnoughRp = (user?.current_rank_point || 0) >= 20;

  const handleCreate = async () => {
    setLoading(true);
    try {
      const { createRoom } = await import('../api/game.js');
      const room = await createRoom({ config, max_players: maxPlayers });
      navigate(`/room/${room.room_id}`);
    } catch (err) {
      alert(err.message || 'Gagal membuat room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <h1 style={{ marginBottom: 8 }}>🏠 Buat Room</h1>
      <p className="text-muted" style={{ marginBottom: 16 }}>Atur permainan dan tantang lawan</p>

      {isUser && (
        <div className="alert alert-info" style={{ marginBottom: 24, textAlign: 'left', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid var(--accent)', padding: 16, borderRadius: 'var(--radius)' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--accent)' }}>
            <strong>Catatan:</strong> Sebagai akun Player, membuat Custom Room membutuhkan biaya masuk sebesar <strong>20 RP</strong>. Room ini tidak akan memberikan hadiah RP (murni untuk keseruan). Saldo RP Anda saat ini: <strong>{user.current_rank_point} RP</strong>.
          </p>
          {!hasEnoughRp && (
            <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem', color: 'var(--red)' }}>
              ❌ RP Anda tidak cukup untuk membuat room.
            </p>
          )}
        </div>
      )}

      <div className="room-form card animate-slide-up" style={{ maxWidth: 520 }}>
        {/* Operation */}
        <div className="config-section">
          <span className="input-label">Operasi</span>
          <div className="op-grid">
            {Object.entries(OP_LABELS).map(([k, v]) => (
              <button key={k} type="button" className={`op-btn ${config.op === k ? 'active' : ''}`}
                style={{ '--op-color': OP_COLORS[k] }}
                onClick={() => setConfig(c => ({ ...c, op: k }))}>
                <span className="op-symbol">{OP_SYMBOLS[k]}</span><span>{v}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty */}
        <div className="config-section">
          <span className="input-label">Kesulitan</span>
          <div className="diff-grid">
            {Object.entries(DIFF_LABELS).map(([k, v]) => (
              <button key={k} type="button" className={`diff-btn ${config.diff === k ? 'active' : ''}`}
                style={{ '--diff-color': DIFF_COLORS[k] }}
                onClick={() => setConfig(c => ({ ...c, diff: k }))}>{v}</button>
            ))}
          </div>
        </div>

        {/* Sliders */}
        <div className="config-section">
          <label className="input-label">Jumlah Soal: <strong className="text-accent">{config.question_limit}</strong></label>
          <input type="range" min={5} max={50} value={config.question_limit}
            onChange={e => setConfig(c => ({ ...c, question_limit: parseInt(e.target.value) }))}
            className="slider" id="slider-questions" />
        </div>

        <div className="config-section">
          <label className="input-label">Batas Waktu: <strong className="text-accent">{config.time_limit_seconds}s</strong></label>
          <input type="range" min={30} max={300} step={10} value={config.time_limit_seconds}
            onChange={e => setConfig(c => ({ ...c, time_limit_seconds: parseInt(e.target.value) }))}
            className="slider" id="slider-time" />
        </div>

        {!isUser && (
          <div className="config-section">
            <label className="input-label">Kapasitas Kelas (Max {maxPlayers}):</label>
            <input type="range" min={2} max={40} step={1} value={maxPlayers}
              onChange={e => setMaxPlayers(parseInt(e.target.value))}
              className="slider" id="slider-capacity" />
            <p className="text-muted mt-2" style={{ fontSize: '0.8rem' }}>Hanya Guru/Developer yang bisa membuat room &gt; 4 orang.</p>
          </div>
        )}

        <button className="btn btn-primary btn-full btn-lg" onClick={handleCreate} disabled={loading || (isUser && !hasEnoughRp)} id="btn-create-room-submit">
          {loading ? <span className="spinner" /> : '🚀 Buat Room & Tunggu Lawan'}
        </button>
      </div>
    </div>
  );
}
