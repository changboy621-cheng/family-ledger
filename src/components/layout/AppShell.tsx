import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { SideNav } from './SideNav';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useRecurringGenerator } from '../../hooks/useRecurring';
import { useOfflineQueue } from '../../hooks/useOfflineQueue';

export function AppShell() {
  const online = useOnlineStatus();
  useRecurringGenerator();
  const pendingUploads = useOfflineQueue(online);

  return (
    <div className="min-h-screen bg-page lg:flex">
      {!online ? (
        <div
          role="status"
          className="fixed inset-x-0 top-0 z-50 bg-amber-500 px-4 py-2 text-center text-sm font-medium text-white"
        >
          目前離線，記帳會先存在手機，連上網路後自動上傳
          {pendingUploads > 0 ? `（待上傳 ${pendingUploads} 筆）` : ''}。
        </div>
      ) : pendingUploads > 0 ? (
        <div role="status" className="fixed inset-x-0 top-0 z-50 bg-slate-700 px-4 py-2 text-center text-sm font-medium text-white">
          有 {pendingUploads} 筆離線記帳等待上傳
        </div>
      ) : null}
      <SideNav />
      <main className="mx-auto w-full max-w-3xl px-4 pb-44 pt-5 lg:mx-0 lg:max-w-4xl lg:px-10 lg:pb-28">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
