import { NavLink } from 'react-router-dom';

const menus = [
  { path: '/dashboard', label: '대시보드' },
  { path: '/instructors', label: '강사 관리' },
  { path: '/members', label: '회원 관리' },
  { path: '/schedule', label: '스케줄' },
  { path: '/reservations', label: '예약' },
  { path: '/payroll', label: '정산' },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">Pilates Scheduler</div>
      <nav className="sidebar-nav">
        {menus.map((m) => (
          <NavLink
            key={m.path}
            to={m.path}
            className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
          >
            {m.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
