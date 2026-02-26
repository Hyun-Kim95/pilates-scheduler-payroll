import api from './client';

export function listPayrolls(params = {}) {
  return api.get('/payrolls', { params }).then((res) => res.data);
}

export function computePayroll(year_month) {
  return api.post('/payrolls/compute', { year_month }).then((res) => res.data);
}

export function getPayroll(instructorId, yearMonth) {
  return api.get(`/payrolls/${instructorId}/${yearMonth}`).then((res) => res.data);
}
