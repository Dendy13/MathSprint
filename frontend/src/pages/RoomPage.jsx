import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { OP_LABELS, OP_SYMBOLS, OP_COLORS, DIFF_LABELS, DIFF_COLORS } from '../utils/constants.js';
import './RoomPage.css';

export default function RoomPage() {
  const navigate = useNavigate();
  const [config, setConfig] = useState({ op: 'add', diff: 'easy', question_limit: 10, elo_wager: 25, time_limit_seconds: 60 });
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const { createRoom } = await import('../api/game.js');
      const room = await createRoom({ config, max_players: 2 });
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
      <p className="text-muted" style={{ marginBottom: 24 }}>Atur permainan dan tantang lawan</p>

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
          <label className="input-label">Elo Wager: <strong className="text-accent">{config.elo_wager} RP</strong></label>
          <input type="range" min={5} max={100} step={5} value={config.elo_wager}
            onChange={e => setConfig(c => ({ ...c, elo_wager: parseInt(e.target.value) }))}
            className="slider" id="slider-elo" />
        </div>

        <div className="config-section">
          <label className="input-label">Batas Waktu: <strong className="text-accent">{config.time_limit_seconds}s</strong></label>
          <input type="range" min={30} max={300} step={10} value={config.time_limit_seconds}
            onChange={e => setConfig(c => ({ ...c, time_limit_seconds: parseInt(e.target.value) }))}
            className="slider" id="slider-time" />
        </div>

        <button className="btn btn-primary btn-full btn-lg" onClick={handleCreate} disabled={loading} id="btn-create-room-submit">
          {loading ? <span className="spinner" /> : '🚀 Buat Room & Tunggu Lawan'}
        </button>
      </div>
    </div>
  );
}
