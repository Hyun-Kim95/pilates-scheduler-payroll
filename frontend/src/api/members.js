import api from './client';

export function listMembers(params = {}) {
  return api.get('/members', { params }).then((res) => res.data);
}

export function createMember(body) {
  return api.post('/members', body).then((res) => res.data);
}

export function updateMember(id, body) {
  return api.patch(`/members/${id}`, body).then((res) => res.data);
}

export function deleteMember(id) {
  return api.delete(`/members/${id}`);
}
