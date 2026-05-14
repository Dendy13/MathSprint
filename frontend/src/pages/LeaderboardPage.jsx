import { useState, useEffect } from 'react';
import { getLeaderboard } from '../api/match.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatRP, formatWinRate, getRankTier } from '../utils/helpers.js';
import './LeaderboardPage.css';

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLeaderboard(100).then(setEntries).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const podiumColors = ['#f7c948', '#c0c0c0', '#cd7f32'];
  const podiumEmoji = ['👑', '🥈', '🥉'];

  return (
    <div className="page">
      <h1 style={{ marginBottom: 8 }}>🏆 Peringkat</h1>
      <p className="text-muted" style={{ marginBottom: 24 }}>Top pemain berdasarkan Rank Point</p>

      {loading ? (
        <div className="text-center" style={{ padding: 40 }}><div className="spinner spinner-lg" style={{ margin: '0 auto' }} /></div>
      ) : entries.length === 0 ? (
        <div className="empty-state">
          <span style={{ fontSize: 48 }}>🌟</span>
          <h3>Belum ada data</h3>
          <p className="text-muted">Jadilah yang pertama bermain!</p>
        </div>
      ) : (
        <>
          {/* Podium */}
          <div className="podium">
            {entries.slice(0, 3).map((e, i) => {
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
            })}
          </div>

          {/* Table */}
          <div className="lb-table">
            <div className="lb-header">
              <span>#</span><span>Pemain</span><span>RP</span><span>Match</span><span>Win Rate</span>
            </div>
            {entries.map(e => (
              <div key={e.uid} className={`lb-row ${e.uid === user?.uid ? 'highlight' : ''}`}>
                <span className="lb-rank">{e.rank}</span>
                <span className="lb-name">
                  {getRankTier(e.current_rank_point).emoji} {e.display_name}
                </span>
                <span className="lb-rp" style={{ color: getRankTier(e.current_rank_point).color }}>
                  {formatRP(e.current_rank_point)}
                </span>
                <span>{e.total_matches}</span>
                <span>{formatWinRate(e.wins, e.total_matches)}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
