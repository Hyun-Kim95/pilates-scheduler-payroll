import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import { signToken, requireAuth } from '../middleware/auth.js';

export const router = Router();

/** POST /api/auth/login */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: '이메일과 비밀번호를 입력하세요.' });
    }
    const users = await query(
      'SELECT id, email, password_hash, role, instructor_id FROM users WHERE email = ?',
      [email]
    );
    const user = users[0];
    if (!user) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }
    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
      instructorId: user.instructor_id ?? null,
    });
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        instructorId: user.instructor_id,
      },
    });
  } catch (err) {
    console.error('Login error:', err.message || err);
    const code = err.code || err.errno;
    if (code === 'ECONNREFUSED' || code === 'ER_ACCESS_DENIED_ERROR') {
      return res.status(503).json({ error: 'DB 연결 실패. MySQL 실행 여부와 .env의 DB_PASSWORD를 확인하세요.' });
    }
    if (code === 'ER_BAD_DB_ERROR') {
      return res.status(503).json({ error: 'DB가 없습니다. schema.sql을 실행했는지 확인하세요.' });
    }
    if (code === 'ER_NO_SUCH_TABLE') {
      return res.status(503).json({ error: 'users 테이블이 없습니다. backend/db/schema.sql을 실행하세요.' });
    }
    if (code === 'ETIMEDOUT') {
      return res.status(503).json({ error: 'DB 연결 시간 초과. MySQL이 실행 중인지 확인하세요.' });
    }
    res.status(500).json({ error: '로그인 오류. 터미널(백엔드) 로그를 확인하고, 관리자 계정 생성: node scripts/seed-admin.js' });
  }
});

/** GET /api/auth/me - 현재 로그인 사용자 */
router.get('/me', requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      instructorId: req.user.instructorId,
    },
  });
});

/** PATCH /api/auth/change-password
 * body: { current_password, new_password }
 */
router.patch('/change-password', requireAuth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body || {};
    if (!current_password || !new_password) {
      return res.status(400).json({ error: '현재 비밀번호와 새 비밀번호를 모두 입력해야 합니다.' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ error: '새 비밀번호는 최소 6자 이상이어야 합니다.' });
    }
    const [user] = await query(
      'SELECT id, password_hash FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }
    const match = await bcrypt.compare(current_password, user.password_hash);
    if (!match) {
      return res.status(400).json({ error: '현재 비밀번호가 올바르지 않습니다.' });
    }
    const hash = await bcrypt.hash(new_password, 10);
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: '비밀번호 변경에 실패했습니다.' });
  }
});
