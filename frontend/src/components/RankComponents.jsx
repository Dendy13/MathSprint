import React from 'react';
import { getRankTier } from '../utils/helpers';
import './RankComponents.css';

export function RankBadge({ rp, size = 'md' }) {
  const tier = getRankTier(rp);
  
  return (
    <div className={`rank-badge rank-badge-${size}`} style={{ borderColor: tier.color }}>
      <div className="rank-icon" style={{ color: tier.color, textShadow: `0 0 10px ${tier.color}80` }}>
        <i className={`fa-solid ${tier.icon}`}></i>
      </div>
      <div className="rank-info">
        <span className="rank-name" style={{ color: tier.color }}>{tier.fullName}</span>
        <span className="rank-rp">{rp} RP</span>
      </div>
    </div>
  );
}

export function RankProgress({ rp }) {
  const tier = getRankTier(rp);
  
  if (!tier.nextRp) {
    return (
      <div className="rank-progress-container">
        <div className="rank-progress-labels">
          <span className="text-muted">Peringkat Tertinggi!</span>
        </div>
        <div className="rank-progress-bar">
          <div className="rank-progress-fill" style={{ width: '100%', background: tier.color }}></div>
        </div>
      </div>
    );
  }

  return (
    <div className="rank-progress-container">
      <div className="rank-progress-labels">
        <span style={{ color: tier.color, fontWeight: 'bold' }}>{tier.fullName}</span>
        <span className="text-muted" style={{ fontSize: '0.85rem' }}>{Math.floor(tier.nextRp - rp)} RP untuk naik peringkat</span>
      </div>
      <div className="rank-progress-bar">
        <div 
          className="rank-progress-fill" 
          style={{ width: `${tier.progress}%`, background: tier.color, boxShadow: `0 0 10px ${tier.color}80` }}
        ></div>
      </div>
    </div>
  );
}
