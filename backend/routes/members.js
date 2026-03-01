import { Router } from 'express';
import { query } from '../config/db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

export const router = Router();

/** 목록: 관리자 전체, 강사는 담당 회원만. 쿼리: limit, offset (페이지네이션). 응답: { items, total } */
router.get('/', requireAuth, async (req, res) => {
  try {
    const limitNum = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 20), 100);
    const offsetNum = Math.max(0, parseInt(req.query.offset, 10) || 0);
    let whereSql = 'FROM members m LEFT JOIN instructors i ON m.instructor_id = i.id WHERE 1=1';
    const params = [];
    if (req.user.role === 'instructor') {
      whereSql += ' AND m.instructor_id = ?';
      params.push(req.user.instructorId);
    }
    const [countRow] = await query(`SELECT COUNT(*) AS cnt ${whereSql}`, params);
    const total = Number(countRow?.cnt ?? 0);
    const sql = `SELECT m.id, m.name, m.phone, m.instructor_id, m.memo, m.active, m.created_at, i.name AS instructor_name ${whereSql} ORDER BY m.name LIMIT ${limitNum} OFFSET ${offsetNum}`;
    const rows = await query(sql, params);
    res.json({ items: rows, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '회원 목록 조회 실패' });
  }
});

/** 단건 조회 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const [row] = await query(
      `SELECT m.id, m.name, m.phone, m.instructor_id, m.memo, m.active, m.created_at, i.name AS instructor_name 
       FROM members m LEFT JOIN instructors i ON m.instructor_id = i.id WHERE m.id = ?`,
      [req.params.id]
    );
    if (!row) return res.status(404).json({ error: '회원을 찾을 수 없습니다.' });
    if (req.user.role === 'instructor' && row.instructor_id !== req.user.instructorId) {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '회원 조회 실패' });
  }
});

/** 생성: 관리자 또는 강사(본인 담당 회원만) */
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, phone, instructor_id, memo } = req.body || {};
    if (!name) return res.status(400).json({ error: '회원명은 필수입니다.' });
    let targetInstructorId = instructor_id || null;
    if (req.user.role === 'instructor') {
      // 강사는 항상 자신의 담당 회원만 등록
      targetInstructorId = req.user.instructorId ?? null;
    }
    const r = await query(
      'INSERT INTO members (name, phone, instructor_id, memo) VALUES (?, ?, ?, ?)',
      [name, phone || null, targetInstructorId, memo || null]
    );
    const [row] = await query(
      `SELECT m.id, m.name, m.phone, m.instructor_id, m.memo, m.active, m.created_at, i.name AS instructor_name 
       FROM members m LEFT JOIN instructors i ON m.instructor_id = i.id WHERE m.id = ?`,
      [r.insertId]
    );
    res.status(201).json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '회원 등록 실패' });
  }
});

/** 수정: 관리자 전체, 강사는 본인 담당 회원만 (제한된 필드) */
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { name, phone, instructor_id, memo, active } = req.body || {};
    const id = req.params.id;
    const [existing] = await query(
      'SELECT id, instructor_id FROM members WHERE id = ?',
      [id]
    );
    if (!existing) return res.status(404).json({ error: '회원을 찾을 수 없습니다.' });
    if (req.user.role === 'instructor' && existing.instructor_id !== req.user.instructorId) {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }

    const updates = [];
    const params = [];
    const isAdmin = req.user.role === 'admin';
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
    if (memo !== undefined) { updates.push('memo = ?'); params.push(memo); }
    // 담당 강사/활성 여부 변경은 관리자만 허용
    if (isAdmin && instructor_id !== undefined) { updates.push('instructor_id = ?'); params.push(instructor_id); }
    if (isAdmin && active !== undefined) { updates.push('active = ?'); params.push(active ? 1 : 0); }
    if (updates.length === 0) return res.status(400).json({ error: '수정할 필드가 없습니다.' });

    params.push(id);
    await query(`UPDATE members SET ${updates.join(', ')} WHERE id = ?`, params);
    const [row] = await query(
      `SELECT m.id, m.name, m.phone, m.instructor_id, m.memo, m.active, m.created_at, i.name AS instructor_name 
       FROM members m LEFT JOIN instructors i ON m.instructor_id = i.id WHERE m.id = ?`,
      [id]
    );
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '회원 수정 실패' });
  }
});

/** 삭제: 관리자만 */
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const r = await query('DELETE FROM members WHERE id = ?', [req.params.id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: '회원을 찾을 수 없습니다.' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '회원 삭제 실패' });
  }
});
