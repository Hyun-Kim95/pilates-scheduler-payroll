import { Router } from 'express';
import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { sendReservationConfirmed, sendReservationCancelled } from '../services/notification.js';

const MAX_CAPACITY = 6;

function timeToMinutes(t) {
  if (!t) return 0;
  const s = String(t).trim();
  const parts = s.split(':');
  const h = Number(parts[0]) || 0;
  const m = Number(parts[1]) || 0;
  return h * 60 + m;
}

function isTimeRangeWithinSlot(slotStart, slotEnd, resStart, resEnd) {
  const slotStartMin = timeToMinutes(slotStart);
  let slotEndMin = timeToMinutes(slotEnd);
  const resStartMin = timeToMinutes(resStart);
  let resEndMin = timeToMinutes(resEnd);
  if (slotEndMin <= slotStartMin) slotEndMin += 24 * 60;
  if (resEndMin <= resStartMin) resEndMin += 24 * 60;
  if (resEndMin <= resStartMin) return false;
  return resStartMin >= slotStartMin && resEndMin <= slotEndMin;
}

/** 회원이 해당 시간대와 겹치는 확정 예약 보유 여부 (동일 회원 기준)
 *  - 같은 날짜(slotDate) 안에서만 검사
 *  - [existing_start, existing_end) 와 [startTime, endTime) 이 진짜로 겹치는지 JS로 계산
 *  - 끝과 시작이 딱 맞닿는 경우(예: 16~17, 17~18)는 겹치지 않는 것으로 처리
 */
async function hasMemberOverlappingReservation(memberId, slotDate, startTime, endTime, excludeReservationId = null) {
  let sql = `SELECT r.id, r.start_time, r.end_time FROM reservations r
    JOIN schedule_slots s ON r.schedule_slot_id = s.id
    WHERE r.member_id = ? AND r.status = 'confirmed'
    AND s.slot_date = ?`;
  const params = [memberId, slotDate];
  if (excludeReservationId) {
    sql += ' AND r.id != ?';
    params.push(excludeReservationId);
  }
  const rows = await query(sql, params);
  if (!Array.isArray(rows) || rows.length === 0) return false;

  const newStart = timeToMinutes(startTime);
  const newEnd = timeToMinutes(endTime);
  if (!newStart && !newEnd) return false;

  // 두 구간 [aStart,aEnd), [bStart,bEnd) 가 겹치는지: !(aEnd <= bStart || aStart >= bEnd)
  return rows.some((r) => {
    const existStart = timeToMinutes(r.start_time);
    const existEnd = timeToMinutes(r.end_time);
    if (existEnd <= existStart) return false;
    if (newEnd <= newStart) return false;
    const noOverlap = (existEnd <= newStart) || (existStart >= newEnd);
    return !noOverlap;
  });
}

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

/** 목록: 기간/슬롯/회원 필터. 강사는 본인 슬롯만. 쿼리: limit, offset (페이지네이션). 응답: { items, total } */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { from, to, schedule_slot_id, member_id } = req.query;
    const limitNum = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 20), 100);
    const offsetNum = Math.max(0, parseInt(req.query.offset, 10) || 0);
    let whereSql = `FROM reservations r
               JOIN schedule_slots s ON r.schedule_slot_id = s.id
               JOIN instructors i ON s.instructor_id = i.id
               JOIN members m ON r.member_id = m.id
               WHERE 1=1`;
    const params = [];
    if (req.user.role === 'instructor') {
      whereSql += ' AND s.instructor_id = ?';
      params.push(req.user.instructorId);
    }
    if (from) { whereSql += ' AND s.slot_date >= ?'; params.push(from); }
    if (to) { whereSql += ' AND s.slot_date <= ?'; params.push(to); }
    if (schedule_slot_id) { whereSql += ' AND r.schedule_slot_id = ?'; params.push(schedule_slot_id); }
    if (member_id) { whereSql += ' AND r.member_id = ?'; params.push(member_id); }
    const [countRow] = await query(`SELECT COUNT(*) AS cnt ${whereSql}`, params);
    const total = Number(countRow?.cnt ?? 0);
    const sql = `SELECT r.id, r.schedule_slot_id, r.member_id, r.status, r.completed, r.created_at,
               r.start_time, r.end_time,
               DATE_FORMAT(s.slot_date, '%Y-%m-%d') AS slot_date, s.start_time AS slot_start_time, s.end_time AS slot_end_time, s.instructor_id,
               i.name AS instructor_name, i.color,
               m.name AS member_name, m.phone AS member_phone
               ${whereSql} ORDER BY s.slot_date, s.start_time, r.id LIMIT ${limitNum} OFFSET ${offsetNum}`;
    const rows = await query(sql, params);
    res.json({ items: rows, total });
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
       r.start_time, r.end_time,
       DATE_FORMAT(s.slot_date, '%Y-%m-%d') AS slot_date, s.start_time AS slot_start_time, s.end_time AS slot_end_time, s.instructor_id, i.name AS instructor_name, i.color,
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
    const { schedule_slot_id, member_id, start_time: reqStartTime, end_time: reqEndTime } = req.body || {};
    if (!schedule_slot_id || !member_id) {
      return res.status(400).json({ error: '슬롯과 회원은 필수입니다.' });
    }
    const [slot] = await query(
      'SELECT id, instructor_id, max_capacity, slot_date, start_time, end_time FROM schedule_slots WHERE id = ?',
      [schedule_slot_id]
    );
    if (!slot) return res.status(404).json({ error: '슬롯을 찾을 수 없습니다.' });
    if (req.user.role === 'instructor' && slot.instructor_id !== req.user.instructorId) {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }
    const [member] = await query('SELECT id, instructor_id FROM members WHERE id = ?', [member_id]);
    if (!member) return res.status(404).json({ error: '회원을 찾을 수 없습니다.' });

    const confirmedCount = await getConfirmedCount(schedule_slot_id);
    const maxCap = Math.min(Number(slot.max_capacity) || 6, MAX_CAPACITY);
    if (confirmedCount >= maxCap) {
      return res.status(400).json({ error: `해당 시간대는 최대 ${maxCap}명까지 예약 가능합니다.` });
    }

    const reservationStart = reqStartTime || slot.start_time;
    const reservationEnd = reqEndTime || slot.end_time;
    if (!reservationStart || !reservationEnd) {
      return res.status(400).json({ error: '시작/종료 시간은 필수입니다.' });
    }
    if (!isTimeRangeWithinSlot(slot.start_time, slot.end_time, reservationStart, reservationEnd)) {
      return res.status(400).json({ error: '예약 시간은 슬롯 시간 범위 안에 있어야 합니다.' });
    }
    if (await hasMemberOverlappingReservation(member_id, slot.slot_date, reservationStart, reservationEnd)) {
      return res.status(400).json({ error: '같은 회원이 해당 시간대에 이미 예약이 있습니다. 겹치는 시간에는 예약할 수 없습니다.' });
    }
    const r = await query(
      'INSERT INTO reservations (schedule_slot_id, member_id, start_time, end_time, status) VALUES (?, ?, ?, ?, ?)',
      [schedule_slot_id, member_id, reservationStart, reservationEnd, 'confirmed']
    );
    const [slotInfo] = await query("SELECT DATE_FORMAT(s.slot_date, '%Y-%m-%d') AS slot_date, s.start_time, s.end_time, i.name AS instructor_name FROM schedule_slots s JOIN instructors i ON s.instructor_id = i.id WHERE s.id = ?", [schedule_slot_id]);
    const [memberInfo] = await query('SELECT name, phone FROM members WHERE id = ?', [member_id]);
    if (slotInfo && memberInfo?.phone) {
      sendReservationConfirmed(memberInfo.phone, {
        memberName: memberInfo.name,
        slotDate: slotInfo.slot_date,
        startTime: reservationStart,
        instructorName: slotInfo.instructor_name,
      }).catch(() => {});
    }
    const [row] = await query(
      `SELECT r.id, r.schedule_slot_id, r.member_id, r.status, r.completed, r.created_at,
       r.start_time, r.end_time,
       DATE_FORMAT(s.slot_date, '%Y-%m-%d') AS slot_date, s.start_time AS slot_start_time, s.end_time AS slot_end_time,
       i.name AS instructor_name, m.name AS member_name
       FROM reservations r
       JOIN schedule_slots s ON r.schedule_slot_id = s.id
       JOIN instructors i ON s.instructor_id = i.id
       JOIN members m ON r.member_id = m.id
       WHERE r.id = ?`,
      [r.insertId]
    );
    const payload = { ...row };
    if (member.instructor_id != null && Number(member.instructor_id) !== Number(slot.instructor_id)) {
      payload.warning = '해당 회원의 담당 강사가 아닙니다.';
    }
    res.status(201).json(payload);
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

/** 취소 원복 (상태를 confirmed로 복구) */
router.patch('/:id/restore', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const [existing] = await query(
      'SELECT r.id, r.status, s.instructor_id FROM reservations r JOIN schedule_slots s ON r.schedule_slot_id = s.id WHERE r.id = ?',
      [id]
    );
    if (!existing) return res.status(404).json({ error: '예약을 찾을 수 없습니다.' });
    if (existing.status !== 'cancelled') {
      return res.status(400).json({ error: '취소된 예약만 원복할 수 있습니다.' });
    }
    if (req.user.role === 'instructor' && existing.instructor_id !== req.user.instructorId) {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }
    await query("UPDATE reservations SET status = 'confirmed' WHERE id = ?", [id]);
    const [row] = await query(
      `SELECT r.id, r.schedule_slot_id, r.member_id, r.status, r.completed, r.created_at FROM reservations r WHERE r.id = ?`,
      [id]
    );
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '취소 원복 실패' });
  }
});

/** 예약 시간 변경 (다른 슬롯으로): 인원 제한 재검증 */
router.patch('/:id/move', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const { schedule_slot_id: new_slot_id } = req.body || {};
    if (!new_slot_id) return res.status(400).json({ error: '변경할 슬롯(schedule_slot_id)이 필요합니다.' });
    const [existing] = await query(
      `SELECT r.id, r.schedule_slot_id, r.member_id, r.start_time, r.end_time,
              s.instructor_id, s.slot_date, s.start_time AS slot_start_time, s.end_time AS slot_end_time
       FROM reservations r
       JOIN schedule_slots s ON r.schedule_slot_id = s.id
       WHERE r.id = ?`,
      [id]
    );
    if (!existing) return res.status(404).json({ error: '예약을 찾을 수 없습니다.' });
    if (req.user.role === 'instructor' && existing.instructor_id !== req.user.instructorId) {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }
    const [newSlot] = await query('SELECT id, instructor_id, max_capacity, slot_date, start_time, end_time FROM schedule_slots WHERE id = ?', [new_slot_id]);
    if (!newSlot) return res.status(404).json({ error: '변경할 슬롯을 찾을 수 없습니다.' });
    const confirmedCount = await getConfirmedCount(new_slot_id);
    const maxCap = Math.min(Number(newSlot.max_capacity) || 6, MAX_CAPACITY);
    if (confirmedCount >= maxCap) {
      return res.status(400).json({ error: `해당 시간대는 최대 ${maxCap}명까지 예약 가능합니다.` });
    }

    const reservationStart = existing.start_time;
    const reservationEnd = existing.end_time;
    if (!isTimeRangeWithinSlot(newSlot.start_time, newSlot.end_time, reservationStart, reservationEnd)) {
      return res.status(400).json({ error: '예약 시간이 변경할 슬롯의 시간 범위를 벗어납니다.' });
    }

    if (await hasMemberOverlappingReservation(existing.member_id, newSlot.slot_date, reservationStart, reservationEnd, id)) {
      return res.status(400).json({ error: '같은 회원이 해당 시간대에 이미 예약이 있습니다. 겹치는 시간에는 예약할 수 없습니다.' });
    }
    const send_notification = req.body?.send_notification === true || req.body?.send_notification === 'true';
    await query('UPDATE reservations SET schedule_slot_id = ? WHERE id = ?', [new_slot_id, id]);
    if (send_notification) {
      const [memberRow] = await query('SELECT m.name, m.phone FROM reservations r JOIN members m ON r.member_id = m.id WHERE r.id = ?', [id]);
      const [slotRow] = await query("SELECT DATE_FORMAT(s.slot_date, '%Y-%m-%d') AS slot_date, s.start_time, i.name AS instructor_name FROM schedule_slots s JOIN instructors i ON s.instructor_id = i.id WHERE s.id = ?", [new_slot_id]);
      if (memberRow?.phone && slotRow) {
        sendReservationConfirmed(memberRow.phone, {
          memberName: memberRow.name,
          slotDate: slotRow.slot_date,
          startTime: reservationStart,
          instructorName: slotRow.instructor_name,
        }).catch(() => {});
      }
    }
    const [row] = await query(
      `SELECT r.id, r.schedule_slot_id, r.member_id, r.status, r.completed, r.created_at,
       r.start_time, r.end_time,
       DATE_FORMAT(s.slot_date, '%Y-%m-%d') AS slot_date, s.start_time AS slot_start_time, s.end_time AS slot_end_time, i.name AS instructor_name
       FROM reservations r JOIN schedule_slots s ON r.schedule_slot_id = s.id JOIN instructors i ON s.instructor_id = i.id WHERE r.id = ?`,
      [id]
    );
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '예약 변경 실패' });
  }
});

/** 예약 시간 수정 (동일 슬롯 내에서 시작/종료 시간 변경) */
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const { start_time: reqStartTime, end_time: reqEndTime } = req.body || {};
    if (reqStartTime === undefined && reqEndTime === undefined) {
      return res.status(400).json({ error: '수정할 시간이 없습니다.' });
    }
    const [existing] = await query(
      `SELECT r.id, r.schedule_slot_id, r.member_id, r.status, r.start_time, r.end_time,
              s.instructor_id, s.slot_date, s.start_time AS slot_start_time, s.end_time AS slot_end_time
       FROM reservations r
       JOIN schedule_slots s ON r.schedule_slot_id = s.id
       WHERE r.id = ?`,
      [id]
    );
    if (!existing) return res.status(404).json({ error: '예약을 찾을 수 없습니다.' });
    if (req.user.role === 'instructor' && existing.instructor_id !== req.user.instructorId) {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }
    const newStart = reqStartTime !== undefined ? reqStartTime : existing.start_time;
    const newEnd = reqEndTime !== undefined ? reqEndTime : existing.end_time;
    if (!newStart || !newEnd) {
      return res.status(400).json({ error: '시작/종료 시간은 필수입니다.' });
    }
    if (!isTimeRangeWithinSlot(existing.slot_start_time, existing.slot_end_time, newStart, newEnd)) {
      return res.status(400).json({ error: '예약 시간은 슬롯 시간 범위 안에 있어야 합니다.' });
    }
    if (await hasMemberOverlappingReservation(existing.member_id, existing.slot_date, newStart, newEnd, id)) {
      return res.status(400).json({ error: '같은 회원이 해당 시간대에 이미 예약이 있습니다. 겹치는 시간에는 예약할 수 없습니다.' });
    }
    const updates = [];
    const params = [];
    if (reqStartTime !== undefined) {
      updates.push('start_time = ?');
      params.push(newStart);
    }
    if (reqEndTime !== undefined) {
      updates.push('end_time = ?');
      params.push(newEnd);
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: '수정할 필드가 없습니다.' });
    }
    params.push(id);
    await query(`UPDATE reservations SET ${updates.join(', ')} WHERE id = ?`, params);
    const [row] = await query(
      `SELECT r.id, r.schedule_slot_id, r.member_id, r.status, r.completed, r.created_at,
       r.start_time, r.end_time,
       DATE_FORMAT(s.slot_date, '%Y-%m-%d') AS slot_date, s.start_time AS slot_start_time, s.end_time AS slot_end_time, i.name AS instructor_name, m.name AS member_name
       FROM reservations r
       JOIN schedule_slots s ON r.schedule_slot_id = s.id
       JOIN instructors i ON s.instructor_id = i.id
       JOIN members m ON r.member_id = m.id
       WHERE r.id = ?`,
      [id]
    );
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '예약 시간 수정 실패' });
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

/** 수업 완료 원복: 관리자 또는 해당 강사 */
router.patch('/:id/uncomplete', requireAuth, async (req, res) => {
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
    await query('UPDATE reservations SET completed = 0 WHERE id = ? AND status = ?', [id, 'confirmed']);
    const [row] = await query('SELECT id, schedule_slot_id, member_id, status, completed FROM reservations WHERE id = ?', [id]);
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '완료 원복 실패' });
  }
});
