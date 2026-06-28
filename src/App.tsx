import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { AppShell } from './components/layout/AppShell';
import { Toast } from './components/common/Toast';

// 首屏外的路由全部動態載入，避免單一 bundle 過大
const AuthLayout = lazy(() => import('./pages/auth/AuthLayout').then((m) => ({ default: m.AuthLayout })));
const Login = lazy(() => import('./pages/auth/Login').then((m) => ({ default: m.Login })));
const Register = lazy(() => import('./pages/auth/Register').then((m) => ({ default: m.Register })));
const JoinFamily = lazy(() => import('./pages/auth/JoinFamily').then((m) => ({ default: m.JoinFamily })));
const CompleteOnboarding = lazy(() =>
  import('./pages/auth/CompleteOnboarding').then((m) => ({ default: m.CompleteOnboarding }))
);
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const LedgerPage = lazy(() => import('./pages/LedgerPage').then((m) => ({ default: m.LedgerPage })));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));
const QuickAdd = lazy(() => import('./pages/QuickAdd').then((m) => ({ default: m.QuickAdd })));

const Fallback = (
  <div className="grid min-h-screen place-items-center bg-page text-slate-500">載入中...</div>
);

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
      <Suspense fallback={Fallback}>
        <Routes>
          <Route path="/quick" element={<QuickAdd />} />
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
      </Suspense>
    </>
  );
}
