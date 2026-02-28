import { useState, useEffect } from 'react';
import { listReservations, cancelReservation, restoreReservation, completeReservation, uncompleteReservation } from '../api/reservations';
import { listMembers } from '../api/members';
import { listInstructors } from '../api/instructors';
import { timeRangeDisplay } from './Schedule';
import { toLocalDateString } from '../utils/date';

export default function Reservations() {
  const [list, setList] = useState([]);
  const [members, setMembers] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(() => toLocalDateString(new Date()));
  const [to, setTo] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return toLocalDateString(d);
  });
  const [filterStatus, setFilterStatus] = useState('');
  const [filterInstructorId, setFilterInstructorId] = useState('');
  const [filterMemberId, setFilterMemberId] = useState('');

  const load = () => {
    setLoading(true);
    const params = { from, to };
    if (filterMemberId) params.member_id = filterMemberId;
    listReservations(params).then(setList).catch(() => setList([])).finally(() => setLoading(false));
  };

  useEffect(() => {
    Promise.all([listMembers(), listInstructors()])
      .then(([memberList, instructorList]) => {
        setMembers(memberList || []);
        setInstructors(instructorList || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => load(), [from, to, filterMemberId]);

  const handleCancel = (id) => {
    if (window.confirm('예약을 취소하시겠습니까?')) cancelReservation(id).then(load);
  };

  const handleComplete = (id) => {
    completeReservation(id).then(load).catch((err) => alert(err.response?.data?.error || '완료 처리에 실패했습니다.'));
  };

  const handleUncomplete = (id) => {
    uncompleteReservation(id).then(load).catch((err) => alert(err.response?.data?.error || '완료 원복에 실패했습니다.'));
  };

  const handleRestore = (id) => {
    if (window.confirm('취소된 예약을 원복하시겠습니까?')) {
      restoreReservation(id).then(load).catch((err) => alert(err.response?.data?.error || '취소 원복에 실패했습니다.'));
    }
  };

  const filteredList = list
    .filter((r) => {
      if (filterStatus === 'confirmed') return r.status === 'confirmed' && !r.completed;
      if (filterStatus === 'cancelled') return r.status === 'cancelled';
      if (filterStatus === 'completed') return r.status === 'confirmed' && r.completed;
      return true;
    })
    .filter((r) => !filterInstructorId || Number(r.instructor_id) === Number(filterInstructorId));

  const statusLabel = (r) => {
    if (r.status === 'cancelled') return '취소';
    return r.completed ? '완료' : '확정';
  };
  const statusClass = (r) => {
    if (r.status === 'cancelled') return 'badge badge-cancelled';
    return r.completed ? 'badge badge-completed' : 'badge badge-confirmed';
  };

  return (
    <div className="reservations-page page-layout">
      <div className="page-header reservations-header">
        <h2>예약 목록</h2>
        <div className="reservations-toolbar">
          <div className="toolbar-group">
            <span className="toolbar-label">기간</span>
            <input
              type="date"
              className="form-input form-date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <span className="toolbar-sep">~</span>
            <input
              type="date"
              className="form-input form-date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div className="toolbar-group">
            <span className="toolbar-label">상태</span>
            <select
              className="form-input form-select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">전체</option>
              <option value="confirmed">확정</option>
              <option value="completed">완료</option>
              <option value="cancelled">취소</option>
            </select>
          </div>
          <div className="toolbar-group">
            <span className="toolbar-label">강사</span>
            <select
              className="form-input form-select"
              value={filterInstructorId}
              onChange={(e) => setFilterInstructorId(e.target.value)}
            >
              <option value="">전체</option>
              {instructors.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </div>
          <div className="toolbar-group">
            <span className="toolbar-label">회원</span>
            <select
              className="form-input form-select"
              value={filterMemberId}
              onChange={(e) => setFilterMemberId(e.target.value)}
            >
              <option value="">전체</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <button type="button" className="btn btn-primary" onClick={load}>
            조회
          </button>
        </div>
      </div>

      <div className="reservations-card">
        {loading ? (
          <div className="reservations-loading">
            <div className="loading-spinner" />
            <p>예약 목록을 불러오는 중입니다.</p>
          </div>
        ) : (
          <>
            <div className="reservations-summary">
              <span className="summary-count">총 <strong>{filteredList.length}</strong>건</span>
            </div>
            {filteredList.length === 0 ? (
              <div className="reservations-empty">
                <p>조건에 맞는 예약이 없습니다.</p>
              </div>
            ) : (
              <table className="data-table reservations-table">
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th>시간</th>
                    <th>강사</th>
                    <th>회원</th>
                    <th>상태</th>
                    <th className="th-actions"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredList.map((r) => (
                    <tr key={r.id} className={r.status === 'cancelled' ? 'row-cancelled' : ''}>
                      <td className="cell-date">{r.slot_date ? toLocalDateString(new Date(r.slot_date)) : ''}</td>
                      <td className="cell-time">{timeRangeDisplay(r.start_time, r.end_time)}</td>
                      <td className="cell-instructor">{r.instructor_name}</td>
                      <td className="cell-member">{r.member_name}</td>
                      <td>
                        <span className={statusClass(r)}>{statusLabel(r)}</span>
                      </td>
                      <td className="cell-actions">
                        {String(r.status).toLowerCase() === 'confirmed' && (
                          <div className="action-buttons">
                            {!r.completed ? (
                              <button
                                type="button"
                                className="btn btn-success"
                                onClick={() => handleComplete(r.id)}
                              >
                                수업 완료
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-warning"
                                onClick={() => handleUncomplete(r.id)}
                              >
                                완료 원복
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-danger"
                              onClick={() => handleCancel(r.id)}
                            >
                              취소
                            </button>
                          </div>
                        )}
                        {String(r.status).toLowerCase() === 'cancelled' && (
                          <div className="action-buttons">
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={() => handleRestore(r.id)}
                            >
                              취소 원복
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}
