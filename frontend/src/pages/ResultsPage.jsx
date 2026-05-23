import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getMatchResult } from '../api/game.js';
import { OP_LABELS, OP_SYMBOLS, DIFF_LABELS } from '../utils/constants.js';
import { getStarEmoji, getStarMessage } from '../utils/helpers.js';
import './ResultsPage.css';

export default function ResultsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || 'solo';
  const roomId = searchParams.get('roomId');
  const { user } = useAuth();

  const [results, setResults] = useState(null);
  const [multiResult, setMultiResult] = useState(null);
  const [loading, setLoading] = useState(mode === 'multi');
  const [animatedScore, setAnimatedScore] = useState(0);

  // 1. Polling for Multiplayer Match Result
  useEffect(() => {
    if (mode !== 'multi' || !roomId) return;
    
    let isMounted = true;
    let timeoutId;

    const pollResult = async () => {
      try {
        const data = await getMatchResult(roomId);
        if (!isMounted) return;
        setMultiResult(data);
        setLoading(false);
      } catch (err) {
        if (!isMounted) return;
        // Keep polling
        timeoutId = setTimeout(pollResult, 2000);
      }
    };
    
    pollResult();
    return () => { isMounted = false; clearTimeout(timeoutId); };
  }, [mode, roomId]);

  // 2. Load Solo Results from SessionStorage
  useEffect(() => {
    if (mode === 'multi') return;
    
    const raw = sessionStorage.getItem('mathsprint_results');
    if (!raw) { navigate('/'); return; }
    const data = JSON.parse(raw);
    setResults(data);

    // Score calculation
    const baseScore = data.correct * 100;
    const penalty = data.wrong * 50;
    const streakBonus = data.maxStreak >= 3 ? (data.maxStreak - 2) * 30 : 0;
    const finalScore = Math.max(0, baseScore + streakBonus - penalty);
    data.baseScore = baseScore;
    data.streakBonus = streakBonus;
    data.penalty = penalty;
    data.finalScore = finalScore;
    data.stars = data.correct === data.total ? 3 : data.correct >= Math.ceil(data.total * 0.75) ? 2 : data.correct >= Math.ceil(data.total * 0.5) ? 1 : 0;
    setResults({ ...data });

    // Count-up animation
    let frame = 0;
    const duration = 40;
    const step = finalScore / duration;
    const interval = setInterval(() => {
      frame++;
      setAnimatedScore(Math.min(Math.round(step * frame), finalScore));
      if (frame >= duration) clearInterval(interval);
    }, 25);
    return () => clearInterval(interval);
  }, [mode, navigate]);

  if (loading) {
    return (
      <div className="page text-center" style={{ paddingTop: '20vh' }}>
        <span className="spinner" style={{ width: 40, height: 40, borderWidth: 4 }} />
        <h2 className="mt-4">Selesai!</h2>
        <p className="text-muted">Menunggu lawan menyelesaikan soal dan menghitung rank point...</p>
      </div>
    );
  }

  // --- RENDER MULTIPLAYER RESULT ---
  if (mode === 'multi' && multiResult) {
    const isWinner = multiResult.winner_uid === user?.uid;
    const isDraw = multiResult.is_draw;
    
    const myCalc = isWinner || isDraw ? multiResult.winner_calculation : multiResult.loser_calculation;
    const oppCalc = isWinner || isDraw ? multiResult.loser_calculation : multiResult.winner_calculation;
    
    // Quick fix: if we are loser but draw, myCalc might be wrong if winner_calculation was assigned to us arbitrarily. 
    // Let's explicitly match uid:
    const actualMyCalc = multiResult.winner_calculation.player_uid === user?.uid ? multiResult.winner_calculation : multiResult.loser_calculation;
    const actualOppCalc = multiResult.winner_calculation.player_uid === user?.uid ? multiResult.loser_calculation : multiResult.winner_calculation;

    return (
      <div className="page page-centered">
        <div className="results-card animate-slide-up" style={{ textAlign: 'center' }}>
          
          <h1 style={{ fontSize: '3rem', margin: '0 0 16px 0', color: isDraw ? 'var(--text)' : isWinner ? 'var(--green)' : 'var(--red)' }}>
            {isDraw ? 'SERI! 🤝' : isWinner ? 'MENANG! 🎉' : 'KALAH! 💔'}
          </h1>
          
          <p className="text-muted">{OP_LABELS[multiResult.op]} • {DIFF_LABELS[multiResult.diff]}</p>

          <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--surface)', padding: 16, borderRadius: 'var(--radius)', marginTop: 24 }}>
            <div style={{ textAlign: 'left' }}>
              <div className="text-muted" style={{ fontSize: '0.85rem' }}>SKOR KAMU</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{actualMyCalc.display_name}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="text-muted" style={{ fontSize: '0.85rem' }}>SKOR LAWAN</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{actualOppCalc.display_name}</div>
            </div>
          </div>

          <div className="rp-change-card" style={{ marginTop: 24 }}>
            <div className="rp-side">
              <span className="rp-label">Rank Point</span>
              <span className="rp-value">{actualMyCalc.old_rp}</span>
            </div>
            <div className="rp-arrow">
              <span className={`arrow ${actualMyCalc.rp_change > 0 ? 'up' : actualMyCalc.rp_change < 0 ? 'down' : 'neutral'}`}>
                {actualMyCalc.rp_change > 0 ? '↗' : actualMyCalc.rp_change < 0 ? '↘' : '➡'}
              </span>
              <span className={`rp-diff ${actualMyCalc.rp_change > 0 ? 'text-green' : actualMyCalc.rp_change < 0 ? 'text-red' : 'text-muted'}`}>
                {actualMyCalc.rp_change > 0 ? `+${actualMyCalc.rp_change}` : actualMyCalc.rp_change}
              </span>
            </div>
            <div className="rp-side">
              <span className="rp-label">Rank Baru</span>
              <span className={`rp-value ${actualMyCalc.rp_change > 0 ? 'text-green' : actualMyCalc.rp_change < 0 ? 'text-red' : ''}`}>
                {actualMyCalc.new_rp}
              </span>
            </div>
          </div>

          {actualMyCalc.learning_protection_applied && (
            <div style={{ marginTop: 16, fontSize: '0.85rem', color: 'var(--accent)', background: 'rgba(56, 189, 248, 0.1)', padding: 8, borderRadius: 8 }}>
              🛡️ Learning Protection aktif: Penurunan RP didiskon 30% karena kekalahan beruntun.
            </div>
          )}

          <div className="results-actions" style={{ marginTop: 32 }}>
            <button className="btn btn-primary" onClick={() => navigate('/room/create')} id="btn-play-again">
              ⚔️ Main Lagi
            </button>
            <button className="btn btn-ghost" onClick={() => navigate('/')} id="btn-home">
              🔙 Beranda
            </button>
          </div>

        </div>
      </div>
    );
  }

  // --- RENDER SOLO RESULT ---
  if (!results) return null;

  return (
    <div className="page page-centered">
      <div className="results-card animate-slide-up">
        {/* Stars */}
        <div className="results-stars">
          {[0, 1, 2].map(i => (
            <span key={i} className="star" style={{ animationDelay: `${i * 0.15}s` }}>
              {i < results.stars ? '⭐' : '☆'}
            </span>
          ))}
        </div>
        <h2 className="results-message">{getStarMessage(results.stars)}</h2>
        <p className="text-muted">{OP_LABELS[results.op]} • {DIFF_LABELS[results.diff]}</p>

        {/* Score Breakdown */}
        <div className="breakdown">
          <div className="breakdown-row">
            <span>Skor Dasar ({results.correct} benar × 100)</span>
            <span className="text-accent">+{results.baseScore}</span>
          </div>
          <div className="breakdown-row">
            <span>Bonus Rangkaian (max {results.maxStreak} beruntun)</span>
            <span className="text-green">+{results.streakBonus}</span>
          </div>
          <div className="breakdown-row">
            <span>Penalti ({results.wrong} salah × 50)</span>
            <span className="text-red">-{results.penalty}</span>
          </div>
          <div className="breakdown-divider" />
          <div className="breakdown-row total">
            <span>SKOR AKHIR</span>
            <span className="score-final">{animatedScore}</span>
          </div>
        </div>

        {/* Rank Point Change */}
        <div className="rp-change-card">
          <div className="rp-side">
            <span className="rp-label">Rank Sebelumnya</span>
            <span className="rp-value">{results.oldRp} RP</span>
          </div>
          <div className="rp-arrow">
            <span className={`arrow ${results.rpChange > 0 ? 'up' : results.rpChange < 0 ? 'down' : 'neutral'}`}>
              {results.rpChange > 0 ? '↗' : results.rpChange < 0 ? '↘' : '➡'}
            </span>
            <span className={`rp-diff ${results.rpChange > 0 ? 'text-green' : results.rpChange < 0 ? 'text-red' : 'text-muted'}`}>
              {results.rpChange > 0 ? `+${results.rpChange}` : results.rpChange}
            </span>
          </div>
          <div className="rp-side">
            <span className="rp-label">Rank Baru</span>
            <span className={`rp-value ${results.rpChange > 0 ? 'text-green' : results.rpChange < 0 ? 'text-red' : ''}`}>
              {results.newRp} RP
            </span>
          </div>
        </div>

        {/* Review Table */}
        <div className="review-section">
          <h3 style={{ marginBottom: 12 }}>Review Soal</h3>
          <div className="review-table">
            <div className="review-header">
              <span>#</span><span>Soal</span><span>Jawabanmu</span><span>Benar</span><span></span>
            </div>
            {results.questions?.map((q, i) => {
              const userAns = results.answers?.[i];
              const isCorrect = userAns === q.answer;
              const isSkip = userAns === null;
              return (
                <div key={i} className={`review-row ${isCorrect ? 'correct' : isSkip ? 'skip' : 'wrong'}`}>
                  <span>{i + 1}</span>
                  <span>{q.num1} {OP_SYMBOLS[q.op]} {q.num2}</span>
                  <span>{isSkip ? '—' : userAns}</span>
                  <span>{q.answer}</span>
                  <span>{isCorrect ? '✅' : isSkip ? '⏭️' : '❌'}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="results-actions">
          <button className="btn btn-primary" onClick={() => navigate(`/game?mode=solo&op=${results.op}&diff=${results.diff}`)} id="btn-play-again">
            🔄 Main Lagi
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/leaderboard')} id="btn-leaderboard">
            🏆 Peringkat
          </button>
          <button className="btn btn-ghost" onClick={() => navigate('/')} id="btn-home">
            🔙 Beranda
          </button>
        </div>
      </div>
    </div>
  );
}
