import api from './client';

export async function getHealth() {
  const { data } = await api.get('/health');
  return data;
}
