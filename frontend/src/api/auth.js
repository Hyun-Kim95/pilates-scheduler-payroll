import api from './client';

export function login(email, password) {
  return api.post('/auth/login', { email, password }).then((res) => res.data);
}

export function getMe() {
  return api.get('/auth/me').then((res) => res.data);
}

export function changePassword(current_password, new_password) {
  return api
    .patch('/auth/change-password', { current_password, new_password })
    .then((res) => res.data);
}
