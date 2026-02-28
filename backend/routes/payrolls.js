import { Router } from 'express';
import { query } from '../config/db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { toLocalYearMonthString } from '../utils/date.js';

/** 월별 정산 계산: (완료된 확정 수업 수 × 요율) + 기본급. 취소/미완료 제외 */
async function computePayroll(instructor_id, year_month) {
  const [inst] = await query(
    'SELECT id, rate_type, rate_value, base_salary FROM instructors WHERE id = ?',
    [instructor_id]
  );
  if (!inst) return null;
  const [ym] = await query(
    `SELECT COUNT(*) AS cnt FROM reservations r
     JOIN schedule_slots s ON r.schedule_slot_id = s.id
     WHERE s.instructor_id = ? AND r.status = 'confirmed' AND r.completed = 1
     AND DATE_FORMAT(s.slot_date, '%Y-%m') = ?`,
    [instructor_id, year_month]
  );
  const class_count = Number(ym?.cnt ?? 0);
  let rate_amount = 0;
  if (inst.rate_type === 'fixed') {
    rate_amount = class_count * Number(inst.rate_value) || 0;
  } else {
    // percent: 수업당 금액이 별도 설정이 없다면 0으로 두거나, 나중에 수익 기반 계산 확장
    rate_amount = class_count * Number(inst.rate_value) || 0;
  }
  const base_salary = Number(inst.base_salary) || 0;
  const total_amount = rate_amount + base_salary;
  return { class_count, rate_amount, base_salary, total_amount };
}

export const router = Router();

/** 정산 목록/조회: 관리자만. 강사별·월별 */
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { year_month, instructor_id } = req.query;
    let sql = `SELECT p.id, p.instructor_id, p.\`year_month\`, p.class_count, p.rate_amount, p.base_salary, p.total_amount, p.created_at, i.name AS instructor_name 
               FROM payrolls p JOIN instructors i ON p.instructor_id = i.id WHERE 1=1`;
    const params = [];
    if (year_month) { sql += ' AND p.`year_month` = ?'; params.push(year_month); }
    if (instructor_id) { sql += ' AND p.instructor_id = ?'; params.push(instructor_id); }
    sql += ' ORDER BY p.`year_month` DESC, i.name';
    const rows = await query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '정산 목록 조회 실패' });
  }
});

/** 특정 월 정산 계산 및 저장(upsert): 관리자만 */
router.post('/compute', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { year_month } = req.body || {};
    const ym = year_month || toLocalYearMonthString(new Date());
    if (!/^\d{4}-\d{2}$/.test(ym)) {
      return res.status(400).json({ error: 'year_month는 YYYY-MM 형식이어야 합니다.' });
    }
    const instructors = await query('SELECT id FROM instructors WHERE active = 1');
    const results = [];
    for (const inst of instructors) {
      const instructor_id = inst?.id ?? inst?.ID;
      if (instructor_id == null) continue;
      const computed = await computePayroll(instructor_id, ym);
      if (!computed) continue;
      const class_count = Number(computed.class_count) || 0;
      const rate_amount = Number(computed.rate_amount) || 0;
      const base_salary = Number(computed.base_salary) || 0;
      const total_amount = Number(computed.total_amount) || 0;
      await query(
        `INSERT INTO payrolls (instructor_id, \`year_month\`, class_count, rate_amount, base_salary, total_amount)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE class_count = VALUES(class_count), rate_amount = VALUES(rate_amount),
         base_salary = VALUES(base_salary), total_amount = VALUES(total_amount), updated_at = CURRENT_TIMESTAMP`,
        [instructor_id, ym, class_count, rate_amount, base_salary, total_amount]
      );
      const [row] = await query(
        `SELECT p.id, p.instructor_id, p.\`year_month\`, p.class_count, p.rate_amount, p.base_salary, p.total_amount, i.name AS instructor_name
         FROM payrolls p JOIN instructors i ON p.instructor_id = i.id WHERE p.instructor_id = ? AND p.\`year_month\` = ?`,
        [instructor_id, ym]
      );
      if (row) results.push(row);
    }
    res.json({ year_month: ym, items: results });
  } catch (err) {
    console.error('Payroll compute error:', err);
    const message = err.message || '정산 계산 실패';
    res.status(500).json({ error: message });
  }
});

/** 강사별 월 정산 단건 조회: 관리자 전체, 강사는 본인만 */
router.get('/:instructorId/:yearMonth', requireAuth, async (req, res) => {
  try {
    const { instructorId, yearMonth } = req.params;
    if (req.user.role === 'instructor' && Number(instructorId) !== req.user.instructorId) {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }
    const [row] = await query(
      `SELECT p.id, p.instructor_id, p.\`year_month\`, p.class_count, p.rate_amount, p.base_salary, p.total_amount, p.created_at, i.name AS instructor_name 
       FROM payrolls p JOIN instructors i ON p.instructor_id = i.id WHERE p.instructor_id = ? AND p.\`year_month\` = ?`,
      [instructorId, yearMonth]
    );
    if (!row) return res.status(404).json({ error: '해당 월 정산 내역이 없습니다.' });
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '정산 조회 실패' });
  }
});
