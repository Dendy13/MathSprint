import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { formatRP, getRankTier } from '../utils/helpers.js';
import { ACCOUNT_LABELS } from '../utils/constants.js';
import './Navbar.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  if (!user) return null;

  const tier = getRankTier(user.current_rank_point ?? 100);
  const navLinks = [
    { to: '/', label: '🏠 Beranda', id: 'nav-home' },
    { to: '/leaderboard', label: '🏆 Peringkat', id: 'nav-leaderboard' },
    { to: '/friends', label: '👥 Teman', id: 'nav-friends' },
  ];
  if (user.account_type === 'developer') {
    navLinks.push({ to: '/admin', label: '⚙️ Admin', id: 'nav-admin' });
  }

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-brand">
          <span className="brand-icon">⚡</span>
          <span className="brand-text">MathSprint</span>
        </Link>
        <div className="navbar-links">
          {navLinks.map(l => (
            <Link key={l.id} to={l.to} id={l.id}
              className={`nav-link ${location.pathname === l.to ? 'active' : ''}`}>
              {l.label}
            </Link>
          ))}
        </div>
        <div className="navbar-user">
          <Link to="/profile" className="user-badge" style={{ textDecoration: 'none', cursor: 'pointer', transition: 'transform 0.2s' }} onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'} onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}>
            <span className="user-tier">{tier.emoji}</span>
            <div className="user-info">
              <span className="user-name">{user.display_name}</span>
              <span className="user-rp" style={{ color: tier.color }}>
                {formatRP(user.current_rank_point ?? 100)} RP
              </span>
            </div>
          </Link>
          <span className="badge badge-accent" style={{ fontSize: '0.65rem' }}>
            {ACCOUNT_LABELS[user.account_type] || 'Pemain'}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={logout} id="btn-logout">Keluar</button>
        </div>
      </div>
    </nav>
  );
}
