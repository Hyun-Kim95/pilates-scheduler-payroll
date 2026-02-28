import { useEffect, useState } from 'react';
import { listScheduleSlots } from '../api/scheduleSlots';
import { listReservations } from '../api/reservations';
import { getErrorMessage } from '../utils/error';

function formatDateLabel(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const today = new Date();
    const from = formatDateLabel(today);
    const to = formatDateLabel(today);
    setLoading(true);
    setError('');
    Promise.all([
      listScheduleSlots({ from, to }),
      listReservations({ from, to }),
    ])
      .then(([slots, reservations]) => {
        const todayReservations = reservations.filter((r) => r.status === 'confirmed');
        const completed = todayReservations.filter((r) => r.completed).length;
        const upcoming = todayReservations.filter((r) => !r.completed).length;
        const byInstructor = {};
        todayReservations.forEach((r) => {
          const key = r.instructor_name || '미지정';
          if (!byInstructor[key]) byInstructor[key] = 0;
          byInstructor[key] += 1;
        });
        setStats({
          slotsCount: slots.length,
          reservationsCount: todayReservations.length,
          completed,
          upcoming,
          byInstructor,
        });
      })
      .catch((err) => {
        setError(getErrorMessage(err, '데이터를 불러오지 못했습니다.'));
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="dashboard page-layout">
      <div className="page-header">
        <h2>대시보드</h2>
        <div className="page-header-actions" />
      </div>
      <div className="page-card">
        {loading && (
          <div className="page-loading">
            <div className="loading-spinner" />
            <p>오늘 데이터를 불러오는 중입니다.</p>
          </div>
        )}
        {error && <div className="page-loading" style={{ color: 'var(--destructive)' }}><p>{error}</p></div>}
        {stats && !loading && !error && (
          <>
            <div className="dashboard-cards" style={{ padding: '1rem 1.25rem' }}>
              <div className="dashboard-card">
                <div className="dashboard-card-label">오늘 슬롯 수</div>
                <div className="dashboard-card-value">{stats.slotsCount}</div>
              </div>
              <div className="dashboard-card">
                <div className="dashboard-card-label">오늘 예약 수</div>
                <div className="dashboard-card-value">{stats.reservationsCount}</div>
              </div>
              <div className="dashboard-card">
                <div className="dashboard-card-label">수업 완료</div>
                <div className="dashboard-card-value">{stats.completed}</div>
              </div>
              <div className="dashboard-card">
                <div className="dashboard-card-label">진행 예정</div>
                <div className="dashboard-card-value">{stats.upcoming}</div>
              </div>
            </div>
            <div className="dashboard-section" style={{ padding: '0 1.25rem 1.25rem' }}>
              <h3>강사별 오늘 예약</h3>
              {Object.keys(stats.byInstructor).length === 0 ? (
                <div className="page-empty">오늘 예약이 없습니다.</div>
              ) : (
                <div className="dashboard-table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>강사</th>
                        <th>예약 수</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(stats.byInstructor).map(([name, count]) => (
                        <tr key={name}>
                          <td>{name}</td>
                          <td>{count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
