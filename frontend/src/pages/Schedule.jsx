import { useState, useEffect } from 'react';
import { listScheduleSlots, createScheduleSlot, updateScheduleSlot, deleteScheduleSlot } from '../api/scheduleSlots';
import { listReservations, moveReservation, createReservation, cancelReservation } from '../api/reservations';
import { listInstructors } from '../api/instructors';
import { listMembers } from '../api/members';
import './Schedule.css';

/** 로컬 날짜 YYYY-MM-DD (toISOString 사용 시 UTC로 하루 밀릴 수 있음) */
function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function getWeekStart(d) {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function timeToMinutes(time) {
  if (!time) return 0;
  const parts = String(time).split(':');
  const h = Number(parts[0] || 0);
  const m = Number(parts[1] || 0);
  return h * 60 + m;
}

const MIN_SLOT_HOURS = 2;

/** 시 선택용 옵션 (0~23시, HH:00 형식). 시작은 0~22만 (종료 최소 2시간 확보) */
const HOUR_OPTIONS_START = Array.from({ length: 23 }, (_, h) => ({
  value: `${String(h).padStart(2, '0')}:00`,
  label: `${h}시`,
}));

/** 종료 시 옵션: 시작 시각 기준 최소 2시간 이후부터 24시까지 */
function getEndHourOptions(startTimeStr) {
  const startH = startTimeStr ? Number(String(startTimeStr).split(':')[0]) || 0 : 0;
  const minEndH = startH + MIN_SLOT_HOURS;
  return Array.from({ length: 25 - minEndH }, (_, i) => {
    const h = minEndH + i;
    const value = h < 24 ? `${String(h).padStart(2, '0')}:00` : '24:00';
    const label = `${h}시`;
    return { value, label };
  });
}

/** 시간 표시용: "09:00", "13:30" → "9~13" (시만) */
export function timeRangeDisplay(startTime, endTime) {
  const h = (t) => {
    if (!t) return '';
    const n = Number(String(t).trim().split(':')[0]);
    return Number.isNaN(n) ? '' : n;
  };
  const s = h(startTime);
  const e = h(endTime);
  if (s === '' && e === '') return '';
  if (s === e) return String(s);
  return `${s}~${e}`;
}

// 같은 날짜의 슬롯들에 대해 겹침을 계산해 column 배치 정보 추가
function layoutDaySlots(daySlots) {
  const slotsWithTime = daySlots
    .map((s) => {
      const start = timeToMinutes(s.start_time);
      const endRaw = timeToMinutes(s.end_time);
      const end = endRaw > start ? endRaw : start + 60;
      return { ...s, _start: start, _end: end };
    })
    .sort((a, b) => a._start - b._start || a._end - b._end);

  // 1) 먼저 겹치지 않도록 column index만 배치
  const columnsEnd = [];
  const placed = [];

  for (const slot of slotsWithTime) {
    let colIndex = 0;
    while (colIndex < columnsEnd.length && slot._start < columnsEnd[colIndex]) {
      colIndex += 1;
    }
    if (colIndex === columnsEnd.length) {
      columnsEnd.push(slot._end);
    } else {
      columnsEnd[colIndex] = slot._end;
    }
    placed.push({ ...slot, _col: colIndex });
  }

  // 2) 각 슬롯별로 "자기와 겹치는 슬롯들 중 최대 column index"를 구해 그룹 폭 계산
  for (let i = 0; i < placed.length; i += 1) {
    let maxCol = placed[i]._col;
    for (let j = 0; j < placed.length; j += 1) {
      if (i === j) continue;
      const a = placed[i];
      const b = placed[j];
      const overlap = !(a._end <= b._start || b._end <= a._start);
      if (overlap) {
        if (b._col > maxCol) maxCol = b._col;
        if (a._col > maxCol) maxCol = a._col;
      }
    }
    placed[i]._cols = maxCol + 1;
  }

  return placed;
}

export default function Schedule() {
  const [view, setView] = useState('week');
  const [baseDate, setBaseDate] = useState(() => {
    const saved = localStorage.getItem('scheduleBaseDate');
    if (saved) {
      const d = new Date(saved);
      if (!Number.isNaN(d.getTime())) return d;
    }
    return new Date();
  });
  const [slots, setSlots] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSlotForm, setShowSlotForm] = useState(false);
  const [slotForm, setSlotForm] = useState({ slot_date: '', start_time: '09:00', end_time: '11:00', instructor_id: '', max_capacity: 6 });
  const [showSlotEditForm, setShowSlotEditForm] = useState(false);
  const [editingSlot, setEditingSlot] = useState(null);
  const [slotEditForm, setSlotEditForm] = useState({ slot_date: '', start_time: '09:00', end_time: '11:00', max_capacity: 6 });
  const [slotError, setSlotError] = useState('');
  const [moveError, setMoveError] = useState('');
  const [moving, setMoving] = useState(false);
  const [sendNotificationOnMove, setSendNotificationOnMove] = useState(false);
  const [showReservationForm, setShowReservationForm] = useState(false);
  const [reservationSlot, setReservationSlot] = useState(null);
  const [reservationMemberId, setReservationMemberId] = useState('');
  const [reservationMode, setReservationMode] = useState('create'); // 'create' | 'edit'
  const [reservationId, setReservationId] = useState(null);
  const [reservationTargetSlotId, setReservationTargetSlotId] = useState(null);
  const [reservationStartTime, setReservationStartTime] = useState('');
  const [reservationEndTime, setReservationEndTime] = useState('');
  const [reservationError, setReservationError] = useState('');
  const [reservationSaving, setReservationSaving] = useState(false);
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const getHourFromTime = (t) => {
    if (!t) return null;
    const h = Number(String(t).split(':')[0]);
    return Number.isNaN(h) ? null : h;
  };

  const buildReservationStartOptions = (slot) => {
    if (!slot) return [];
    const startH = getHourFromTime(slot.start_time) ?? 0;
    const endH = getHourFromTime(slot.end_time) ?? startH + 1;
    const lastStart = Math.max(startH, endH - 1);
    const result = [];
    for (let h = startH; h <= lastStart; h += 1) {
      const value = `${String(h).padStart(2, '0')}:00`;
      result.push({ value, label: `${h}시` });
    }
    return result;
  };

  const buildReservationEndOptions = (slot, currentStart) => {
    if (!slot) return [];
    const slotStartH = getHourFromTime(slot.start_time) ?? 0;
    const slotEndH = getHourFromTime(slot.end_time) ?? slotStartH + 1;
    const startH = getHourFromTime(currentStart) ?? slotStartH;
    const firstEndH = Math.max(startH + 1, slotStartH + 1);
    const result = [];
    for (let h = firstEndH; h <= slotEndH; h += 1) {
      const value = `${String(h).padStart(2, '0')}:00`;
      result.push({ value, label: `${h}시` });
    }
    return result;
  };

  useEffect(() => {
    try {
      localStorage.setItem('scheduleBaseDate', baseDate.toISOString());
    } catch {
      // ignore
    }
  }, [baseDate]);

  const weekStart = getWeekStart(baseDate);
  const from = formatDate(view === 'month' ? new Date(baseDate.getFullYear(), baseDate.getMonth(), 1) : weekStart);
  const to = formatDate(
    view === 'month'
      ? new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0)
      : addDays(weekStart, 6)
  );

  useEffect(() => {
    setLoading(true);
    Promise.all([
      // 슬롯은 기간 필터 없이 전부 가져오고, 화면에서 날짜로만 필터링한다.
      listScheduleSlots(),
      listReservations({ from, to }),
      listInstructors(),
      listMembers(),
    ])
      .then(([s, r, i, m]) => {
        setSlots(s);
        setReservations(r);
        setInstructors(i);
        setMembers(m);
      })
      .finally(() => setLoading(false));
  }, [from, to]);

  const reloadSlots = () => {
    listScheduleSlots().then(setSlots);
  };

  const reloadReservations = () => {
    listReservations({ from, to }).then(setReservations);
  };

  const openSlotCreateModal = () => {
    if (user.role === 'admin' && (!instructors || instructors.length === 0)) {
      // 강사 목록이 비어 있으면 한 번 더 로딩 후 모달 오픈
      listInstructors()
        .then((list) => setInstructors(Array.isArray(list) ? list : []))
        .finally(() => setShowSlotForm(true));
    } else {
      setShowSlotForm(true);
    }
  };

  const openReservationModal = (slot) => {
    // 새 예약 등록
    setReservationMode('create');
    setReservationSlot(slot);
    setReservationMemberId('');
    setReservationId(null);
    setReservationTargetSlotId(null);
    const startOpts = buildReservationStartOptions(slot);
    const initialStart = startOpts[0]?.value || '';
    const endOpts = buildReservationEndOptions(slot, initialStart);
    const initialEnd = endOpts[0]?.value || '';
    setReservationStartTime(initialStart);
    setReservationEndTime(initialEnd);
    setReservationError('');
    setReservationSaving(false);
    setShowReservationForm(true);
  };

  const openReservationEditModal = (slot, reservation) => {
    // 기존 예약 편집 (시간/슬롯 변경)
    setReservationMode('edit');
    setReservationSlot(slot);
    setReservationId(reservation.id);
    setReservationTargetSlotId(slot.id);
    setReservationMemberId(reservation.member_id ?? '');
    const editStart = reservation.start_time || slot.start_time;
    const editEnd = reservation.end_time || slot.end_time;
    setReservationStartTime(editStart);
    setReservationEndTime(editEnd);
    setReservationError('');
    setReservationSaving(false);
    setShowReservationForm(true);
  };

  const handleCreateReservation = async (e) => {
    e.preventDefault();
    if (!reservationSlot) {
      setReservationError('슬롯을 선택하세요.');
      return;
    }
    if (!reservationMemberId) {
      setReservationError('회원을 선택하세요.');
      return;
    }
    if (!reservationStartTime || !reservationEndTime) {
      setReservationError('수업 시간을 선택하세요.');
      return;
    }
    setReservationError('');
    setReservationSaving(true);
    try {
      if (reservationMode === 'create') {
        const res = await createReservation({
          schedule_slot_id: reservationSlot.id,
          member_id: Number(reservationMemberId),
          start_time: reservationStartTime,
          end_time: reservationEndTime,
        });
        await reloadReservations();
        await reloadSlots();
        if (res && res.warning) alert(res.warning);
      } else if (reservationMode === 'edit' && reservationId != null) {
        const targetSlotId = reservationTargetSlotId || reservationSlot.id;
        if (targetSlotId !== reservationSlot.id) {
          await moveReservation(Number(reservationId), Number(targetSlotId), {
            send_notification: sendNotificationOnMove,
          });
          await reloadReservations();
          await reloadSlots();
        }
      }
      setShowReservationForm(false);
      setReservationMemberId('');
      setReservationId(null);
    } catch (err) {
      setReservationError(err.response?.data?.error || '예약 등록에 실패했습니다.');
    } finally {
      setReservationSaving(false);
    }
  };

  const handleCancelReservationFromSchedule = async (e, id) => {
    e.stopPropagation();
    e.preventDefault();
    if (!window.confirm('이 예약을 취소하시겠습니까?')) return;
    try {
      await cancelReservation(id);
      await reloadReservations();
      await reloadSlots();
    } catch {
      setMoveError('예약 취소에 실패했습니다.');
    }
  };

  const openSlotEditForm = (slot) => {
    const slotDate = slot.slot_date instanceof Date
      ? formatDate(slot.slot_date)
      : String(slot.slot_date || '').slice(0, 10);
    const startStr = slot.start_time?.slice(0, 5) || '09:00';
    const endStr = slot.end_time?.slice(0, 5) || '11:00';
    const startH = Number(String(startStr).split(':')[0]) || 0;
    const endH = endStr === '24:00' ? 24 : Number(String(endStr).split(':')[0]) || 11;
    const minEndH = startH + MIN_SLOT_HOURS;
    const endTime = endH >= minEndH ? (endH === 24 ? '24:00' : `${String(endH).padStart(2, '0')}:00`) : `${String(minEndH).padStart(2, '0')}:00`;
    setEditingSlot(slot);
    setSlotEditForm({
      slot_date: slotDate,
      start_time: startStr,
      end_time: endTime,
      max_capacity: slot.max_capacity ?? 6,
    });
    setSlotError('');
    setShowSlotEditForm(true);
  };

  const handleUpdateSlot = async (e) => {
    e.preventDefault();
    if (!editingSlot) return;
    setSlotError('');
    try {
      await updateScheduleSlot(editingSlot.id, {
        slot_date: slotEditForm.slot_date,
        start_time: slotEditForm.start_time,
        end_time: slotEditForm.end_time,
        max_capacity: Number(slotEditForm.max_capacity) || 6,
      });
      await reloadSlots();
      await reloadReservations();
      setShowSlotEditForm(false);
      setEditingSlot(null);
    } catch (err) {
      setSlotError(err.response?.data?.error || '슬롯 수정에 실패했습니다.');
    }
  };

  const handleDeleteSlot = async (e, slotId, reservationCount) => {
    e.stopPropagation();
    e.preventDefault();
    const message = reservationCount > 0
      ? `이 슬롯을 삭제하면 연결된 예약 ${reservationCount}건이 모두 삭제됩니다. 계속하시겠습니까?`
      : '이 슬롯을 삭제하시겠습니까?';
    if (!window.confirm(message)) return;
    try {
      await deleteScheduleSlot(slotId);
      await reloadSlots();
      await reloadReservations();
    } catch (err) {
      setSlotError(err.response?.data?.error || '슬롯 삭제에 실패했습니다.');
    }
  };

  const handleCreateSlot = async (e) => {
    e.preventDefault();
    setSlotError('');
    const payload = {
      slot_date: slotForm.slot_date,
      start_time: slotForm.start_time,
      end_time: slotForm.end_time,
      max_capacity: slotForm.max_capacity || 6,
    };
    if (user.role === 'admin') payload.instructor_id = slotForm.instructor_id;
    try {
      const created = await createScheduleSlot(payload);
      // 새 슬롯이 있는 날짜로 기준 날짜 이동
      if (created?.slot_date) {
        let d = null;
        if (created.slot_date instanceof Date) {
          d = created.slot_date;
        } else if (typeof created.slot_date === 'string') {
          const parts = created.slot_date.split('-');
          if (parts.length === 3) {
            d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          }
        }
        if (d && !Number.isNaN(d.getTime())) {
          setBaseDate(d);
        }
      }
      // 새 슬롯을 즉시 반영하기 위해 슬롯 목록을 다시 불러온다.
      await reloadSlots();
      setSlotForm({ slot_date: '', start_time: '09:00', end_time: '11:00', instructor_id: '', max_capacity: 6 });
      setShowSlotForm(false);
    } catch (err) {
      setSlotError(err.response?.data?.error || '슬롯 등록에 실패했습니다.');
    }
  };

  const colorMap = Object.fromEntries(instructors.map((i) => [i.id, i.color || '#3498db']));
  const slotResMap = {};
  reservations.filter((r) => r.status === 'confirmed').forEach((r) => {
    if (!slotResMap[r.schedule_slot_id]) slotResMap[r.schedule_slot_id] = [];
    slotResMap[r.schedule_slot_id].push(r);
  });

  const prev = () => {
    if (view === 'month') setBaseDate(new Date(baseDate.getFullYear(), baseDate.getMonth() - 1));
    else setBaseDate(addDays(weekStart, -7));
  };
  const next = () => {
    if (view === 'month') setBaseDate(new Date(baseDate.getFullYear(), baseDate.getMonth() + 1));
    else setBaseDate(addDays(weekStart, 7));
  };
  const today = () => setBaseDate(new Date());

  const monthLabel = view === 'month'
    ? `${baseDate.getFullYear()}년 ${baseDate.getMonth() + 1}월`
    : `${formatDate(weekStart)} ~ ${formatDate(addDays(weekStart, 6))}`;

  if (loading) return <div className="schedule-loading">로딩 중...</div>;

  return (
    <div className="schedule-page">
      <div className="page-header">
        <h2>스케줄</h2>
        <div className="schedule-controls">
          <button type="button" className="btn btn-secondary" onClick={prev}>이전</button>
          <button type="button" className="btn btn-secondary" onClick={today}>오늘</button>
          <button type="button" className="btn btn-secondary" onClick={next}>다음</button>
          <span className="schedule-label">{monthLabel}</span>
          <label>
            <input type="radio" checked={view === 'week'} onChange={() => setView('week')} />
            주간
          </label>
          <label>
            <input type="radio" checked={view === 'month'} onChange={() => setView('month')} />
            월간
          </label>
          <label className="schedule-option-notify">
            <input
              type="checkbox"
              checked={sendNotificationOnMove}
              onChange={(e) => setSendNotificationOnMove(e.target.checked)}
            />
            예약 이동 시 알림 발송
          </label>
          <button
            type="button"
            className="btn btn-primary schedule-slot-button"
            onClick={openSlotCreateModal}
          >
            슬롯 등록
          </button>
        </div>
      </div>
      <div className="schedule-legend">
        {instructors.map((i) => (
          <span key={i.id} className="legend-item" style={{ backgroundColor: i.color }}>{i.name}</span>
        ))}
      </div>
      {slotError && <div className="schedule-move-error">{slotError}</div>}
      {moveError && <div className="schedule-move-error">{moveError}</div>}
      {moving && <div className="schedule-moving">이동 중...</div>}
      {showSlotForm && (
        <div
          className="schedule-modal-backdrop"
        >
          <div
            className="schedule-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>슬롯 등록</h3>
            <form onSubmit={handleCreateSlot} className="slot-form">
              <input
                type="date"
                value={slotForm.slot_date}
                onChange={(e) => {
                  const v = e.target.value;
                  setSlotForm({ ...slotForm, slot_date: v });
                  if (v) {
                    const parts = v.split('-');
                    if (parts.length === 3) {
                      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                      if (!Number.isNaN(d.getTime())) {
                        setBaseDate(d);
                      }
                    }
                  }
                }}
                required
              />
              <select
                value={slotForm.start_time ? `${(String(slotForm.start_time).split(':')[0] || '09').padStart(2, '0')}:00` : '09:00'}
                onChange={(e) => {
                  const start = e.target.value;
                  const startH = Number(start.split(':')[0]);
                  const minEnd = `${String(startH + MIN_SLOT_HOURS).padStart(2, '0')}:00`;
                  const endH = slotForm.end_time ? Number(String(slotForm.end_time).split(':')[0]) : 10;
                  const newEnd = endH >= startH + MIN_SLOT_HOURS ? slotForm.end_time : minEnd;
                  setSlotForm({ ...slotForm, start_time: start, end_time: newEnd });
                }}
              >
                {HOUR_OPTIONS_START.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <select
                value={(() => {
                  const startH = slotForm.start_time ? Number(String(slotForm.start_time).split(':')[0]) : 9;
                  const endStr = slotForm.end_time || '11:00';
                  const endH = endStr === '24:00' ? 24 : Number(String(endStr).split(':')[0]) || 11;
                  const minH = startH + MIN_SLOT_HOURS;
                  if (endH >= minH) return endH === 24 ? '24:00' : `${String(endH).padStart(2, '0')}:00`;
                  return `${String(minH).padStart(2, '0')}:00`;
                })()}
                onChange={(e) => setSlotForm({ ...slotForm, end_time: e.target.value })}
              >
                {getEndHourOptions(slotForm.start_time || '09:00').map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {user.role === 'admin' && (
                <select
                  value={slotForm.instructor_id}
                  onChange={(e) => setSlotForm({ ...slotForm, instructor_id: e.target.value })}
                  required
                >
                  <option value="">강사 선택</option>
                  {instructors.map((i) => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </select>
              )}
              <input
                type="number"
                min={1}
                max={6}
                value={slotForm.max_capacity}
                onChange={(e) => setSlotForm({ ...slotForm, max_capacity: e.target.value })}
                placeholder="최대인원"
              />
              <div className="slot-form-actions">
                <button type="submit" className="btn btn-primary">등록</button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowSlotForm(false)}
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showSlotEditForm && editingSlot && (
        <div
          className="schedule-modal-backdrop"
        >
          <div
            className="schedule-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>슬롯 수정</h3>
            <p className="schedule-modal-slot-info">
              {editingSlot.instructor_name} · 현재 {editingSlot.slot_date} {timeRangeDisplay(editingSlot.start_time, editingSlot.end_time)}
            </p>
            {slotError && <div className="schedule-move-error">{slotError}</div>}
            <form onSubmit={handleUpdateSlot} className="slot-form">
              <label>
                날짜
                <input
                  type="date"
                  value={slotEditForm.slot_date}
                  onChange={(e) => setSlotEditForm({ ...slotEditForm, slot_date: e.target.value })}
                  required
                />
              </label>
              <label>
                시작
                <select
                  value={slotEditForm.start_time ? `${(String(slotEditForm.start_time).split(':')[0] || '09').padStart(2, '0')}:00` : '09:00'}
                  onChange={(e) => {
                    const start = e.target.value;
                    const startH = Number(start.split(':')[0]);
                    const minEnd = `${String(startH + MIN_SLOT_HOURS).padStart(2, '0')}:00`;
                    const endStr = slotEditForm.end_time || '11:00';
                    const endH = endStr === '24:00' ? 24 : Number(String(endStr).split(':')[0]) || 11;
                    const newEnd = endH >= startH + MIN_SLOT_HOURS ? slotEditForm.end_time : minEnd;
                    setSlotEditForm({ ...slotEditForm, start_time: start, end_time: newEnd });
                  }}
                >
                  {HOUR_OPTIONS_START.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
              <label>
                종료
                <select
                  value={(() => {
                    const startH = slotEditForm.start_time ? Number(String(slotEditForm.start_time).split(':')[0]) : 9;
                    const endStr = slotEditForm.end_time || '11:00';
                    const endH = endStr === '24:00' ? 24 : Number(String(endStr).split(':')[0]) || 11;
                    const minH = startH + MIN_SLOT_HOURS;
                    if (endH >= minH) return endH === 24 ? '24:00' : `${String(endH).padStart(2, '0')}:00`;
                    return `${String(minH).padStart(2, '0')}:00`;
                  })()}
                  onChange={(e) => setSlotEditForm({ ...slotEditForm, end_time: e.target.value })}
                >
                  {getEndHourOptions(slotEditForm.start_time || '09:00').map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
              <label>
                최대 인원
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={slotEditForm.max_capacity}
                  onChange={(e) => setSlotEditForm({ ...slotEditForm, max_capacity: e.target.value })}
                />
              </label>
              <div className="slot-form-actions">
                <button type="submit" className="btn btn-primary">저장</button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowSlotEditForm(false)}
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showReservationForm && reservationSlot && (
        <div
          className="schedule-modal-backdrop"
        >
          <div
            className="schedule-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>{reservationMode === 'edit' ? '예약 편집' : '예약 등록'}</h3>
            {(() => {
              const currentSlotId = reservationMode === 'edit'
                ? (reservationTargetSlotId ?? reservationSlot.id)
                : reservationSlot.id;
              const currentSlot = slots.find((s) => s.id === currentSlotId) || reservationSlot;
              return (
                <p>
                  {currentSlot.slot_date} {timeRangeDisplay(currentSlot.start_time, currentSlot.end_time)} / {currentSlot.instructor_name}
                </p>
              );
            })()}
            {reservationError && <div className="schedule-move-error">{reservationError}</div>}
            <form onSubmit={handleCreateReservation} className="slot-form">
              {reservationMode === 'create' && (
                <>
                  <select
                    value={reservationMemberId}
                    onChange={(e) => setReservationMemberId(e.target.value)}
                    required
                  >
                    <option value="">회원 선택</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <label>
                    수업 시작
                    <select
                      value={reservationStartTime}
                      onChange={(e) => {
                        const newStart = e.target.value;
                        setReservationStartTime(newStart);
                        const currentSlot = reservationSlot;
                        const endOpts = buildReservationEndOptions(currentSlot, newStart);
                        if (endOpts.length > 0 && !endOpts.some((o) => o.value === reservationEndTime)) {
                          setReservationEndTime(endOpts[0].value);
                        }
                      }}
                      required
                    >
                      {buildReservationStartOptions(reservationSlot).map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    수업 종료
                    <select
                      value={reservationEndTime}
                      onChange={(e) => setReservationEndTime(e.target.value)}
                      required
                    >
                      {buildReservationEndOptions(reservationSlot, reservationStartTime).map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              {reservationMode === 'edit' && (
                <>
                  <div>회원: {members.find((m) => m.id === reservationMemberId)?.name || ''}</div>
                  <label>
                    슬롯 변경:
                    <select
                      value={reservationTargetSlotId ?? reservationSlot.id}
                      onChange={(e) => {
                        const newId = Number(e.target.value);
                        setReservationTargetSlotId(newId);
                      }}
                    >
                      {slots
                        .filter((s) => s.slot_date === reservationSlot.slot_date)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {timeRangeDisplay(s.start_time, s.end_time)} / {s.instructor_name}
                          </option>
                        ))}
                    </select>
                  </label>
                </>
              )}
              <div className="slot-form-actions">
                <button type="submit" className="btn btn-primary" disabled={reservationSaving}>
                  {reservationSaving ? '등록 중...' : '등록'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowReservationForm(false)}
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {view === 'week' ? (
        <div className="schedule-week">
          <div className="week-grid">
            <div className="time-column">
              <div className="time-column-header" aria-hidden />
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="time-cell">
                  {h}:00
                </div>
              ))}
            </div>
            <div className="days-columns">
              {[0, 1, 2, 3, 4, 5, 6].map((dayOff) => {
                const d = addDays(weekStart, dayOff);
                const dayStr = formatDate(d);
                const daySlotsRaw = slots.filter((s) => String(s.slot_date).slice(0, 10) === dayStr);
                const daySlots = layoutDaySlots(daySlotsRaw);
                return (
                  <div key={dayStr} className="day-column">
                    <div className="day-header">
                      {d.getMonth() + 1}/{d.getDate()}
                    </div>
                    <div className="day-body">
                      {Array.from({ length: 24 }, (_, h) => (
                        <div key={h} className="day-hour-line" />
                      ))}
                      {daySlots.map((s) => {
                        const slotResList = slotResMap[s.id] || [];
                        const confirmedCount = s.confirmed_count ?? slotResList.length;
                        const totalMinutes = 24 * 60;
                        const top = (s._start / totalMinutes) * 100;
                        const height = ((s._end - s._start) / totalMinutes) * 100;
                        const width = 100 / s._cols;
                        const left = width * s._col;
                        return (
                          <div
                            key={s.id}
                            className="slot-block-abs"
                            style={{
                              top: `${top}%`,
                              height: `${Math.max(height, 2)}%`,
                              left: `${left}%`,
                              width: `${width}%`,
                              borderLeftColor: colorMap[s.instructor_id] || '#3498db',
                            }}
                            data-slot-id={s.id}
                            title={`${s.instructor_name} ${timeRangeDisplay(s.start_time, s.end_time)} (${confirmedCount}/${s.max_capacity})`}
                          >
                            <div className="slot-block-header">
                              <div className="slot-block-title">
                                {s.instructor_name} {timeRangeDisplay(s.start_time, s.end_time)}
                              </div>
                              <div className="slot-block-meta">
                                <span className="slot-block-count">{confirmedCount}/{s.max_capacity}</span>
                                <div className="slot-block-actions">
                                  {(user.role === 'admin' || user.instructorId === s.instructor_id) && (
                                    <>
                                      {slotResList.length < (s.max_capacity ?? 6) && (
                                        <button
                                          type="button"
                                          className="slot-add-member-header"
                                          onClick={(ev) => {
                                            ev.stopPropagation();
                                            openReservationModal(s);
                                          }}
                                          title="회원 추가"
                                        >
                                          +
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        className="slot-edit"
                                        onClick={(ev) => { ev.stopPropagation(); openSlotEditForm(s); }}
                                        title="슬롯 수정"
                                      >
                                        ✎
                                      </button>
                                      <button
                                        type="button"
                                        className="slot-delete"
                                        onClick={(ev) => handleDeleteSlot(ev, s.id, slotResList.length)}
                                        title="슬롯 삭제"
                                      >
                                        ×
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="slot-block-reservations">
                              {slotResList.map((r) => (
                                <div
                                  key={r.id}
                                  className="reservation-card"
                                  draggable
                                  onDragStart={(ev) => handleDragStart(ev, r.id, s.id)}
                                  title={`${timeRangeDisplay(r.start_time, r.end_time)} ${r.member_name} (드래그하여 다른 시간대로 이동)`}
                                >
                                  <span className="reservation-name">
                                    {timeRangeDisplay(r.start_time, r.end_time)} {r.member_name}
                                  </span>
                                  <button
                                    type="button"
                                    className="reservation-cancel"
                                    onClick={(ev) => handleCancelReservationFromSchedule(ev, r.id)}
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="schedule-month">
          <table className="month-table">
            <thead>
              <tr>
                <th>일</th><th>월</th><th>화</th><th>수</th><th>목</th><th>금</th><th>토</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const y = baseDate.getFullYear();
                const m = baseDate.getMonth();
                const first = new Date(y, m, 1);
                const last = new Date(y, m + 1, 0);
                const startPad = (first.getDay() + 6) % 7;
                const days = [];
                for (let i = 0; i < startPad; i++) days.push(null);
                for (let d = 1; d <= last.getDate(); d++) days.push(new Date(y, m, d));
                const rows = [];
                for (let i = 0; i < days.length; i += 7) {
                  const week = days.slice(i, i + 7);
                  rows.push(
                    <tr key={i}>
                      {week.map((d, j) => {
                        if (!d) return <td key={j} className="month-cell empty" />;
                        const dayStr = formatDate(d);
                        const isToday = dayStr === formatDate(new Date());
                        const daySlots = slots.filter((s) => String(s.slot_date).slice(0, 10) === dayStr);
                        return (
                          <td key={j} className={`month-cell ${isToday ? 'month-cell-today' : ''}`}>
                            <div className="month-day">{d.getDate()}</div>
                            {daySlots.map((s) => {
                              const slotResList = slotResMap[s.id] || [];
                              const confirmedCount = s.confirmed_count ?? slotResList.length;
                              const names = slotResList.map((r) => r.member_name).join(', ') || '-';
                              return (
                                <div
                                  key={s.id}
                                  className="month-slot"
                                  style={{ backgroundColor: (colorMap[s.instructor_id] || '#3498db') + '22', borderLeftColor: colorMap[s.instructor_id] }}
                                  title={`${s.instructor_name} ${timeRangeDisplay(s.start_time, s.end_time)} (${confirmedCount}/${s.max_capacity}) ${names}`}
                                >
                                  <span className="month-slot-text">
                                    {s.instructor_name} {timeRangeDisplay(s.start_time, s.end_time)}
                                    <small className="month-slot-count">{confirmedCount}/{s.max_capacity}</small>
                                  </span>
                                  {(user.role === 'admin' || user.instructorId === s.instructor_id) && (
                                    <button
                                      type="button"
                                      className="month-slot-delete"
                                      onClick={(ev) => { ev.stopPropagation(); handleDeleteSlot(ev, s.id, slotResList.length); }}
                                      title="슬롯 삭제"
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </td>
                        );
                      })}
                    </tr>
                  );
                }
                return rows;
              })()}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
