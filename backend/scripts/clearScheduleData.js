import { query } from '../config/db.js';

async function main() {
  try {
    console.log('Deleting reservations and schedule slots...');
    // 먼저 reservations 비우기
    await query('DELETE FROM reservations');
    // 슬롯 비우기 (ON DELETE CASCADE 가 있어도 한 번 더 확실히 정리)
    await query('DELETE FROM schedule_slots');
    console.log('Done.');
  } catch (err) {
    console.error('Error while clearing data:', err);
  } finally {
    // process exit는 db 풀에 따라 자동 정리
    process.exit(0);
  }
}

main();

