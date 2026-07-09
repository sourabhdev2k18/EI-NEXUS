import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

const DashboardPage = lazy(() => import('../pages/DashboardPage.jsx'));

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
