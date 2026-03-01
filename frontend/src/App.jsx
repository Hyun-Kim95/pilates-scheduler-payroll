import { createBrowserRouter, createRoutesFromElements, Route, Navigate, RouterProvider } from 'react-router-dom';
import Layout from './layouts/Layout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Schedule from './pages/Schedule';
import Payroll from './pages/Payroll';
import Instructors from './pages/Instructors';
import Members from './pages/Members';
import Reservations from './pages/Reservations';
import Statistics from './pages/Statistics';
const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="instructors" element={<Instructors />} />
        <Route path="members" element={<Members />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="reservations" element={<Reservations />} />
        <Route path="payroll" element={<Payroll />} />
        <Route path="statistics" element={<Statistics />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </>
  ),
  { future: { v7_startTransition: true, v7_relativeSplatPath: true } }
);

export default function App() {
  return <RouterProvider router={router} />;
}
