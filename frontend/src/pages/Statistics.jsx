import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { getStatistics } from '../api/statistics';
import { toLocalDateString } from '../utils/date';

const WEEKDAY_NAMES = ['', '일', '월', '화', '수', '목', '금', '토'];
const CHART_COLORS = ['#d97706', '#16a34a', '#dc2626', '#eab308', '#6366f1', '#ec4899'];

function getMonthStartEnd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return {
    from: `${y}-${m}-01`,
    to: toLocalDateString(d),
  };
}

export default function Statistics() {
  const { from: defaultFrom, to: defaultTo } = getMonthStartEnd();
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    getStatistics({ from, to })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => load(), [from, to]);

  if (loading) {
    return (
      <div className="statistics-page page-layout">
        <div className="page-header"><h2>통계</h2></div>
        <div className="page-card">
          <div className="page-loading">
            <div className="loading-spinner" />
            <p>통계를 불러오는 중입니다.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="statistics-page page-layout">
        <div className="page-header"><h2>통계</h2></div>
        <div className="page-card">
          <div className="page-empty">통계를 불러오지 못했습니다.</div>
        </div>
      </div>
    );
  }

  const pieData = [
    { name: '확정', value: data.overview.confirmed, color: CHART_COLORS[0] },
    { name: '완료', value: data.overview.completed, color: CHART_COLORS[1] },
    { name: '취소', value: data.overview.cancelled, color: CHART_COLORS[2] },
  ].filter((d) => d.value > 0);

  const trendData = (data.reservation_trend || []).map((row) => ({
    date: String(row.date).slice(5, 10),
    확정: row.confirmed,
    완료: row.completed,
    취소: row.cancelled,
    총예약: row.total,
  }));

  const weekdayData = (data.by_weekday || []).map((row) => ({
    요일: WEEKDAY_NAMES[row.day_of_week],
    예약: row.reservations,
  }));

  const instructorChartData = (data.by_instructor || []).map((row) => ({
    name: row.instructor_name,
    예약: Number(row.reservations),
    완료: Number(row.completed),
    취소: Number(row.cancelled),
    슬롯: Number(row.slots),
  }));

  const memberChartData = (data.by_member || []).slice(0, 15).map((row) => ({
    name: row.member_name?.length > 6 ? row.member_name.slice(0, 6) + '…' : row.member_name,
    예약: Number(row.reservations),
    완료: Number(row.completed),
  }));

  const payrollChartData = (data.payroll_summary || []).map((row) => ({
    name: `${row.year_month} ${row.instructor_name}`,
    총지급액: Number(row.total_amount),
    수업료: Number(row.rate_amount),
    기본급: Number(row.base_salary),
  }));

  return (
    <div className="statistics-page page-layout">
      <div className="page-header">
        <h2>통계</h2>
        <div className="page-toolbar">
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
          <button type="button" className="btn btn-primary" onClick={load}>
            조회
          </button>
        </div>
      </div>

      <div className="page-card">
        <div className="statistics-content">
          {/* 요약 카드 + 파이 */}
          <section className="stats-section">
            <h3>요약</h3>
            <div className="dashboard-cards stats-overview-cards">
              <div className="dashboard-card">
                <div className="dashboard-card-label">총 예약</div>
                <div className="dashboard-card-value">{data.overview.total_reservations}</div>
              </div>
              <div className="dashboard-card">
                <div className="dashboard-card-label">확정</div>
                <div className="dashboard-card-value">{data.overview.confirmed}</div>
              </div>
              <div className="dashboard-card">
                <div className="dashboard-card-label">완료</div>
                <div className="dashboard-card-value">{data.overview.completed}</div>
              </div>
              <div className="dashboard-card">
                <div className="dashboard-card-label">취소</div>
                <div className="dashboard-card-value">{data.overview.cancelled}</div>
              </div>
              <div className="dashboard-card">
                <div className="dashboard-card-label">완료율</div>
                <div className="dashboard-card-value">{data.overview.completion_rate}%</div>
              </div>
              <div className="dashboard-card">
                <div className="dashboard-card-label">취소율</div>
                <div className="dashboard-card-value">{data.overview.cancellation_rate}%</div>
              </div>
              <div className="dashboard-card">
                <div className="dashboard-card-label">슬롯 수</div>
                <div className="dashboard-card-value">{data.overview.total_slots}</div>
              </div>
              <div className="dashboard-card">
                <div className="dashboard-card-label">전체 회원</div>
                <div className="dashboard-card-value">{data.overview.total_members}</div>
              </div>
              <div className="dashboard-card">
                <div className="dashboard-card-label">기간 내 신규 회원</div>
                <div className="dashboard-card-value">{data.overview.new_members_period}</div>
              </div>
            </div>
            {pieData.length > 0 && (
              <div className="chart-wrap chart-pie">
                <h4>예약 상태 구성</h4>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, value }) => `${name} ${value}`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => [v, '']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          {/* 슬롯 가동률 */}
          <section className="stats-section">
            <h3>슬롯 가동률</h3>
            <div className="chart-wrap chart-bar-single">
              <div className="utilization-legend">
                <span>가동률 {data.slot_utilization.utilization_percent}%</span>
                <span>예약 {data.slot_utilization.total_reservations}명 / 가용 {data.slot_utilization.total_capacity}명</span>
              </div>
              <div className="utilization-bar-bg">
                <div
                  className="utilization-bar-fill"
                  style={{ width: `${Math.min(data.slot_utilization.utilization_percent, 100)}%` }}
                />
              </div>
              <p className="chart-note">슬롯당 평균 예약: {data.slot_utilization.avg_per_slot}명</p>
            </div>
          </section>

          {/* 강사별 */}
          <section className="stats-section">
            <h3>강사별 통계</h3>
            {!instructorChartData.length ? (
              <div className="page-empty">데이터가 없습니다.</div>
            ) : (
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={instructorChartData} margin={{ top: 10, right: 20, left: 10, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fill: 'var(--foreground)', fontSize: 12 }} angle={-25} textAnchor="end" />
                    <YAxis tick={{ fill: 'var(--foreground)', fontSize: 12 }} />
                    <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }} />
                    <Legend />
                    <Bar dataKey="예약" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="완료" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="취소" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="슬롯" fill={CHART_COLORS[4]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          {/* 회원별 예약 상위 */}
          <section className="stats-section">
            <h3>회원별 예약 (상위 15명)</h3>
            {!memberChartData.length ? (
              <div className="page-empty">데이터가 없습니다.</div>
            ) : (
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={memberChartData} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fill: 'var(--foreground)', fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" tick={{ fill: 'var(--foreground)', fontSize: 11 }} width={75} />
                    <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }} />
                    <Bar dataKey="예약" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
                    <Bar dataKey="완료" fill={CHART_COLORS[1]} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          {/* 일별 예약 추이 */}
          <section className="stats-section">
            <h3>일별 예약 추이</h3>
            {!trendData.length ? (
              <div className="page-empty">데이터가 없습니다.</div>
            ) : (
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trendData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fill: 'var(--foreground)', fontSize: 11 }} />
                    <YAxis tick={{ fill: 'var(--foreground)', fontSize: 12 }} />
                    <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }} />
                    <Legend />
                    <Line type="monotone" dataKey="총예약" stroke={CHART_COLORS[5]} strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="확정" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="완료" stroke={CHART_COLORS[1]} strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="취소" stroke={CHART_COLORS[2]} strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          {/* 요일별 예약 */}
          <section className="stats-section">
            <h3>요일별 예약 분포</h3>
            {!weekdayData.length ? (
              <div className="page-empty">데이터가 없습니다.</div>
            ) : (
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={weekdayData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="요일" tick={{ fill: 'var(--foreground)', fontSize: 12 }} />
                    <YAxis tick={{ fill: 'var(--foreground)', fontSize: 12 }} />
                    <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }} />
                    <Bar dataKey="예약" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          {/* 정산 요약 */}
          <section className="stats-section">
            <h3>정산 요약</h3>
            {!payrollChartData.length ? (
              <div className="page-empty">해당 기간 정산 데이터가 없습니다.</div>
            ) : (
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={payrollChartData} margin={{ top: 10, right: 20, left: 10, bottom: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fill: 'var(--foreground)', fontSize: 11 }} angle={-35} textAnchor="end" />
                    <YAxis tick={{ fill: 'var(--foreground)', fontSize: 12 }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
                    <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }} formatter={(v) => [Number(v).toLocaleString() + '원', '']} />
                    <Legend />
                    <Bar dataKey="총지급액" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} name="총 지급액" />
                    <Bar dataKey="수업료" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} name="수업료" />
                    <Bar dataKey="기본급" fill={CHART_COLORS[4]} radius={[4, 4, 0, 0]} name="기본급" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
