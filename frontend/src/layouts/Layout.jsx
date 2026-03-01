import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import ChangePasswordModal from '../components/ChangePasswordModal';
import './Layout.css';

export default function Layout() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('token')) navigate('/login', { replace: true });
  }, [navigate]);

  return (
    <div className="app-shell">
      <Header onMenuClick={() => setSidebarOpen(true)} />
      <div className="app-layout">
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onOpenChangePassword={() => {
            setSidebarOpen(false);
            setChangePasswordOpen(true);
          }}
        />
        <main className="main-content">
          <div className="page-content">
            <Outlet />
          </div>
        </main>
      </div>
      {changePasswordOpen && (
        <ChangePasswordModal onClose={() => setChangePasswordOpen(false)} />
      )}
    </div>
  );
}
