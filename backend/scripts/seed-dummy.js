/**
 * 테스트용 더미 데이터 삽입
 * - 강사 3명 + 로그인 계정, 회원 10명, 오늘~10일 스케줄 슬롯, 예약(확정/완료/취소 골고루)
 * 실행: node scripts/seed-dummy.js (backend 디렉토리에서, 또는 npm run seed:dummy)
 * 한국 기준 '오늘'로 넣으려면: TZ=Asia/Seoul node scripts/seed-dummy.js (또는 Windows: set TZ=Asia/Seoul 후 실행)
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import { toLocalDateString } from '../utils/date.js';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pilates_scheduler',
});

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function run() {
  const conn = await pool.getConnection();
  try {
    console.log('테스트 더미 데이터 삽입 시작...');

    // 1) 강사 3명 (없으면 추가)
    const instructorNames = ['김필라', '이요가', '박필라'];
    let instructorRows = await conn.execute(
      'SELECT id, name FROM instructors WHERE name IN (?, ?, ?) ORDER BY name',
      instructorNames
    );
    instructorRows = instructorRows[0] || [];
    for (const name of instructorNames) {
      if (instructorRows.some((r) => r.name === name)) continue;
      const [r] = await conn.execute(
        `INSERT INTO instructors (name, color, rate_type, rate_value, base_salary, phone)
         VALUES (?, ?, 'fixed', 30000, 500000, ?)`,
        [name, name === '김필라' ? '#3498db' : name === '이요가' ? '#e74c3c' : '#2ecc71', '010-1111-2222']
      );
      instructorRows.push({ id: r.insertId, name });
      console.log(`강사 추가: ${name} (id=${r.insertId})`);
    }
    instructorRows.sort((a, b) => a.name.localeCompare(b.name));
    const id1 = instructorRows[0]?.id;
    const id2 = instructorRows[1]?.id;
    const id3 = instructorRows[2]?.id;
    if (!id1 || !id2 || !id3) throw new Error('강사 3명이 필요합니다.');

    // 1-2) 강사 로그인 계정
    const instructorPassword = 'test1234';
    const password_hash = await bcrypt.hash(instructorPassword, 10);
    const instructorAccounts = [
      { email: 'kim@pilates.local', instructor_id: id1, name: '김필라' },
      { email: 'lee@pilates.local', instructor_id: id2, name: '이요가' },
      { email: 'park@pilates.local', instructor_id: id3, name: '박필라' },
    ];
    for (const acc of instructorAccounts) {
      await conn.execute(
        `INSERT INTO users (email, password_hash, role, instructor_id)
         VALUES (?, ?, 'instructor', ?)
         ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), instructor_id = VALUES(instructor_id)`,
        [acc.email, password_hash, acc.instructor_id]
      );
      console.log(`강사 계정: ${acc.email} / ${instructorPassword} (${acc.name})`);
    }

    // 2) 회원 10명
    const members = [
      { name: '박회원', phone: '010-1234-5678', instructor_id: id1, memo: '테스트 회원1' },
      { name: '최회원', phone: '010-2345-6789', instructor_id: id1, memo: '' },
      { name: '정회원', phone: '010-3456-7890', instructor_id: id2, memo: '' },
      { name: '한회원', phone: '010-4567-8901', instructor_id: id2, memo: '' },
      { name: '오회원', phone: '010-5678-9012', instructor_id: null, memo: '' },
      { name: '강회원', phone: '010-6789-0123', instructor_id: id3, memo: '' },
      { name: '조회원', phone: '010-7890-1234', instructor_id: id3, memo: '' },
      { name: '윤회원', phone: '010-8901-2345', instructor_id: id1, memo: '' },
      { name: '임회원', phone: '010-9012-3456', instructor_id: id2, memo: '' },
      { name: '신회원', phone: '010-0123-4567', instructor_id: id3, memo: '' },
    ];
    for (const m of members) {
      const [ex] = await conn.execute('SELECT id FROM members WHERE name = ? AND phone = ?', [m.name, m.phone]);
      if (ex.length > 0) continue;
      await conn.execute(
        'INSERT INTO members (name, phone, instructor_id, memo) VALUES (?, ?, ?, ?)',
        [m.name, m.phone, m.instructor_id || null, m.memo || null]
      );
    }
    console.log('회원 10명 확인/추가됨');

    const [allMembersRows] = await conn.execute('SELECT id FROM members ORDER BY id DESC LIMIT 10');
    const usableMemberIds = (allMembersRows || []).map((row) => row.id);

    // 3) 스케줄 슬롯: 오늘부터 10일 (로컬 날짜 사용)
    const today = new Date();
    const slotDates = [];
    for (let d = 0; d < 10; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() + d);
      slotDates.push(toLocalDateString(date));
    }

    const placeholders = slotDates.map(() => '?').join(',');
    const [delResult] = await conn.execute(
      `DELETE FROM schedule_slots WHERE slot_date IN (${placeholders})`,
      slotDates
    );
    if (delResult.affectedRows > 0) {
      console.log(`기존 스케줄 슬롯 ${delResult.affectedRows}개 삭제됨 (해당 기간)`);
    }

    const slotsToInsert = [];
    for (const slotDate of slotDates) {
      slotsToInsert.push(
        [id1, slotDate, '09:00', '11:00', 6],
        [id1, slotDate, '14:00', '16:00', 6],
        [id2, slotDate, '10:00', '12:00', 6],
        [id2, slotDate, '15:00', '17:00', 6],
        [id3, slotDate, '11:00', '13:00', 6],
        [id3, slotDate, '16:00', '18:00', 6]
      );
    }

    const insertedSlotIds = [];
    for (const row of slotsToInsert) {
      const [r] = await conn.execute(
        `INSERT INTO schedule_slots (instructor_id, slot_date, start_time, end_time, max_capacity)
         VALUES (?, ?, ?, ?, ?)`,
        row
      );
      insertedSlotIds.push(r.insertId);
    }
    console.log(`스케줄 슬롯 ${insertedSlotIds.length}개 추가됨 (10일 × 강사3명 × 2타임)`);

    // 4) 예약: 여러 슬롯에 골고루 확정/완료/취소 분포 (같은 슬롯에 같은 회원 중복 X, 최대 6명)
    if (insertedSlotIds.length > 0 && usableMemberIds.length >= 3) {
      const statuses = ['confirmed', 'confirmed', 'confirmed', 'cancelled']; // 비율 대략 3:1
      const completedForConfirmed = [0, 0, 1]; // 확정 중 완료 비율
      let inserted = 0;
      const usedInSlot = new Map(); // slotId -> Set(memberId)

      const slotTimes = [['09:00', '10:00'], ['14:00', '15:00'], ['10:00', '11:00'], ['15:00', '16:00'], ['11:00', '12:00'], ['16:00', '17:00']];
      for (let i = 0; i < insertedSlotIds.length; i++) {
        const slotId = insertedSlotIds[i];
        if (!usedInSlot.has(slotId)) usedInSlot.set(slotId, new Set());
        const used = usedInSlot.get(slotId);
        const numRes = 2 + (i % 4); // 2~5명씩
        const shuffled = shuffle(usableMemberIds).filter((mid) => !used.has(mid)).slice(0, numRes);
        const [slotStart, slotEnd] = slotTimes[i % 6];

        for (let k = 0; k < shuffled.length; k++) {
          const memberId = shuffled[k];
          used.add(memberId);
          const status = statuses[k % statuses.length];
          const completed = status === 'confirmed' ? (completedForConfirmed[k % 3]) : 0;
          await conn.execute(
            `INSERT INTO reservations (schedule_slot_id, member_id, start_time, end_time, status, completed)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [slotId, memberId, slotStart, slotEnd, status, completed]
          );
          inserted++;
        }
      }
      console.log(`예약 ${inserted}건 추가 (확정/완료/취소 골고루 분포)`);
    }

    // 5) 정산 더미 (이번 달, 로컬)
    const yearMonth = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
    for (const iid of [id1, id2, id3]) {
      await conn.execute(
        `INSERT INTO payrolls (instructor_id, \`year_month\`, class_count, rate_amount, base_salary, total_amount)
         VALUES (?, ?, 8, 240000, 500000, 740000)
         ON DUPLICATE KEY UPDATE
         class_count = VALUES(class_count),
         rate_amount = VALUES(rate_amount),
         total_amount = VALUES(total_amount)`,
        [iid, yearMonth]
      );
    }
    console.log(`정산 데이터 ${yearMonth} 추가/갱신됨`);

    console.log('더미 데이터 삽입 완료.');
  } catch (err) {
    console.error('오류:', err);
    throw err;
  } finally {
    conn.release();
    await pool.end();
  }
}

run()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
