import api from './client';

export function listInstructors() {
  return api.get('/instructors').then((res) => res.data);
}

export function getInstructor(id) {
  return api.get(`/instructors/${id}`).then((res) => res.data);
}

export function createInstructor(body) {
  return api.post('/instructors', body).then((res) => res.data);
}

export function updateInstructor(id, body) {
  return api.patch(`/instructors/${id}`, body).then((res) => res.data);
}

export function deleteInstructor(id) {
  return api.delete(`/instructors/${id}`);
}
