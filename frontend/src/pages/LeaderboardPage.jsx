import { useState, useEffect } from 'react';
import { getLeaderboard, getSoloLeaderboard } from '../api/match.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatRP, formatWinRate, getRankTier } from '../utils/helpers.js';
import './LeaderboardPage.css';

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('multi'); // 'multi' | 'solo'
  const [soloOp, setSoloOp] = useState('add');
  const [soloDiff, setSoloDiff] = useState('easy');
  const [entries, setEntries] = useState([]);
  const [soloEntries, setSoloEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (activeTab === 'multi') {
      getLeaderboard(100)
        .then(setEntries)
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      getSoloLeaderboard(soloOp, soloDiff, 100)
        .then(setSoloEntries)
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [activeTab, soloOp, soloDiff]);

  const podiumColors = ['#f7c948', '#c0c0c0', '#cd7f32'];
  const podiumEmoji = ['👑', '🥈', '🥉'];
  
  const currentData = activeTab === 'multi' ? entries : soloEntries;

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ marginBottom: 8 }}>🏆 Peringkat</h1>
          <p className="text-muted">Top pemain MathSprint</p>
        </div>
        <div style={{ display: 'flex', background: 'var(--surface)', padding: 4, borderRadius: 'var(--radius-full)', border: '1px solid var(--border)' }}>
          <button 
            className={`btn ${activeTab === 'multi' ? 'btn-primary' : 'btn-ghost'}`} 
            style={{ borderRadius: 'var(--radius-full)', padding: '8px 20px' }}
            onClick={() => setActiveTab('multi')}
          >
            ⚔️ Multiplayer
          </button>
          <button 
            className={`btn ${activeTab === 'solo' ? 'btn-primary' : 'btn-ghost'}`} 
            style={{ borderRadius: 'var(--radius-full)', padding: '8px 20px' }}
            onClick={() => setActiveTab('solo')}
          >
            🏃 Solo 60s
          </button>
        </div>
      </div>

      {activeTab === 'solo' && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, justifyContent: 'center' }}>
          <select 
            className="input" 
            style={{ width: 'auto', padding: '8px 16px', borderRadius: 'var(--radius-full)', background: 'var(--surface)', border: '1px solid var(--border)' }}
            value={soloOp} 
            onChange={(e) => setSoloOp(e.target.value)}
          >
            <option value="add">➕ Tambah</option>
            <option value="sub">➖ Kurang</option>
            <option value="mul">✖️ Kali</option>
            <option value="div">➗ Bagi</option>
          </select>
          <select 
            className="input" 
            style={{ width: 'auto', padding: '8px 16px', borderRadius: 'var(--radius-full)', background: 'var(--surface)', border: '1px solid var(--border)' }}
            value={soloDiff} 
            onChange={(e) => setSoloDiff(e.target.value)}
          >
            <option value="easy">🟢 Mudah</option>
            <option value="medium">🟡 Sedang</option>
            <option value="hard">🔴 Sulit</option>
          </select>
        </div>
      )}

      {loading ? (
        <div className="text-center" style={{ padding: 40 }}><div className="spinner spinner-lg" style={{ margin: '0 auto' }} /></div>
      ) : currentData.length === 0 ? (
        <div className="empty-state">
          <span style={{ fontSize: 48 }}>🌟</span>
          <h3>Belum ada data</h3>
          <p className="text-muted">Jadilah yang pertama bermain!</p>
        </div>
      ) : (
        <>
          {/* Podium */}
          <div className="podium">
            {currentData.slice(0, 3).map((e, i) => {
              if (activeTab === 'multi') {
                const tier = getRankTier(e.current_rank_point);
                return (
                  <div key={e.uid} className={`podium-card rank-${i + 1}`} style={{ '--podium-color': podiumColors[i] }}>
                    <span className="podium-emoji">{podiumEmoji[i]}</span>
                    <span className="podium-rank">#{i + 1}</span>
                    <span className="podium-name">{e.display_name}</span>
                    <span className="podium-rp" style={{ color: podiumColors[i] }}>{formatRP(e.current_rank_point)} RP</span>
                    <span className="podium-stats">{e.total_matches} match · {formatWinRate(e.wins, e.total_matches)}% WR</span>
                  </div>
                );
              } else {
                return (
                  <div key={e.player_uid} className={`podium-card rank-${i + 1}`} style={{ '--podium-color': podiumColors[i] }}>
                    <span className="podium-emoji">{podiumEmoji[i]}</span>
                    <span className="podium-rank">#{i + 1}</span>
                    <span className="podium-name">{e.display_name}</span>
                    <span className="podium-rp" style={{ color: podiumColors[i] }}>{e.score} Pts</span>
                    <span className="podium-stats">{e.correct} Benar · {e.max_streak} Kombo</span>
                  </div>
                );
              }
            })}
          </div>

          {/* Table */}
          <div className="lb-table">
            <div className="lb-header">
              {activeTab === 'multi' ? (
                <><span>#</span><span>Pemain</span><span>RP</span><span>Match</span><span>Win Rate</span></>
              ) : (
                <><span>#</span><span>Pemain</span><span>Skor</span><span>Benar / Salah</span><span>Max Kombo</span></>
              )}
            </div>
            {currentData.map((e, index) => {
              const rank = index + 1;
              if (activeTab === 'multi') {
                return (
                  <div key={e.uid} className={`lb-row ${e.uid === user?.uid ? 'highlight' : ''}`}>
                    <span className="lb-rank">{e.rank || rank}</span>
                    <span className="lb-name">
                      {getRankTier(e.current_rank_point).emoji} {e.display_name}
                    </span>
                    <span className="lb-rp" style={{ color: getRankTier(e.current_rank_point).color }}>
                      {formatRP(e.current_rank_point)}
                    </span>
                    <span>{e.total_matches}</span>
                    <span>{formatWinRate(e.wins, e.total_matches)}%</span>
                  </div>
                );
              } else {
                return (
                  <div key={e.player_uid} className={`lb-row ${e.player_uid === user?.uid ? 'highlight' : ''}`}>
                    <span className="lb-rank">{rank}</span>
                    <span className="lb-name">{e.display_name}</span>
                    <span className="lb-rp" style={{ color: 'var(--accent)' }}>{e.score} Pts</span>
                    <span><span className="text-green">{e.correct}</span> / <span className="text-red">{e.wrong}</span></span>
                    <span>🔥 {e.max_streak}</span>
                  </div>
                );
              }
            })}
          </div>
        </>
      )}
    </div>
  );
}
