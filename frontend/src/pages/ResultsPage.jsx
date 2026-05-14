import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { OP_LABELS, OP_SYMBOLS, DIFF_LABELS } from '../utils/constants.js';
import { getStarEmoji, getStarMessage } from '../utils/helpers.js';
import './ResultsPage.css';

export default function ResultsPage() {
  const navigate = useNavigate();
  const [results, setResults] = useState(null);
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
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
  }, []);

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
