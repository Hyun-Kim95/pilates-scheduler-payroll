import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import { getInstructor } from '../api/instructors';

export default function Header() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [instructorName, setInstructorName] = useState('');

  useEffect(() => {
    if (user.role === 'instructor' && user.instructorId) {
      getInstructor(user.instructorId)
        .then((data) => {
          if (data?.name) setInstructorName(data.name);
        })
        .catch(() => {});
    }
  }, [user.role, user.instructorId]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  const goChangePassword = () => {
    navigate('/change-password');
    setOpen(false);
  };

  let label = '';
  if (user.role === 'admin') {
    label = user.email || '관리자';
  } else if (user.role === 'instructor') {
    label = instructorName || user.email || '강사';
  } else {
    label = user.email || '사용자';
  }

  return (
    <header className="header">
      <h1 className="header-title">필라테스 스케줄 · 정산</h1>
      <div className="header-actions">
        <ThemeToggle />
        <div className="header-user-menu">
          <button
            type="button"
            className="header-user-button"
            onClick={() => setOpen((v) => !v)}
          >
            <span>{label}</span>
            <span>▾</span>
          </button>
          {open && (
            <div className="header-user-menu-list">
              <button type="button" className="btn btn-secondary" onClick={goChangePassword}>
                비밀번호 변경
              </button>
              <button type="button" className="btn btn-danger" onClick={handleLogout}>
                로그아웃
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
