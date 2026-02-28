import api from './client';

export function getStatistics(params = {}) {
  return api.get('/statistics', { params }).then((res) => res.data);
}
