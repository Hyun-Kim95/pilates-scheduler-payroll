import api from './client';

export function listReservations(params = {}) {
  return api.get('/reservations', { params }).then((res) => res.data);
}

export function createReservation(body) {
  return api.post('/reservations', body).then((res) => res.data);
}

export function cancelReservation(id) {
  return api.patch(`/reservations/${id}/cancel`).then((res) => res.data);
}

export function restoreReservation(id) {
  return api.patch(`/reservations/${id}/restore`).then((res) => res.data);
}

export function moveReservation(id, schedule_slot_id, options = {}) {
  return api
    .patch(`/reservations/${id}/move`, {
      schedule_slot_id,
      send_notification: options.send_notification ?? false,
    })
    .then((res) => res.data);
}

export function completeReservation(id) {
  return api.patch(`/reservations/${id}/complete`).then((res) => res.data);
}

export function uncompleteReservation(id) {
  return api.patch(`/reservations/${id}/uncomplete`).then((res) => res.data);
}
