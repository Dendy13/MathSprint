import { get, post } from './client.js';
export const submitMatch = (data) => post('/match/submit', data);
export const submitSoloMatch = (data) => post('/match/submit-solo', data);
export const getMatchHistory = (uid, limit = 50) => get(`/match/history/${uid}?limit=${limit}`);
export const getLeaderboard = (limit = 100) => get(`/match/leaderboard?limit=${limit}`);
export const getSoloLeaderboard = (op = 'add', diff = 'easy', limit = 100) => get(`/match/leaderboard/solo?op=${op}&diff=${diff}&limit=${limit}`);
