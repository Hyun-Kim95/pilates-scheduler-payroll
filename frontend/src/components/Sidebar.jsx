import { NavLink, useNavigate } from 'react-router-dom';

const menus = [
  { path: '/dashboard', label: '대시보드' },
  { path: '/instructors', label: '강사 관리' },
  { path: '/members', label: '회원 관리' },
  { path: '/schedule', label: '스케줄' },
  { path: '/reservations', label: '예약' },
  { path: '/payroll', label: '정산' },
  { path: '/statistics', label: '통계' },
];

export default function Sidebar({ open, onClose, onOpenChangePassword }) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'admin';
  const visibleMenus = menus.filter((m) => {
    if (!isAdmin && m.path === '/instructors') return false;
    return true;
  });

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    onClose();
    navigate('/login', { replace: true });
  };

  const accountLabel = user.email || (user.role === 'admin' ? '관리자' : '강사');

  return (
    <>
      <div
        className={`sidebar-overlay ${open ? 'sidebar-overlay-visible' : ''}`}
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        role="button"
        tabIndex={-1}
        aria-hidden={!open}
      />
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <nav className="sidebar-nav">
          {visibleMenus.map((m) => (
            <NavLink
              key={m.path}
              to={m.path}
              className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
              onClick={onClose}
            >
              {m.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-footer-account" title={accountLabel}>
            {accountLabel}
          </div>
          <div className="sidebar-footer-buttons">
            <button
              type="button"
              className="sidebar-footer-link"
              onClick={() => onOpenChangePassword?.()}
            >
              비밀번호 변경
            </button>
            <button type="button" className="sidebar-footer-link sidebar-footer-logout" onClick={handleLogout}>
              로그아웃
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
