import { useEffect, useState } from 'react';
import { getHealth } from '../api/health';

export default function Dashboard() {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch(() => setHealth({ ok: false }));
  }, []);

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>대시보드</h2>
        <div className="page-header-actions" />
      </div>
      <p>스케줄·예약·정산을 한 곳에서 관리합니다.</p>
      {health && (
        <p className="health">API: {health.ok ? '연결됨' : '연결 실패'}</p>
      )}
    </div>
  );
}
