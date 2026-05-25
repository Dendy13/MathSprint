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
  const ranks = [
    { name: 'Grandmaster', min: 2500, max: Infinity, color: 'var(--accent)', icon: 'fa-crown', hasDivisions: false },
    { name: 'Master', min: 2000, max: 2499, color: 'var(--purple)', icon: 'fa-gem', hasDivisions: false },
    { name: 'Diamond', min: 1600, max: 1999, color: '#38bdf8', icon: 'fa-diamond', hasDivisions: true },
    { name: 'Platinum', min: 1200, max: 1599, color: 'var(--green)', icon: 'fa-shield-cat', hasDivisions: true },
    { name: 'Gold', min: 800, max: 1199, color: 'var(--orange)', icon: 'fa-medal', hasDivisions: true },
    { name: 'Silver', min: 400, max: 799, color: 'var(--text-secondary)', icon: 'fa-shield-halved', hasDivisions: true },
    { name: 'Bronze', min: 0, max: 399, color: '#b45309', icon: 'fa-shield', hasDivisions: true }
  ];

  const rank = ranks.find(r => rp >= r.min) || ranks[ranks.length - 1];
  let division = '';
  let progress = 100;
  let nextRp = null;

  if (rank.hasDivisions) {
    const range = rank.max - rank.min + 1; // 400 points per rank
    const pointsInRank = rp - rank.min;
    
    // Sub-divisions: III (0-149), II (150-249), I (250-399)
    if (pointsInRank < 150) {
      division = 'III';
      nextRp = rank.min + 150;
      progress = (pointsInRank / 150) * 100;
    } else if (pointsInRank < 250) {
      division = 'II';
      nextRp = rank.min + 250;
      progress = ((pointsInRank - 150) / 100) * 100;
    } else {
      division = 'I';
      nextRp = rank.max + 1;
      progress = ((pointsInRank - 250) / 150) * 100;
    }
  } else {
    // No divisions for Master/GM
    if (rank.name === 'Master') {
      nextRp = 2500;
      progress = ((rp - 2000) / 500) * 100;
    } else {
      // GM
      progress = 100;
      nextRp = null;
    }
  }

  return {
    name: rank.name,
    division: division,
    fullName: division ? `${rank.name} ${division}` : rank.name,
    color: rank.color,
    icon: rank.icon,
    progress: Math.min(100, Math.max(0, progress)),
    nextRp: nextRp,
    currentRp: rp
  };
}
