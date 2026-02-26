/**
 * 리마인더 알림톡 스케줄러
 * - 매 10분마다 실행
 * - 당일 수업 중 현재 시각 ~ 1시간 이내 시작하는 확정 예약 중 reminder_sent_at 이 null 인 건에 대해 발송 후 갱신
 */

import { query } from '../config/db.js';
import { sendReminder } from '../services/notification.js';

const INTERVAL_MS = 10 * 60 * 1000; // 10분
const REMINDER_AHEAD_HOURS = 1;

let timer = null;

export function startReminderJob() {
  if (timer) return;
  const run = async () => {
    try {
      const rows = await query(
        `SELECT r.id, r.member_id, m.name AS member_name, m.phone, s.slot_date, s.start_time
         FROM reservations r
         JOIN members m ON r.member_id = m.id
         JOIN schedule_slots s ON r.schedule_slot_id = s.id
         WHERE r.status = 'confirmed'
           AND r.reminder_sent_at IS NULL
           AND s.slot_date = CURDATE()
           AND s.start_time >= CURTIME()
           AND s.start_time <= DATE_ADD(CURTIME(), INTERVAL ? HOUR)`,
        [REMINDER_AHEAD_HOURS]
      );
      for (const row of rows) {
        if (row.phone) {
          const sent = await sendReminder(row.phone, {
            memberName: row.member_name,
            slotDate: row.slot_date,
            startTime: row.start_time,
          });
          if (sent) {
            await query('UPDATE reservations SET reminder_sent_at = NOW() WHERE id = ?', [row.id]);
          }
        }
      }
    } catch (err) {
      console.error('Reminder job error:', err);
    }
  };
  run();
  timer = setInterval(run, INTERVAL_MS);
}

export function stopReminderJob() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
