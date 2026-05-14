import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTimer } from '../hooks/useTimer.js';
import { getQuestion } from '../api/game.js';
import { OP_SYMBOLS, OP_COLORS, OP_LABELS, DIFF_LABELS } from '../utils/constants.js';
import './GamePage.css';

export default function GamePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const op = params.get('op') || 'add';
  const diff = params.get('diff') || 'easy';
  const mode = params.get('mode') || 'solo';
  const totalQ = parseInt(params.get('count') || '10');
  const timeLimit = parseInt(params.get('time') || '60');

  const [phase, setPhase] = useState('countdown'); // countdown | playing | finished
  const [countdown, setCountdown] = useState(3);
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [inputVal, setInputVal] = useState('');
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const inputRef = useRef(null);

  const onTimerExpire = useCallback(() => {
    if (phase === 'playing') finishGame();
  }, [phase]);

  const timer = useTimer(timeLimit, onTimerExpire);

  // Generate questions on mount
  useEffect(() => {
    const loadQuestions = async () => {
      const qs = [];
      for (let i = 0; i < totalQ; i++) {
        try {
          const q = await getQuestion(op, diff);
          qs.push(q);
        } catch { break; }
      }
      setQuestions(qs);
      setAnswers(new Array(qs.length).fill(null));
    };
    loadQuestions();
  }, [op, diff, totalQ]);

  // Countdown
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown <= 0) {
      setPhase('playing');
      timer.start();
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, phase]);

  // Auto-focus input
  useEffect(() => {
    if (phase === 'playing') inputRef.current?.focus();
  }, [phase, currentIdx]);

  const showFeedback = (type, correctAnswer) => {
    setFeedback({ type, correctAnswer });
    setTimeout(() => setFeedback(null), 400);
  };

  // Keep a ref to latest answers for finishGame closure
  const answersRef = useRef(answers);
  useEffect(() => { answersRef.current = answers; }, [answers]);
  const maxStreakRef = useRef(maxStreak);
  useEffect(() => { maxStreakRef.current = maxStreak; }, [maxStreak]);

  const submitAnswer = () => {
    if (phase !== 'playing' || currentIdx >= questions.length) return;
    const q = questions[currentIdx];
    const userAns = inputVal.trim() === '' ? null : parseInt(inputVal);
    const newAnswers = [...answers];
    newAnswers[currentIdx] = userAns;
    setAnswers(newAnswers);
    answersRef.current = newAnswers;

    const isCorrect = userAns === q.answer;
    if (isCorrect) {
      setStreak(s => {
        const ns = s + 1;
        if (ns > maxStreakRef.current) { setMaxStreak(ns); maxStreakRef.current = ns; }
        return ns;
      });
      showFeedback('correct');
    } else {
      setStreak(0);
      showFeedback('wrong', q.answer);
    }

    setInputVal('');
    if (currentIdx + 1 >= questions.length) {
      setTimeout(() => finishGame(newAnswers), 300);
    } else {
      setCurrentIdx(i => i + 1);
    }
  };

  const finishGame = (finalAnswers) => {
    timer.stop();
    setPhase('finished');
    const ans = finalAnswers || answersRef.current;
    const correct = ans.filter((a, i) => a === questions[i]?.answer).length;
    const wrong = ans.filter((a, i) => a !== null && a !== questions[i]?.answer).length;
    const elapsed = timer.getElapsedMs();
    
    // Simulate Rank Point change
    const oldRp = user?.current_rank_point || 1200;
    const rpChange = correct >= Math.ceil(questions.length * 0.7) ? 25 : correct >= Math.ceil(questions.length * 0.4) ? 5 : -15;
    const newRp = Math.max(0, oldRp + rpChange);
    
    if (user) {
      updateUser({ current_rank_point: newRp, total_matches: (user.total_matches || 0) + 1 });
    }

    const resultsData = { op, diff, correct, wrong, total: questions.length, maxStreak: maxStreakRef.current, elapsed, questions, answers: ans, oldRp, newRp, rpChange };
    sessionStorage.setItem('mathsprint_results', JSON.stringify(resultsData));
    setTimeout(() => navigate('/results'), 500);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); submitAnswer(); }
  };

  const q = questions[currentIdx];
  const progress = questions.length > 0 ? ((currentIdx) / questions.length) * 100 : 0;

  // Countdown Screen
  if (phase === 'countdown') {
    return (
      <div className="game-countdown">
        <div className="countdown-number" key={countdown} style={{ animation: 'countPulse 0.5s ease-out' }}>
          {countdown > 0 ? countdown : 'GO!'}
        </div>
        <p className="text-muted" style={{ marginTop: 16 }}>
          {totalQ} soal {OP_LABELS[op]} ({DIFF_LABELS[diff]}) dalam {timeLimit} detik
        </p>
      </div>
    );
  }

  // Playing Screen
  return (
    <div className="game-page">
      {/* Feedback flash */}
      {feedback && (
        <div className={`game-feedback ${feedback.type}`}>
          <span className="feedback-icon">{feedback.type === 'correct' ? '✅' : '❌'}</span>
          {feedback.type === 'wrong' && feedback.correctAnswer != null && (
            <span className="feedback-answer">Jawaban: {feedback.correctAnswer}</span>
          )}
        </div>
      )}

      {/* Top Bar */}
      <div className="game-topbar">
        <div className="topbar-left">
          <span className="badge badge-accent">Soal {currentIdx + 1}/{questions.length}</span>
        </div>
        <div className="topbar-center">
          <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--muted)' }}>
            {OP_LABELS[op]} • {DIFF_LABELS[diff]}
          </span>
        </div>
        <div className="topbar-right">
          <span className="timer-display" style={{ color: timer.timerColor, animation: timer.percent <= 10 ? 'timerPulse 0.5s infinite' : 'none' }}>
            {timer.seconds}s
          </span>
        </div>
      </div>

      {/* Timer Bar */}
      <div className="timer-bar">
        <div className="timer-bar-fill" style={{ width: `${timer.percent}%`, background: timer.timerColor, transition: 'width 0.1s linear' }} />
      </div>

      {/* Question */}
      <div className="game-main">
        {streak >= 3 && (
          <div className="streak-display animate-pop-in" key={streak}>
            🔥 Combo ×{streak}!
          </div>
        )}

        {q && (
          <div className="question-display animate-fade-in" key={currentIdx}>
            <span className="q-num">{q.num1}</span>
            <span className="q-op" style={{ color: OP_COLORS[op] }}>{OP_SYMBOLS[op]}</span>
            <span className="q-num">{q.num2}</span>
          </div>
        )}

        <div className="answer-area">
          <input ref={inputRef} className="answer-input" type="text" inputMode="numeric" pattern="[0-9]*"
            value={inputVal} onChange={e => setInputVal(e.target.value.replace(/[^0-9-]/g, ''))}
            onKeyDown={handleKeyDown} placeholder="?" autoComplete="off" id="answer-input" />
          <span className="game-hint">tekan ENTER untuk jawab · kosongkan untuk skip</span>
        </div>

        {/* Mobile Numpad */}
        <div className="mobile-numpad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button key={num} className="numpad-btn" onClick={() => setInputVal(v => v + num)}>{num}</button>
          ))}
          <button className="numpad-btn action" onClick={() => setInputVal(v => v.slice(0, -1))}>⌫</button>
          <button className="numpad-btn" onClick={() => setInputVal(v => v + '0')}>0</button>
          <button className="numpad-btn action enter" onClick={submitAnswer}>↵</button>
        </div>
      </div>

      {/* Progress dots */}
      <div className="progress-dots">
        {questions.map((_, i) => (
          <div key={i} className={`dot ${i < currentIdx ? (answers[i] === questions[i]?.answer ? 'correct' : 'wrong') : i === currentIdx ? 'current' : ''}`} />
        ))}
      </div>
    </div>
  );
}
