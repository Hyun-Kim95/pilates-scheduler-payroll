import { useState, useEffect } from 'react';
import { listPayrolls, computePayroll } from '../api/payrolls';
import { toLocalYearMonthString } from '../utils/date';
import { getErrorMessage } from '../utils/error';
import { useInfiniteList } from '../hooks/useInfiniteList';

const PAGE_SIZE = 20;

export default function Payroll() {
  const [yearMonth, setYearMonth] = useState(() => toLocalYearMonthString(new Date()));
  const [computing, setComputing] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [computeError, setComputeError] = useState('');

  const { list, total, loading, hasMore, sentinelRef, reset } = useInfiniteList(
    (offset) =>
      listPayrolls({ year_month: yearMonth, limit: PAGE_SIZE, offset }).catch((err) => {
        if (err?.response?.status === 403) setForbidden(true);
        throw err;
      }),
    { pageSize: PAGE_SIZE, deps: [yearMonth] }
  );

  useEffect(() => {
    setForbidden(false);
  }, [yearMonth]);

  const handleCompute = () => {
    setComputeError('');
    setComputing(true);
    computePayroll(yearMonth)
      .then(() => reset())
      .catch((err) => {
        const msg = err.response?.status === 403
          ? '정산 계산/반영은 관리자만 가능합니다.'
          : getErrorMessage(err, '정산 계산에 실패했습니다.');
        setComputeError(msg);
      })
      .finally(() => setComputing(false));
  };

  const totalSum = list.reduce((s, p) => s + Number(p.total_amount || 0), 0);

  return (
    <div className="payroll-page page-layout">
      <div className="page-header">
        <h2>정산 관리</h2>
        <div className="page-toolbar">
          <div className="toolbar-group">
            <span className="toolbar-label">년월</span>
            <input
              type="month"
              className="form-input form-select"
              value={yearMonth}
              onChange={(e) => setYearMonth(e.target.value)}
            />
          </div>
          <button type="button" className="btn btn-primary" onClick={handleCompute} disabled={computing}>
            {computing ? '계산 중...' : '정산 계산/반영'}
          </button>
        </div>
      </div>
      <div className="page-card">
        {computeError && (
          <div className="page-summary" style={{ color: 'var(--destructive)' }} role="alert">{computeError}</div>
        )}
        {forbidden ? (
          <div className="page-empty payroll-forbidden">정산 조회는 관리자만 가능합니다.</div>
        ) : list.length === 0 && loading ? (
          <div className="page-loading">
            <div className="loading-spinner" />
            <p>정산 데이터를 불러오는 중입니다.</p>
          </div>
        ) : (
          <>
            {list.length > 0 && (
              <div className="page-summary">총 <strong>{total ?? list.length}</strong>건 · 합계: <strong>{totalSum.toLocaleString()}원</strong></div>
            )}
            {list.length === 0 ? (
              <div className="page-empty">해당 월 정산 데이터가 없습니다.</div>
            ) : (
              <div className="table-wrapper">
              <table className="payroll-table data-table">
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
              </div>
            )}
            {hasMore && <div ref={sentinelRef} className="infinite-sentinel" />}
            {loading && list.length > 0 && <div className="page-loading infinite-loading"><div className="loading-spinner" /><p>더 불러오는 중...</p></div>}
          </>
        )}
      </div>
    </div>
  );
}
