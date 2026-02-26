import { useState, useEffect } from 'react';
import { listPayrolls, computePayroll } from '../api/payrolls';

export default function Payroll() {
  const [yearMonth, setYearMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    setLoading(true);
    setForbidden(false);
    listPayrolls({ year_month: yearMonth })
      .then((data) => { setList(Array.isArray(data) ? data : []); setForbidden(false); })
      .catch((err) => {
        setList([]);
        setForbidden(err.response?.status === 403);
      })
      .finally(() => setLoading(false));
  }, [yearMonth]);

  const handleCompute = () => {
    setComputing(true);
    computePayroll(yearMonth)
      .then((res) => setList(res.items || []))
      .catch(console.error)
      .finally(() => setComputing(false));
  };

  const totalSum = list.reduce((s, p) => s + Number(p.total_amount || 0), 0);

  return (
    <div className="payroll-page">
      <div className="page-header">
        <h2>정산 관리</h2>
        <div className="page-header-actions">
          <label>
            년월:
            <input
              type="month"
              value={yearMonth}
              onChange={(e) => setYearMonth(e.target.value)}
            />
          </label>
          <button type="button" onClick={handleCompute} disabled={computing}>
            {computing ? '계산 중...' : '정산 계산/반영'}
          </button>
        </div>
      </div>
      {forbidden ? (
        <p className="payroll-forbidden">정산 조회는 관리자만 가능합니다.</p>
      ) : loading ? (
        <p>로딩 중...</p>
      ) : (
        <>
          <table className="payroll-table">
            <thead>
              <tr>
                <th>강사</th>
                <th>수업 횟수</th>
                <th>수업료 합계</th>
                <th>기본급</th>
                <th>총 지급액</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id}>
                  <td>{p.instructor_name}</td>
                  <td>{p.class_count}회</td>
                  <td>{Number(p.rate_amount).toLocaleString()}원</td>
                  <td>{Number(p.base_salary).toLocaleString()}원</td>
                  <td><strong>{Number(p.total_amount).toLocaleString()}원</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length > 0 && (
            <p className="payroll-total">총 합계: <strong>{totalSum.toLocaleString()}원</strong></p>
          )}
        </>
      )}
    </div>
  );
}
