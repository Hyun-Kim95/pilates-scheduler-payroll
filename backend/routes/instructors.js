import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import { requireAuth, requireAdmin, requireInstructor } from '../middleware/auth.js';

export const router = Router();

/** 목록: 관리자 전체, 강사는 본인만. 쿼리: limit, offset (페이지네이션). 응답: { items, total } */
router.get('/', requireAuth, async (req, res) => {
  try {
    const limitNum = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 20), 100);
    const offsetNum = Math.max(0, parseInt(req.query.offset, 10) || 0);
    let whereSql = 'FROM instructors WHERE 1=1';
    const params = [];
    if (req.user.role === 'instructor') {
      whereSql += ' AND id = ?';
      params.push(req.user.instructorId);
    }
    const [countRow] = await query(`SELECT COUNT(*) AS cnt ${whereSql}`, params);
    const total = Number(countRow?.cnt ?? 0);
    const sql = `SELECT id, name, color, rate_type, rate_value, base_salary, phone, active, created_at ${whereSql} ORDER BY name LIMIT ${limitNum} OFFSET ${offsetNum}`;
    const rows = await query(sql, params);
    res.json({ items: rows, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '강사 목록 조회 실패' });
  }
});

/** 단건 조회 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const [row] = await query(
      'SELECT id, name, color, rate_type, rate_value, base_salary, phone, active, created_at FROM instructors WHERE id = ?',
      [req.params.id]
    );
    if (!row) return res.status(404).json({ error: '강사를 찾을 수 없습니다.' });
    if (req.user.role === 'instructor' && Number(req.params.id) !== req.user.instructorId) {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '강사 조회 실패' });
  }
});

/** 생성: 관리자만
 *  선택적으로 로그인 계정(users)도 함께 생성
 *  body: { name, color, rate_type, rate_value, base_salary, phone, login_email?, login_password? }
 */
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, color, rate_type, rate_value, base_salary, phone, login_email, login_password } = req.body || {};
    if (!name) return res.status(400).json({ error: '강사명은 필수입니다.' });

    // 1) 강사 정보 생성
    const r = await query(
      `INSERT INTO instructors (name, color, rate_type, rate_value, base_salary, phone) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        name,
        color || '#3498db',
        rate_type || 'fixed',
        Number(rate_value) || 0,
        Number(base_salary) || 0,
        phone || null,
      ]
    );
    const instructorId = r.insertId;

    // 2) 로그인 정보가 들어온 경우, users 계정도 생성
    if (login_email && login_password) {
      const existing = await query('SELECT id FROM users WHERE email = ?', [login_email]);
      if (existing.length > 0) {
        return res.status(400).json({ error: '이미 사용 중인 이메일입니다.' });
      }
      const hash = await bcrypt.hash(login_password, 10);
      await query(
        `INSERT INTO users (email, password_hash, role, instructor_id)
         VALUES (?, ?, 'instructor', ?)`,
        [login_email, hash, instructorId]
      );
    }

    const [row] = await query(
      'SELECT id, name, color, rate_type, rate_value, base_salary, phone, active, created_at FROM instructors WHERE id = ?',
      [instructorId]
    );
    res.status(201).json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '강사 등록 실패' });
  }
});

/** 수정: 관리자만 */
router.patch('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, color, rate_type, rate_value, base_salary, phone, active } = req.body || {};
    const id = req.params.id;
    const [existing] = await query('SELECT id FROM instructors WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: '강사를 찾을 수 없습니다.' });

    const updates = [];
    const params = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (color !== undefined) { updates.push('color = ?'); params.push(color); }
    if (rate_type !== undefined) { updates.push('rate_type = ?'); params.push(rate_type); }
    if (rate_value !== undefined) { updates.push('rate_value = ?'); params.push(Number(rate_value)); }
    if (base_salary !== undefined) { updates.push('base_salary = ?'); params.push(Number(base_salary)); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
    if (active !== undefined) { updates.push('active = ?'); params.push(active ? 1 : 0); }
    if (updates.length === 0) return res.status(400).json({ error: '수정할 필드가 없습니다.' });

    params.push(id);
    await query(`UPDATE instructors SET ${updates.join(', ')} WHERE id = ?`, params);
    const [row] = await query('SELECT id, name, color, rate_type, rate_value, base_salary, phone, active, created_at FROM instructors WHERE id = ?', [id]);
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '강사 수정 실패' });
  }
});

/** 삭제: 관리자만 */
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const r = await query('DELETE FROM instructors WHERE id = ?', [req.params.id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: '강사를 찾을 수 없습니다.' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '강사 삭제 실패' });
  }
});
