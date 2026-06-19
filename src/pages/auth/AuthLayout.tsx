import { Link, Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <main className="min-h-screen bg-page px-4 py-8">
      <div className="mx-auto max-w-md">
        <Link to="/" className="text-2xl font-bold text-family">
          家帳 FamilyLedger
        </Link>
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <Outlet />
        </div>
      </div>
    </main>
  );
}
