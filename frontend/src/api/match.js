import { get, post } from './client.js';
export const submitMatch = (data) => post('/match/submit', data);
export const getMatchHistory = (uid, limit = 50) => get(`/match/history/${uid}?limit=${limit}`);
export const getLeaderboard = (limit = 100) => get(`/match/leaderboard?limit=${limit}`);
