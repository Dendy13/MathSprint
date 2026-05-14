export function formatRP(rp) { return rp.toLocaleString('id-ID'); }
export function formatWinRate(wins, total) { return total > 0 ? ((wins / total) * 100).toFixed(1) : '0.0'; }
export function formatTime(ms) { const s = Math.floor(ms / 1000); const m = Math.floor(s / 60); return m > 0 ? `${m}m ${s % 60}s` : `${s}s`; }
export function formatTimeShort(seconds) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }
export function getStarEmoji(stars) { return ['☆☆☆', '⭐☆☆', '⭐⭐☆', '⭐⭐⭐'][stars] || '☆☆☆'; }
export function getStarMessage(stars) {
  const messages = ['Jangan menyerah! Coba lagi! 🌟', 'Sudah berani mencoba! 💪', 'Bagus sekali! 😊', 'Luar biasa! Sempurna! 🎉'];
  return messages[stars] || messages[0];
}
export function getRankTier(rp) {
  if (rp >= 2000) return { name: 'Grandmaster', emoji: '👑', color: 'var(--accent)' };
  if (rp >= 1600) return { name: 'Master', emoji: '💎', color: 'var(--purple)' };
  if (rp >= 1400) return { name: 'Expert', emoji: '⚡', color: 'var(--blue)' };
  if (rp >= 1200) return { name: 'Warrior', emoji: '⚔️', color: 'var(--green)' };
  if (rp >= 1000) return { name: 'Fighter', emoji: '🛡️', color: 'var(--orange)' };
  return { name: 'Rookie', emoji: '🌱', color: 'var(--muted)' };
}
