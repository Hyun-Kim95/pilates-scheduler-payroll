import { useState, useEffect } from 'react';
import { listReservations, cancelReservation } from '../api/reservations';

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
          <button type="button" onClick={load}>조회</button>
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
                <td>{r.slot_date}</td>
                <td>{r.start_time}–{r.end_time}</td>
                <td>{r.instructor_name}</td>
                <td>{r.member_name}</td>
                <td>{r.status === 'confirmed' ? '확정' : '취소'}</td>
                <td>
                  {r.status === 'confirmed' && (
                    <button type="button" onClick={() => handleCancel(r.id)}>취소</button>
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
