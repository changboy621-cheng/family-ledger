import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { SideNav } from './SideNav';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export function AppShell() {
  const online = useOnlineStatus();

  return (
    <div className="min-h-screen bg-page lg:flex">
      {!online ? (
        <div
          role="status"
          className="fixed inset-x-0 top-0 z-50 bg-amber-500 px-4 py-2 text-center text-sm font-medium text-white"
        >
          目前離線，記帳將無法儲存，請連上網路後再試。
        </div>
      ) : null}
      <SideNav />
      <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-5 lg:px-8 lg:pb-10">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
