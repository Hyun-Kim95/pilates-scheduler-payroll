import api from './client';

export function listScheduleSlots(params = {}) {
  return api.get('/schedule-slots', { params }).then((res) => res.data);
}

export function createScheduleSlot(body) {
  return api.post('/schedule-slots', body).then((res) => res.data);
}

export function updateScheduleSlot(id, body) {
  return api.patch(`/schedule-slots/${id}`, body).then((res) => res.data);
}

export function deleteScheduleSlot(id) {
  return api.delete(`/schedule-slots/${id}`);
}
