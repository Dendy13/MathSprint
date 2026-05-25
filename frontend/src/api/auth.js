import { post, get, put } from './client.js';
export const register = (data) => post('/auth/register', data);
export const getProfile = () => get('/auth/profile');
export const updateProfile = (data) => put('/auth/profile', data);
export const getPublicProfile = (uid) => get(`/auth/profile/${uid}`);
export const getSystemConfig = () => get('/auth/config');
export const linkTeacher = (data) => post('/auth/link-teacher', data);
export const getTeacherStudents = () => get('/auth/teacher/students');
