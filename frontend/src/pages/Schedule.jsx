import { useState, useEffect } from 'react';
import { listScheduleSlots, createScheduleSlot, deleteScheduleSlot } from '../api/scheduleSlots';
import { listReservations, moveReservation, createReservation, cancelReservation } from '../api/reservations';
import { listInstructors } from '../api/instructors';
import { listMembers } from '../api/members';
import './Schedule.css';

function formatDate(d) {
  return d.toISOString().slice(0, 10);
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
  const [baseDate, setBaseDate] = useState(() => new Date());
  const [slots, setSlots] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSlotForm, setShowSlotForm] = useState(false);
  const [slotForm, setSlotForm] = useState({ slot_date: '', start_time: '09:00', end_time: '10:00', instructor_id: '', max_capacity: 6 });
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
  const [reservationError, setReservationError] = useState('');
  const [reservationSaving, setReservationSaving] = useState(false);
  const user = JSON.parse(localStorage.getItem('user') || '{}');

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
      listScheduleSlots({ from, to }),
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
    listScheduleSlots({ from, to }).then(setSlots);
  };

  const reloadReservations = () => {
    listReservations({ from, to }).then(setReservations);
  };

  const openReservationModal = (slot) => {
    // 새 예약 등록
    setReservationMode('create');
    setReservationSlot(slot);
    setReservationMemberId('');
    setReservationId(null);
    setReservationTargetSlotId(null);
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
    setReservationError('');
    setReservationSaving(true);
    try {
      if (reservationMode === 'create') {
        await createReservation({
          schedule_slot_id: reservationSlot.id,
          member_id: Number(reservationMemberId),
        });
        await reloadReservations();
      } else if (reservationMode === 'edit' && reservationId != null) {
        const targetSlotId = reservationTargetSlotId || reservationSlot.id;
        if (targetSlotId !== reservationSlot.id) {
          await moveReservation(Number(reservationId), Number(targetSlotId), {
            send_notification: sendNotificationOnMove,
          });
          await reloadReservations();
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
    } catch {
      setMoveError('예약 취소에 실패했습니다.');
    }
  };

  // 슬롯 삭제 (예약이 없는 경우만)
  const handleDeleteSlot = async (e, slotId, hasReservations) => {
    e.stopPropagation();
    e.preventDefault();
    if (hasReservations) return;
    if (!window.confirm('이 슬롯을 삭제하시겠습니까? (예약이 없는 시간만 삭제 가능합니다.)')) return;
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
      // 새 슬롯이 있는 주로 이동 (가능하면)
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
      // 항상 최신 슬롯 목록 다시 불러오기
      reloadSlots();
      setSlotForm({ slot_date: '', start_time: '09:00', end_time: '10:00', instructor_id: '', max_capacity: 6 });
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
    : `주 ${formatDate(weekStart)} ~ ${formatDate(addDays(weekStart, 6))}`;

  if (loading) return <div className="schedule-loading">로딩 중...</div>;

  return (
    <div className="schedule-page">
      <div className="schedule-toolbar">
        <h2>스케줄</h2>
        <div className="schedule-controls">
          <button type="button" onClick={prev}>이전</button>
          <button type="button" onClick={today}>오늘</button>
          <button type="button" onClick={next}>다음</button>
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
            className="schedule-slot-button"
            onClick={() => setShowSlotForm(true)}
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
          onClick={() => setShowSlotForm(false)}
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
                onChange={(e) => setSlotForm({ ...slotForm, slot_date: e.target.value })}
                required
              />
              <input
                type="time"
                value={slotForm.start_time}
                onChange={(e) => setSlotForm({ ...slotForm, start_time: e.target.value })}
              />
              <input
                type="time"
                value={slotForm.end_time}
                onChange={(e) => setSlotForm({ ...slotForm, end_time: e.target.value })}
              />
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
                <button type="submit">등록</button>
                <button
                  type="button"
                  onClick={() => setShowSlotForm(false)}
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
          onClick={() => setShowReservationForm(false)}
        >
          <div
            className="schedule-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>{reservationMode === 'edit' ? '예약 편집' : '예약 등록'}</h3>
            <p>
              {reservationSlot.slot_date} {reservationSlot.start_time} ~ {reservationSlot.end_time}{' '}
              / {reservationSlot.instructor_name}
            </p>
            {reservationError && <div className="schedule-move-error">{reservationError}</div>}
            <form onSubmit={handleCreateReservation} className="slot-form">
              {reservationMode === 'create' && (
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
              )}
              {reservationMode === 'edit' && (
                <>
                  <div>회원: {members.find((m) => m.id === reservationMemberId)?.name || ''}</div>
                  <label>
                    슬롯 변경:
                    <select
                      value={reservationTargetSlotId ?? reservationSlot.id}
                      onChange={(e) => setReservationTargetSlotId(Number(e.target.value))}
                    >
                      {slots
                        .filter((s) => s.slot_date === reservationSlot.slot_date)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.start_time}~{s.end_time} / {s.instructor_name}
                          </option>
                        ))}
                    </select>
                  </label>
                </>
              )}
              <div className="slot-form-actions">
                <button type="submit" disabled={reservationSaving}>
                  {reservationSaving ? '등록 중...' : '등록'}
                </button>
                <button
                  type="button"
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
                const daySlotsRaw = slots.filter((s) => s.slot_date === dayStr);
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
                            title={`${s.instructor_name} ${s.start_time}-${s.end_time} (클릭 시 예약 등록)`}
                            onClick={() => openReservationModal(s)}
                          >
                            <div className="slot-block-header">
                              <div className="slot-block-title">
                                {s.instructor_name} {s.start_time}-{s.end_time}
                                <small>{slotResList.length}/{s.max_capacity}</small>
                              </div>
                              {slotResList.length === 0 && (
                                <button
                                  type="button"
                                  className="slot-delete"
                                  onClick={(ev) => handleDeleteSlot(ev, s.id, slotResList.length > 0)}
                                >
                                  ×
                                </button>
                              )}
                            </div>
                            <div className="slot-block-reservations">
                              {slotResList.map((r) => (
                                <div
                                  key={r.id}
                                  className="reservation-card"
                                  draggable
                                  onDragStart={(ev) => handleDragStart(ev, r.id, s.id)}
                                  title={`${r.member_name} (드래그하여 다른 시간대로 이동)`}
                                >
                                  <span className="reservation-name">{r.member_name}</span>
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
                        const daySlots = slots.filter((s) => s.slot_date === dayStr);
                        return (
                          <td key={j} className="month-cell">
                            <div className="month-day">{d.getDate()}</div>
                            {daySlots.map((s) => {
                              const slotResList = slotResMap[s.id] || [];
                              const names = slotResList.map((r) => r.member_name).join(', ') || '-';
                              return (
                                <div
                                  key={s.id}
                                  className="month-slot"
                                  style={{ backgroundColor: (colorMap[s.instructor_id] || '#3498db') + '22', borderLeftColor: colorMap[s.instructor_id] }}
                                  title={`${s.instructor_name} ${s.start_time}-${s.end_time} (${slotResList.length}/${s.max_capacity}) ${names}`}
                                >
                                  {s.instructor_name} {s.start_time?.slice(0, 5)}
                                  <small className="month-slot-count">{slotResList.length}/{s.max_capacity}</small>
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
