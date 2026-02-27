import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import './Layout.css';

export default function Layout() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!localStorage.getItem('token')) navigate('/login', { replace: true });
  }, [navigate]);

  return (
    <div className="app-shell">
      <Header />
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          <div className="page-content">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
