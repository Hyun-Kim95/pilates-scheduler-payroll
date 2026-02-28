import { NavLink } from 'react-router-dom';

const menus = [
  { path: '/dashboard', label: '대시보드' },
  { path: '/instructors', label: '강사 관리' },
  { path: '/members', label: '회원 관리' },
  { path: '/schedule', label: '스케줄' },
  { path: '/reservations', label: '예약' },
  { path: '/payroll', label: '정산' },
  { path: '/statistics', label: '통계' },
];

export default function Sidebar() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'admin';
  const visibleMenus = menus.filter((m) => {
    if (!isAdmin && m.path === '/instructors') return false;
    return true;
  });

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        {visibleMenus.map((m) => (
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
