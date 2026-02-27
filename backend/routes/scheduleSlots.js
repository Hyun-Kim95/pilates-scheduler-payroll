import { Router } from 'express';
import { query } from '../config/db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

export const router = Router();

/** 목록: 기간/강사 필터. 강사는 본인 슬롯만 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { from, to, instructor_id } = req.query;
    let sql = `SELECT s.id,
                      s.instructor_id,
                      DATE_FORMAT(s.slot_date, '%Y-%m-%d') AS slot_date,
                      s.start_time,
                      s.end_time,
                      s.max_capacity,
                      s.created_at,
                      i.name AS instructor_name,
                      i.color,
                      COALESCE((SELECT COUNT(*) FROM reservations r WHERE r.schedule_slot_id = s.id AND r.status = 'confirmed'), 0) AS confirmed_count
               FROM schedule_slots s JOIN instructors i ON s.instructor_id = i.id WHERE 1=1`;
    const params = [];
    // instructor_id 쿼리 파라미터가 있는 경우에만 강사 필터 적용 (역할과 무관하게)
    if (instructor_id) {
      sql += ' AND s.instructor_id = ?';
      params.push(instructor_id);
    }
    if (from) {
      sql += ' AND s.slot_date >= ?';
      params.push(from);
    }
    if (to) {
      sql += ' AND s.slot_date <= ?';
      params.push(to);
    }
    sql += ' ORDER BY s.slot_date, s.start_time';
    const rows = await query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '슬롯 목록 조회 실패' });
  }
});

/** 단건 조회 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const [row] = await query(
      `SELECT s.id, s.instructor_id, DATE_FORMAT(s.slot_date, '%Y-%m-%d') AS slot_date, s.start_time, s.end_time, s.max_capacity, s.created_at, i.name AS instructor_name, i.color 
       FROM schedule_slots s JOIN instructors i ON s.instructor_id = i.id WHERE s.id = ?`,
      [req.params.id]
    );
    if (!row) return res.status(404).json({ error: '슬롯을 찾을 수 없습니다.' });
    if (req.user.role === 'instructor' && row.instructor_id !== req.user.instructorId) {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '슬롯 조회 실패' });
  }
});

const MIN_SLOT_HOURS = 2;

function timeToMinutes(t) {
  if (!t) return 0;
  const s = String(t).trim();
  if (s === '24:00' || s.startsWith('24:')) return 24 * 60;
  const parts = s.split(':');
  const h = Number(parts[0]) || 0;
  const m = Number(parts[1]) || 0;
  return h * 60 + m;
}

function isSlotDurationAtLeastTwoHours(startTime, endTime) {
  const start = timeToMinutes(startTime);
  let end = timeToMinutes(endTime);
  if (end <= start) end += 24 * 60;
  return (end - start) >= MIN_SLOT_HOURS * 60;
}

/** 같은 강사·같은 날짜·겹치는 시간 슬롯 존재 여부 */
async function hasOverlappingSlot(instructorId, slotDate, startTime, endTime, excludeSlotId = null) {
  let sql = `SELECT id FROM schedule_slots 
    WHERE instructor_id = ? AND slot_date = ? 
    AND start_time < ? AND end_time > ?`;
  const params = [instructorId, slotDate, endTime, startTime];
  if (excludeSlotId) {
    sql += ' AND id != ?';
    params.push(excludeSlotId);
  }
  const rows = await query(sql, params);
  return Array.isArray(rows) && rows.length > 0;
}

/** 생성: 관리자 또는 본인(강사) */
router.post('/', requireAuth, async (req, res) => {
  try {
    const { instructor_id, slot_date, start_time, end_time, max_capacity } = req.body || {};
    const targetInstructorId = req.user.role === 'admin' ? instructor_id : req.user.instructorId;
    if (!targetInstructorId || !slot_date || !start_time || !end_time) {
      return res.status(400).json({ error: '강사, 날짜, 시작/종료 시간은 필수입니다.' });
    }
    if (req.user.role === 'instructor' && Number(targetInstructorId) !== req.user.instructorId) {
      return res.status(403).json({ error: '본인 스케줄만 등록할 수 있습니다.' });
    }
    if (!isSlotDurationAtLeastTwoHours(start_time, end_time)) {
      return res.status(400).json({ error: '슬롯은 최소 2시간 이상이어야 합니다.' });
    }
    if (await hasOverlappingSlot(targetInstructorId, slot_date, start_time, end_time)) {
      return res.status(400).json({ error: '같은 강사의 같은 시간대에 이미 등록된 슬롯이 있습니다.' });
    }
    const capacity = Math.min(Number(max_capacity) || 6, 6);
    const r = await query(
      'INSERT INTO schedule_slots (instructor_id, slot_date, start_time, end_time, max_capacity) VALUES (?, ?, ?, ?, ?)',
      [targetInstructorId, slot_date, start_time, end_time, capacity]
    );
    const [row] = await query(
      `SELECT s.id, s.instructor_id, DATE_FORMAT(s.slot_date, '%Y-%m-%d') AS slot_date, s.start_time, s.end_time, s.max_capacity, s.created_at, i.name AS instructor_name, i.color 
       FROM schedule_slots s JOIN instructors i ON s.instructor_id = i.id WHERE s.id = ?`,
      [r.insertId]
    );
    res.status(201).json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '슬롯 등록 실패' });
  }
});

/** 수정 */
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const [existing] = await query(
      'SELECT id, instructor_id, slot_date, start_time, end_time FROM schedule_slots WHERE id = ?',
      [id]
    );
    if (!existing) return res.status(404).json({ error: '슬롯을 찾을 수 없습니다.' });
    if (req.user.role === 'instructor' && existing.instructor_id !== req.user.instructorId) {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }
    const { slot_date, start_time, end_time, max_capacity } = req.body || {};
    const finalDate = slot_date !== undefined ? slot_date : existing.slot_date;
    const finalStart = start_time !== undefined ? start_time : null;
    const finalEnd = end_time !== undefined ? end_time : null;
    const checkStart = finalStart ?? existing.start_time;
    const checkEnd = finalEnd ?? existing.end_time;
    if (checkStart && checkEnd && !isSlotDurationAtLeastTwoHours(checkStart, checkEnd)) {
      return res.status(400).json({ error: '슬롯은 최소 2시간 이상이어야 합니다.' });
    }
    if (finalStart != null || finalEnd != null || finalDate) {
      const checkDate = finalDate;
      if (checkDate && checkStart && checkEnd && await hasOverlappingSlot(existing.instructor_id, checkDate, checkStart, checkEnd, id)) {
        return res.status(400).json({ error: '같은 강사의 같은 시간대에 이미 등록된 슬롯이 있습니다.' });
      }
    }
    const updates = [];
    const params = [];
    if (slot_date !== undefined) { updates.push('slot_date = ?'); params.push(slot_date); }
    if (start_time !== undefined) { updates.push('start_time = ?'); params.push(start_time); }
    if (end_time !== undefined) { updates.push('end_time = ?'); params.push(end_time); }
    if (max_capacity !== undefined) { updates.push('max_capacity = ?'); params.push(Math.min(Number(max_capacity), 6)); }
    if (updates.length === 0) return res.status(400).json({ error: '수정할 필드가 없습니다.' });
    params.push(id);
    await query(`UPDATE schedule_slots SET ${updates.join(', ')} WHERE id = ?`, params);
    const [row] = await query(
      `SELECT s.id, s.instructor_id, s.slot_date, s.start_time, s.end_time, s.max_capacity, s.created_at, i.name AS instructor_name, i.color 
       FROM schedule_slots s JOIN instructors i ON s.instructor_id = i.id WHERE s.id = ?`,
      [id]
    );
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '슬롯 수정 실패' });
  }
});

/** 삭제 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const [existing] = await query('SELECT id, instructor_id FROM schedule_slots WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: '슬롯을 찾을 수 없습니다.' });
    if (req.user.role === 'instructor' && existing.instructor_id !== req.user.instructorId) {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }
    await query('DELETE FROM schedule_slots WHERE id = ?', [req.params.id]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '슬롯 삭제 실패' });
  }
});
