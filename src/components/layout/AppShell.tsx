import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { SideNav } from './SideNav';

export function AppShell() {
  return (
    <div className="min-h-screen bg-page lg:flex">
      <SideNav />
      <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-5 lg:px-8 lg:pb-10">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
