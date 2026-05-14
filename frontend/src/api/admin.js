import { get, post, del } from './client.js';
export const createToken = (data) => post('/admin/token/create', data);
export const listTokens = () => get('/admin/token/list');
export const revokeToken = (tokenId) => del(`/admin/token/${tokenId}`);
export const getSystemStats = () => get('/admin/stats');
