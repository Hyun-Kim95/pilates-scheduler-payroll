import api from './client';

export function login(email, password) {
  return api.post('/auth/login', { email, password }).then((res) => res.data);
}

export function getMe() {
  return api.get('/auth/me').then((res) => res.data);
}
