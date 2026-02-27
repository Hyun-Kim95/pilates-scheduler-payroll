import { useState, useEffect } from 'react';
import { listReservations, cancelReservation, completeReservation, uncompleteReservation } from '../api/reservations';
import { timeRangeDisplay } from './Schedule';

export default function Reservations() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });

  const load = () => {
    setLoading(true);
    listReservations({ from, to }).then(setList).catch(() => setList([])).finally(() => setLoading(false));
  };

  useEffect(() => load(), [from, to]);

  const handleCancel = (id) => {
    if (window.confirm('예약을 취소하시겠습니까?')) cancelReservation(id).then(load);
  };

  const handleComplete = (id) => {
    completeReservation(id).then(load).catch((err) => alert(err.response?.data?.error || '완료 처리에 실패했습니다.'));
  };

  const handleUncomplete = (id) => {
    uncompleteReservation(id).then(load).catch((err) => alert(err.response?.data?.error || '완료 원복에 실패했습니다.'));
  };

  const confirmed = list.filter((r) => r.status === 'confirmed');

  return (
    <div>
      <div className="page-header">
        <h2>예약 목록</h2>
        <div className="page-header-actions">
          <label>
            기간&nbsp;
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <button type="button" className="btn btn-primary" onClick={load}>조회</button>
        </div>
      </div>
      {loading ? <p>로딩 중...</p> : (
        <table className="data-table">
          <thead>
            <tr>
              <th>날짜</th>
              <th>시간</th>
              <th>강사</th>
              <th>회원</th>
              <th>상태</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {confirmed.map((r) => (
              <tr key={r.id}>
                <td>{r.slot_date ? String(r.slot_date).slice(0, 10) : ''}</td>
                <td>{timeRangeDisplay(r.start_time, r.end_time)}</td>
                <td>{r.instructor_name}</td>
                <td>{r.member_name}</td>
                <td>{r.status === 'confirmed' ? (r.completed ? '완료' : '확정') : '취소'}</td>
                <td>
                  {r.status === 'confirmed' && (
                    <>
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
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
