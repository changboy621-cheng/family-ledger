import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { AppShell } from './components/layout/AppShell';
import { AuthLayout } from './pages/auth/AuthLayout';
import { Login } from './pages/auth/Login';
import { Register } from './pages/auth/Register';
import { JoinFamily } from './pages/auth/JoinFamily';
import { CompleteOnboarding } from './pages/auth/CompleteOnboarding';
import { Dashboard } from './pages/Dashboard';
import { LedgerPage } from './pages/LedgerPage';
import { Settings } from './pages/Settings';
import { Toast } from './components/common/Toast';

function ProtectedRoute() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-page text-slate-500">載入家帳中...</div>;
  }

  if (!session) {
    return <Navigate to="/auth/login" replace />;
  }

  if (!profile) {
    return <Navigate to="/auth/complete" replace />;
  }

  return <AppShell />;
}

export default function App() {
  return (
    <>
      <Toast />
      <Routes>
        <Route path="/auth" element={<AuthLayout />}>
          <Route index element={<Navigate to="/auth/login" replace />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="join" element={<JoinFamily />} />
          <Route path="complete" element={<CompleteOnboarding />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route index element={<Dashboard />} />
          <Route path="family" element={<LedgerPage ledgerType="family" />} />
          <Route path="personal" element={<LedgerPage ledgerType="personal" />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
