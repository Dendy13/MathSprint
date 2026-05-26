import { get, post, put, del } from './client.js';
export const sendFriendRequest = (toUid) => post('/friend/request', { to_uid: toUid });
export const respondFriendRequest = (requestId, action) => put('/friend/respond', { request_id: requestId, action });
export const getFriendList = () => get('/friend/list');
export const removeFriend = (uid) => del(`/friend/remove/${uid}`);
export const inviteFriendToRoom = (data) => post('/friend/invite-room', data);
export const getPendingRequests = () => get('/friend/requests');
export const getRoomInvites = () => get('/friend/invites');
export const deleteRoomInvite = (roomId) => del(`/friend/invite/${roomId}`);
