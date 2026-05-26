import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTimer } from '../hooks/useTimer.js';
import { getQuestion, getRoomQuestions, getRoomInfo, submitAnswer as apiSubmitAnswer } from '../api/game.js';
import { OP_SYMBOLS, OP_COLORS, OP_LABELS, DIFF_LABELS } from '../utils/constants.js';
import { db } from '../config/firebase.js';
import { doc, onSnapshot } from 'firebase/firestore';
import './GamePage.css';

export default function GamePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const op = params.get('op') || 'add';
  const diff = params.get('diff') || 'easy';
  const mode = params.get('mode') || 'solo';
  const roomId = params.get('roomId');
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
  const [opponents, setOpponents] = useState([]);
  const [waitingOpponent, setWaitingOpponent] = useState(false);
  const [isSpectator, setIsSpectator] = useState(false);
  const [roomData, setRoomData] = useState(null);
  const inputRef = useRef(null);

  const onTimerExpire = useCallback(() => {
    if (phase === 'playing') {
      // Small delay to allow final render before finish
      setTimeout(() => finishGameRef.current(), 100);
    }
  }, [phase]);

  const timer = useTimer(mode === 'solo' ? 60 : timeLimit, onTimerExpire);
  
  // Create a mutable ref to finishGame so the timer can access the latest state
  const finishGameRef = useRef(() => {});

  // Generate or Load questions on mount
  useEffect(() => {
    const loadQuestions = async () => {
      try {
        if (mode === 'multi' && roomId) {
          const roomInfo = await getRoomInfo(roomId);
          const spectatorCheck = roomInfo.spectators && roomInfo.spectators[user?.uid];
          setIsSpectator(!!spectatorCheck);
          setRoomData(roomInfo);

          if (!spectatorCheck) {
            const qs = await getRoomQuestions(roomId);
            setQuestions(qs);
            setAnswers(new Array(qs.length).fill(null));
          }
        } else {
          // Endless Solo Mode: Fetch 100 questions
          const { getQuestionStack } = await import('../api/game.js');
          const res = await getQuestionStack({ op, diff, count: 100 });
          setQuestions(res.questions);
          setAnswers(new Array(res.questions.length).fill(null));
        }
      } catch (err) {
        console.error("Gagal memuat soal", err);
      }
    };
    loadQuestions();
  }, [op, diff, mode, roomId, user]);

  // Realtime Opponent in Multiplayer
  useEffect(() => {
    if (mode !== 'multi' || !roomId) return;
    if (phase !== 'playing' && phase !== 'finished') return;

    let isMounted = true;

    const unsubscribe = onSnapshot(doc(db, 'rooms', roomId), (snapshot) => {
      if (!isMounted) return;
      if (!snapshot.exists()) return;

      const room = snapshot.data();
      setRoomData(room);

      if (!isSpectator) {
        // Find opponents
        const players = Object.values(room.players || {});
        const opps = players.filter(p => p.uid !== user?.uid);
        setOpponents(opps);

        // Check if room is finished (meaning both finished)
        if (room.status === 'finished' && phase === 'finished') {
           navigate(`/results?mode=multi&roomId=${roomId}`);
        }
      } else {
        // If Spectator, check if room is finished, then wait a bit
        if (room.status === 'finished') {
           setTimeout(() => { if(isMounted) navigate(`/room/${roomId}`) }, 5000); // Back to waiting room or somewhere
        }
      }
    }, (error) => {
      console.error("Realtime room error:", error);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [mode, roomId, phase, isSpectator, navigate, user]);

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

    // Submit to backend asynchronously if multiplayer
    if (mode === 'multi' && roomId && userAns !== null) {
      apiSubmitAnswer(roomId, { room_id: roomId, question_index: currentIdx, answer: userAns }).catch(() => {});
    }

    setInputVal('');
    if (currentIdx + 1 >= questions.length) {
      setTimeout(() => finishGame(newAnswers), 300);
    } else {
      setCurrentIdx(i => i + 1);
    }
  };

  const finishGame = async (finalAnswers) => {
    timer.stop();
    setPhase('finished');
    const ans = finalAnswers || answersRef.current;
    
    // Calculate based on the number of answered questions
    const answeredCount = mode === 'solo' ? currentIdx + (ans[currentIdx] !== null ? 1 : 0) : questions.length;
    
    // We only evaluate up to answeredCount
    const evaluatedAnswers = ans.slice(0, answeredCount);
    const correct = evaluatedAnswers.filter((a, i) => a === questions[i]?.answer).length;
    const wrong = evaluatedAnswers.filter((a, i) => a !== null && a !== questions[i]?.answer).length;
    const elapsed = timer.getElapsedMs();
    
    if (mode === 'multi') {
      setWaitingOpponent(true);
      // Let the polling effect navigate to results once room is FINISHED
      return;
    }

    let oldRp = user?.current_rank_point ?? 100;
    let newRp = oldRp;
    let rpChange = 0;
    let score = 0;

    if (user) {
      try {
        const { submitSoloMatch } = await import('../api/match.js');
        const res = await submitSoloMatch({
          op, diff, correct, wrong, total: answeredCount,
          max_streak: maxStreakRef.current, elapsed_seconds: Math.floor(elapsed / 1000)
        });
        oldRp = res.old_rp;
        newRp = res.new_rp;
        rpChange = res.rp_change;
        score = res.score;
        updateUser({ current_rank_point: newRp, total_matches: (user.total_matches || 0) + 1 });
      } catch (err) {
        console.error("Gagal submit match:", err);
      }
    }

    const resultsData = { op, diff, correct, wrong, total: answeredCount, maxStreak: maxStreakRef.current, elapsed, questions: questions.slice(0, answeredCount), answers: evaluatedAnswers, oldRp, newRp, rpChange, score };
    sessionStorage.setItem('mathsprint_results', JSON.stringify(resultsData));
    setTimeout(() => navigate('/results'), 500);
  };
  
  // Assign finishGame to the ref
  finishGameRef.current = finishGame;

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); submitAnswer(); }
  };

  const q = questions[currentIdx];
  const progress = questions.length > 0 ? ((currentIdx) / questions.length) * 100 : 0;

  // Spectator Screen
  if (isSpectator) {
    const players = Object.values(roomData?.players || {});
    return (
      <div className="game-page" style={{ padding: 20 }}>
        <h2 style={{ textAlign: 'center', marginBottom: 20 }}>👀 Spectator Mode</h2>
        <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap' }}>
          {players.map((p, idx) => (
            <div key={p.uid} className="card" style={{ flex: '1 1 300px', padding: 20, textAlign: 'center' }}>
              <h3>{p.display_name}</h3>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', margin: '16px 0', color: 'var(--accent)' }}>
                {p.score || 0}
              </div>
              {p.finished_at ? (
                <span className="badge badge-green">SELESAI</span>
              ) : (
                <span className="badge badge-accent">BERMAIN</span>
              )}
            </div>
          ))}
        </div>
        {roomData?.status === 'finished' && (
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <h3 className="text-green">Game Selesai!</h3>
            <p className="text-muted">Kembali ke room dalam beberapa detik...</p>
          </div>
        )}
      </div>
    );
  }

  // Countdown Screen
  if (phase === 'countdown') {
    return (
      <div className="game-countdown">
        <div className="countdown-number" key={countdown} style={{ animation: 'countPulse 0.5s ease-out' }}>
          {countdown > 0 ? countdown : 'GO!'}
        </div>
        <p className="text-muted" style={{ marginTop: 16 }}>
          {mode === 'solo' ? 'Mode Tanpa Batas' : `${questions.length || totalQ} soal`} • {OP_LABELS[op]} ({DIFF_LABELS[diff]}) dalam {timeLimit} detik
        </p>
      </div>
    );
  }

  // Waiting Opponent Screen
  if (waitingOpponent) {
    return (
      <div className="page text-center" style={{ paddingTop: '20vh' }}>
        <span className="spinner" style={{ width: 40, height: 40, borderWidth: 4 }} />
        <h2 className="mt-4">Selesai!</h2>
        <p className="text-muted">Menunggu pemain lain menyelesaikan soal...</p>
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
          <span className="badge badge-accent">
            {mode === 'solo' ? `Skor: ${currentIdx}` : `Soal ${currentIdx + 1}/${questions.length}`}
          </span>
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

      {/* Opponents Progress (Multiplayer only) */}
      {mode === 'multi' && roomData && (
        <div className="opponent-progress" style={{ margin: '0 1rem 1rem 1rem', padding: '0.5rem', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: '0.8rem' }}>
          {roomData.max_players > 4 ? (
            // Mini Leaderboard for Classroom Mode
            <div style={{ display: 'flex', justifyContent: 'space-around', gap: '8px' }}>
              {Object.values(roomData.players || {})
                .sort((a, b) => b.score - a.score)
                .slice(0, 3)
                .map((p, idx) => (
                  <div key={p.uid} style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ color: idx === 0 ? 'gold' : idx === 1 ? 'silver' : '#cd7f32' }}>
                      #{idx + 1} {p.display_name}
                    </div>
                    <div className="text-accent">{p.score} pts</div>
                  </div>
              ))}
            </div>
          ) : (
            // Individual bars for 1v1 / FFA up to 4
            opponents.map(opp => (
              <div key={opp.uid} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span className="text-muted">{opp.display_name}</span>
                  <span className="text-accent">{opp.correct_answers} Benar</span>
                </div>
                <div style={{ height: 4, background: 'var(--bg)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'var(--accent)', width: `${(opp.current_question_index / questions.length) * 100}%`, transition: 'width 0.3s ease' }} />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Question */}
      <div className="game-main">
        <div 
          className="streak-display" 
          key="streak-badge"
          style={{ 
            opacity: streak >= 3 ? 1 : 0, 
            transform: streak >= 3 ? 'scale(1)' : 'scale(0.8)',
            transition: 'all 0.2s ease-out',
            pointerEvents: 'none',
            marginBottom: streak >= 3 ? '0' : '-32px'
          }}
        >
          {streak >= 3 ? `🔥 Combo ×${streak}!` : '\u00A0'}
        </div>

        {q && (
          <div className="question-display animate-fade-in" key={currentIdx}>
            <span className="q-num">{q.num1}</span>
            <span className="q-op" style={{ color: OP_COLORS[op] }}>{OP_SYMBOLS[op]}</span>
            <span className="q-num">{q.num2}</span>
          </div>
        )}

        <div className="answer-area">
          <input ref={inputRef} className="answer-input" type="text" inputMode="none" pattern="[0-9]*"
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
      {mode !== 'solo' && (
        <div className="progress-dots">
          {questions.map((_, i) => (
            <div key={i} className={`dot ${i < currentIdx ? (answers[i] === questions[i]?.answer ? 'correct' : 'wrong') : i === currentIdx ? 'current' : ''}`} />
          ))}
        </div>
      )}
    </div>
  );
}
