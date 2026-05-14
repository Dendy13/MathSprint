import { useState, useEffect, useRef, useCallback } from 'react';

export function useTimer(durationSeconds, onExpire) {
  const [remaining, setRemaining] = useState(durationSeconds * 1000);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef(null);
  const endTimeRef = useRef(null);

  const start = useCallback(() => {
    endTimeRef.current = Date.now() + durationSeconds * 1000;
    setIsRunning(true);
  }, [durationSeconds]);

  const stop = useCallback(() => {
    setIsRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const getElapsedMs = useCallback(() => {
    return (durationSeconds * 1000) - remaining;
  }, [durationSeconds, remaining]);

  useEffect(() => {
    if (!isRunning) return;
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const left = Math.max(0, endTimeRef.current - now);
      setRemaining(left);
      if (left <= 0) {
        clearInterval(intervalRef.current);
        setIsRunning(false);
        onExpire?.();
      }
    }, 100);
    return () => clearInterval(intervalRef.current);
  }, [isRunning, onExpire]);

  const percent = (remaining / (durationSeconds * 1000)) * 100;
  const seconds = Math.ceil(remaining / 1000);
  const timerColor = percent > 30 ? 'var(--green)' : percent > 10 ? 'var(--accent)' : 'var(--red)';

  return { remaining, seconds, percent, timerColor, isRunning, start, stop, getElapsedMs };
}
