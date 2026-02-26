import { Router } from 'express';
import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { sendReservationConfirmed, sendReservationCancelled } from '../services/notification.js';

const MAX_CAPACITY = 6;

/** 슬롯별 확정 예약 수 조회 */
async function getConfirmedCount(schedule_slot_id) {
  const rows = await query(
    'SELECT COUNT(*) AS cnt FROM reservations WHERE schedule_slot_id = ? AND status = ?',
    [schedule_slot_id, 'confirmed']
  );
  const r = Array.isArray(rows) ? rows[0] : rows;
  return r?.cnt ?? 0;
}

/** 슬롯의 max_capacity 조회 */
async function getSlotCapacity(schedule_slot_id) {
  const [s] = await query('SELECT max_capacity FROM schedule_slots WHERE id = ?', [schedule_slot_id]);
  return s?.max_capacity ?? MAX_CAPACITY;
}

export const router = Router();

/** 목록: 기간/슬롯/회원 필터. 강사는 본인 슬롯만 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { from, to, schedule_slot_id, member_id } = req.query;
    let sql = `SELECT r.id, r.schedule_slot_id, r.member_id, r.status, r.completed, r.created_at,
               s.slot_date, s.start_time, s.end_time, s.instructor_id, i.name AS instructor_name, i.color,
               m.name AS member_name, m.phone AS member_phone
               FROM reservations r
               JOIN schedule_slots s ON r.schedule_slot_id = s.id
               JOIN instructors i ON s.instructor_id = i.id
               JOIN members m ON r.member_id = m.id
               WHERE 1=1`;
    const params = [];
    if (req.user.role === 'instructor') {
      sql += ' AND s.instructor_id = ?';
      params.push(req.user.instructorId);
    }
    if (from) { sql += ' AND s.slot_date >= ?'; params.push(from); }
    if (to) { sql += ' AND s.slot_date <= ?'; params.push(to); }
    if (schedule_slot_id) { sql += ' AND r.schedule_slot_id = ?'; params.push(schedule_slot_id); }
    if (member_id) { sql += ' AND r.member_id = ?'; params.push(member_id); }
    sql += ' ORDER BY s.slot_date, s.start_time, r.id';
    const rows = await query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '예약 목록 조회 실패' });
  }
});

/** 단건 조회 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const [row] = await query(
      `SELECT r.id, r.schedule_slot_id, r.member_id, r.status, r.completed, r.reminder_sent_at, r.created_at,
       s.slot_date, s.start_time, s.end_time, s.instructor_id, i.name AS instructor_name, i.color,
       m.name AS member_name, m.phone AS member_phone
       FROM reservations r
       JOIN schedule_slots s ON r.schedule_slot_id = s.id
       JOIN instructors i ON s.instructor_id = i.id
       JOIN members m ON r.member_id = m.id
       WHERE r.id = ?`,
      [req.params.id]
    );
    if (!row) return res.status(404).json({ error: '예약을 찾을 수 없습니다.' });
    if (req.user.role === 'instructor' && row.instructor_id !== req.user.instructorId) {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '예약 조회 실패' });
  }
});

/** 예약 등록: 동시간대 6명(또는 슬롯 max_capacity) 검증 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const { schedule_slot_id, member_id } = req.body || {};
    if (!schedule_slot_id || !member_id) {
      return res.status(400).json({ error: '슬롯과 회원은 필수입니다.' });
    }
    const [slot] = await query('SELECT id, instructor_id, max_capacity FROM schedule_slots WHERE id = ?', [schedule_slot_id]);
    if (!slot) return res.status(404).json({ error: '슬롯을 찾을 수 없습니다.' });
    if (req.user.role === 'instructor' && slot.instructor_id !== req.user.instructorId) {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }
    const [member] = await query('SELECT id FROM members WHERE id = ?', [member_id]);
    if (!member) return res.status(404).json({ error: '회원을 찾을 수 없습니다.' });

    const confirmedCount = await getConfirmedCount(schedule_slot_id);
    const maxCap = Math.min(Number(slot.max_capacity) || 6, MAX_CAPACITY);
    if (confirmedCount >= maxCap) {
      return res.status(400).json({ error: `해당 시간대는 최대 ${maxCap}명까지 예약 가능합니다.` });
    }
    const r = await query(
      'INSERT INTO reservations (schedule_slot_id, member_id, status) VALUES (?, ?, ?)',
      [schedule_slot_id, member_id, 'confirmed']
    );
    const [slotInfo] = await query('SELECT s.slot_date, s.start_time, s.end_time, i.name AS instructor_name FROM schedule_slots s JOIN instructors i ON s.instructor_id = i.id WHERE s.id = ?', [schedule_slot_id]);
    const [memberInfo] = await query('SELECT name, phone FROM members WHERE id = ?', [member_id]);
    if (slotInfo && memberInfo?.phone) {
      sendReservationConfirmed(memberInfo.phone, {
        memberName: memberInfo.name,
        slotDate: slotInfo.slot_date,
        startTime: slotInfo.start_time,
        instructorName: slotInfo.instructor_name,
      }).catch(() => {});
    }
    const [row] = await query(
      `SELECT r.id, r.schedule_slot_id, r.member_id, r.status, r.completed, r.created_at,
       s.slot_date, s.start_time, s.end_time, i.name AS instructor_name, m.name AS member_name
       FROM reservations r
       JOIN schedule_slots s ON r.schedule_slot_id = s.id
       JOIN instructors i ON s.instructor_id = i.id
       JOIN members m ON r.member_id = m.id
       WHERE r.id = ?`,
      [r.insertId]
    );
    res.status(201).json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '예약 등록 실패' });
  }
});

/** 예약 취소 (상태만 cancelled로) */
router.patch('/:id/cancel', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const [existing] = await query(
      'SELECT r.id, s.instructor_id FROM reservations r JOIN schedule_slots s ON r.schedule_slot_id = s.id WHERE r.id = ?',
      [id]
    );
    if (!existing) return res.status(404).json({ error: '예약을 찾을 수 없습니다.' });
    if (req.user.role === 'instructor' && existing.instructor_id !== req.user.instructorId) {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }
    const [resInfo] = await query('SELECT m.name, m.phone, s.slot_date, s.start_time FROM reservations r JOIN members m ON r.member_id = m.id JOIN schedule_slots s ON r.schedule_slot_id = s.id WHERE r.id = ?', [id]);
    await query("UPDATE reservations SET status = 'cancelled' WHERE id = ?", [id]);
    if (resInfo?.phone) {
      sendReservationCancelled(resInfo.phone, { memberName: resInfo.name, slotDate: resInfo.slot_date, startTime: resInfo.start_time }).catch(() => {});
    }
    const [row] = await query(
      `SELECT r.id, r.schedule_slot_id, r.member_id, r.status, r.completed, r.created_at FROM reservations r WHERE r.id = ?`,
      [id]
    );
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '예약 취소 실패' });
  }
});

/** 예약 시간 변경 (다른 슬롯으로): 인원 제한 재검증 */
router.patch('/:id/move', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const { schedule_slot_id: new_slot_id } = req.body || {};
    if (!new_slot_id) return res.status(400).json({ error: '변경할 슬롯(schedule_slot_id)이 필요합니다.' });
    const [existing] = await query(
      'SELECT r.id, r.schedule_slot_id, s.instructor_id FROM reservations r JOIN schedule_slots s ON r.schedule_slot_id = s.id WHERE r.id = ?',
      [id]
    );
    if (!existing) return res.status(404).json({ error: '예약을 찾을 수 없습니다.' });
    if (req.user.role === 'instructor' && existing.instructor_id !== req.user.instructorId) {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }
    const [newSlot] = await query('SELECT id, instructor_id, max_capacity FROM schedule_slots WHERE id = ?', [new_slot_id]);
    if (!newSlot) return res.status(404).json({ error: '변경할 슬롯을 찾을 수 없습니다.' });
    const confirmedCount = await getConfirmedCount(new_slot_id);
    const maxCap = Math.min(Number(newSlot.max_capacity) || 6, MAX_CAPACITY);
    if (confirmedCount >= maxCap) {
      return res.status(400).json({ error: `해당 시간대는 최대 ${maxCap}명까지 예약 가능합니다.` });
    }
    const send_notification = req.body?.send_notification === true || req.body?.send_notification === 'true';
    await query('UPDATE reservations SET schedule_slot_id = ? WHERE id = ?', [new_slot_id, id]);
    if (send_notification) {
      const [memberRow] = await query('SELECT m.name, m.phone FROM reservations r JOIN members m ON r.member_id = m.id WHERE r.id = ?', [id]);
      const [slotRow] = await query('SELECT s.slot_date, s.start_time, i.name AS instructor_name FROM schedule_slots s JOIN instructors i ON s.instructor_id = i.id WHERE s.id = ?', [new_slot_id]);
      if (memberRow?.phone && slotRow) {
        sendReservationConfirmed(memberRow.phone, {
          memberName: memberRow.name,
          slotDate: slotRow.slot_date,
          startTime: slotRow.start_time,
          instructorName: slotRow.instructor_name,
        }).catch(() => {});
      }
    }
    const [row] = await query(
      `SELECT r.id, r.schedule_slot_id, r.member_id, r.status, r.completed, r.created_at,
       s.slot_date, s.start_time, s.end_time, i.name AS instructor_name
       FROM reservations r JOIN schedule_slots s ON r.schedule_slot_id = s.id JOIN instructors i ON s.instructor_id = i.id WHERE r.id = ?`,
      [id]
    );
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '예약 변경 실패' });
  }
});

/** 수업 완료 처리 (정산 반영용): 관리자 또는 해당 강사 */
router.patch('/:id/complete', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const [existing] = await query(
      'SELECT r.id, s.instructor_id FROM reservations r JOIN schedule_slots s ON r.schedule_slot_id = s.id WHERE r.id = ?',
      [id]
    );
    if (!existing) return res.status(404).json({ error: '예약을 찾을 수 없습니다.' });
    if (req.user.role === 'instructor' && existing.instructor_id !== req.user.instructorId) {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }
    await query('UPDATE reservations SET completed = 1 WHERE id = ? AND status = ?', [id, 'confirmed']);
    const [row] = await query('SELECT id, schedule_slot_id, member_id, status, completed FROM reservations WHERE id = ?', [id]);
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '완료 처리 실패' });
  }
});
