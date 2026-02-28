import { Router } from 'express';
import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { toLocalDateString } from '../utils/date.js';

export const router = Router();

/**
 * GET /statistics?from=YYYY-MM-DD&to=YYYY-MM-DD
 * 통계 일괄 조회 (요약, 강사별, 회원별, 예약 추이, 슬롯 가동률, 정산)
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const today = toLocalDateString(new Date());
    const from = req.query.from || today;
    const to = req.query.to || from;
    const instructorFilter = req.user.role === 'instructor' ? ' AND s.instructor_id = ?' : '';
    const instructorParam = req.user.role === 'instructor' ? [req.user.instructorId] : [];

    // ---- 1. 요약 (overview) ---- (query()는 행 배열 반환 → 첫 행을 사용)
    const baseParams = [from, to, ...instructorParam];
    const resCountsRows = await query(
      `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN r.status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed,
        SUM(CASE WHEN r.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
        SUM(CASE WHEN r.status = 'confirmed' AND r.completed = 1 THEN 1 ELSE 0 END) AS completed
       FROM reservations r
       JOIN schedule_slots s ON r.schedule_slot_id = s.id
       WHERE s.slot_date >= ? AND s.slot_date <= ? ${instructorFilter}`,
      baseParams
    );
    const resRow = resCountsRows[0] || {};
    const slotCountRows = await query(
      `SELECT COUNT(*) AS total_slots FROM schedule_slots s WHERE s.slot_date >= ? AND s.slot_date <= ? ${req.user.role === 'instructor' ? ' AND s.instructor_id = ?' : ''}`,
      baseParams
    );
    const memberCountRows = await query(
      `SELECT COUNT(*) AS total_members FROM members m WHERE 1=1 ${req.user.role === 'instructor' ? ' AND (m.instructor_id = ? OR m.instructor_id IS NULL)' : ''}`,
      req.user.role === 'instructor' ? instructorParam : []
    );
    const newMembersRows = await query(
      `SELECT COUNT(*) AS cnt FROM members m WHERE m.created_at >= ? AND m.created_at < DATE_ADD(?, INTERVAL 1 DAY) ${req.user.role === 'instructor' ? ' AND (m.instructor_id = ? OR m.instructor_id IS NULL)' : ''}`,
      [from, to, ...instructorParam]
    );
    const totalRes = Number(resRow.total) || 0;
    const confirmed = Number(resRow.confirmed) || 0;
    const overview = {
      total_reservations: totalRes,
      confirmed,
      cancelled: Number(resRow.cancelled) || 0,
      completed: Number(resRow.completed) || 0,
      total_slots: Number(slotCountRows[0]?.total_slots) || 0,
      total_members: Number(memberCountRows[0]?.total_members) || 0,
      new_members_period: Number(newMembersRows[0]?.cnt) || 0,
      completion_rate: confirmed > 0 ? Math.round((Number(resRow.completed) / confirmed) * 100) : 0,
      cancellation_rate: totalRes > 0 ? Math.round((Number(resRow.cancelled) / totalRes) * 100) : 0,
    };

    // ---- 2. 강사별 예약/완료/취소/슬롯 ----
    const byInstructorParams = [from, to, from, to];
    if (req.user.role === 'instructor') byInstructorParams.push(req.user.instructorId);
    const byInstructor = await query(
      `SELECT i.id AS instructor_id, i.name AS instructor_name,
        COUNT(DISTINCT r.id) AS reservations,
        COALESCE(SUM(CASE WHEN r.status = 'confirmed' AND r.completed = 1 THEN 1 ELSE 0 END), 0) AS completed,
        COALESCE(SUM(CASE WHEN r.status = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelled,
        (SELECT COUNT(*) FROM schedule_slots s2 WHERE s2.instructor_id = i.id AND s2.slot_date >= ? AND s2.slot_date <= ?) AS slots
       FROM instructors i
       LEFT JOIN schedule_slots s ON s.instructor_id = i.id AND s.slot_date >= ? AND s.slot_date <= ?
       LEFT JOIN reservations r ON r.schedule_slot_id = s.id
       WHERE 1=1 ${req.user.role === 'instructor' ? ' AND i.id = ?' : ''}
       GROUP BY i.id, i.name
       ORDER BY reservations DESC`,
      byInstructorParams
    );

    // ---- 3. 회원별 예약/완료 (상위 50명) ----
    const byMemberParams = [from, to];
    if (req.user.role === 'instructor') byMemberParams.push(req.user.instructorId);
    const byMember = await query(
      `SELECT m.id AS member_id, m.name AS member_name,
        COUNT(r.id) AS reservations,
        SUM(CASE WHEN r.completed = 1 THEN 1 ELSE 0 END) AS completed
       FROM members m
       JOIN reservations r ON r.member_id = m.id
       JOIN schedule_slots s ON r.schedule_slot_id = s.id
       WHERE s.slot_date >= ? AND s.slot_date <= ? AND r.status = 'confirmed' ${req.user.role === 'instructor' ? ' AND s.instructor_id = ?' : ''}
       GROUP BY m.id, m.name
       ORDER BY reservations DESC
       LIMIT 50`,
      byMemberParams
    );

    // ---- 4. 일별 예약 추이 (기간 내 날짜별) ----
    const trendParams = [from, to];
    if (req.user.role === 'instructor') trendParams.push(req.user.instructorId);
    const reservationTrend = await query(
      `SELECT DATE_FORMAT(s.slot_date, '%Y-%m-%d') AS date,
        COUNT(r.id) AS total,
        SUM(CASE WHEN r.status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed,
        SUM(CASE WHEN r.status = 'confirmed' AND r.completed = 1 THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN r.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled
       FROM schedule_slots s
       LEFT JOIN reservations r ON r.schedule_slot_id = s.id
       WHERE s.slot_date >= ? AND s.slot_date <= ? ${req.user.role === 'instructor' ? ' AND s.instructor_id = ?' : ''}
       GROUP BY s.slot_date
       ORDER BY s.slot_date`,
      trendParams
    );

    // ---- 5. 슬롯 가동률 (슬롯당 평균 예약 수, 총 가용 인원 대비 예약 인원) ----
    const slotStatsParams = [from, to];
    if (req.user.role === 'instructor') slotStatsParams.push(req.user.instructorId);
    const slotStatsRows = await query(
      `SELECT
        COUNT(DISTINCT s.id) AS total_slots,
        COALESCE(SUM(s.max_capacity), 0) AS total_capacity,
        (SELECT COUNT(*) FROM reservations r2 JOIN schedule_slots s2 ON r2.schedule_slot_id = s2.id
         WHERE s2.slot_date >= ? AND s2.slot_date <= ? AND r2.status = 'confirmed' ${req.user.role === 'instructor' ? ' AND s2.instructor_id = ?' : ''}) AS total_reservations
       FROM schedule_slots s
       WHERE s.slot_date >= ? AND s.slot_date <= ? ${req.user.role === 'instructor' ? ' AND s.instructor_id = ?' : ''}`,
      req.user.role === 'instructor' ? [from, to, req.user.instructorId, from, to, req.user.instructorId] : [from, to, from, to]
    );
    const slotStats = slotStatsRows[0] || {};
    const capacity = Number(slotStats.total_capacity) || 1;
    const slotUtilization = {
      total_slots: Number(slotStats.total_slots) || 0,
      total_capacity: Number(slotStats.total_capacity) || 0,
      total_reservations: Number(slotStats.total_reservations) || 0,
      utilization_percent: Math.round((Number(slotStats.total_reservations) / capacity) * 100),
      avg_per_slot: slotStats.total_slots > 0 ? (Number(slotStats.total_reservations) / Number(slotStats.total_slots)).toFixed(1) : 0,
    };

    // ---- 6. 정산 요약 (기간에 해당하는 year_month) ----
    const payrollSummary = await query(
      `SELECT p.year_month, i.id AS instructor_id, i.name AS instructor_name,
        p.class_count, p.rate_amount, p.base_salary, p.total_amount
       FROM payrolls p
       JOIN instructors i ON i.id = p.instructor_id
       WHERE p.year_month >= ? AND p.year_month <= ? ${req.user.role === 'instructor' ? ' AND p.instructor_id = ?' : ''}
       ORDER BY p.year_month DESC, i.name`,
      req.user.role === 'instructor' ? [from.slice(0, 7), to.slice(0, 7), req.user.instructorId] : [from.slice(0, 7), to.slice(0, 7)]
    );

    // ---- 7. 요일별 예약 분포 ----
    const weekdayParams = [from, to];
    if (req.user.role === 'instructor') weekdayParams.push(req.user.instructorId);
    const byWeekday = await query(
      `SELECT DAYOFWEEK(s.slot_date) AS day_of_week,
        COUNT(r.id) AS reservations
       FROM schedule_slots s
       LEFT JOIN reservations r ON r.schedule_slot_id = s.id AND r.status = 'confirmed'
       WHERE s.slot_date >= ? AND s.slot_date <= ? ${req.user.role === 'instructor' ? ' AND s.instructor_id = ?' : ''}
       GROUP BY DAYOFWEEK(s.slot_date)
       ORDER BY day_of_week`,
      weekdayParams
    );

    res.json({
      from,
      to,
      overview,
      by_instructor: byInstructor,
      by_member: byMember,
      reservation_trend: reservationTrend,
      slot_utilization: slotUtilization,
      payroll_summary: payrollSummary,
      by_weekday: byWeekday,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '통계 조회 실패' });
  }
});
