import { NavLink } from 'react-router-dom';
import { Home, Lock, Settings, Users } from 'lucide-react';
import { cn } from '../../lib/utils';

const items = [
  { to: '/', label: '首頁', icon: Home },
  { to: '/family', label: '家庭帳本', icon: Users },
  { to: '/personal', label: '個人帳本', icon: Lock },
  { to: '/settings', label: '設定', icon: Settings }
];

export function SideNav() {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 border-r border-slate-200 bg-white p-5 lg:block">
      <h1 className="text-xl font-bold text-slate-900">家帳 FamilyLedger</h1>
      <nav className="mt-8 grid gap-2">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold',
                isActive ? 'bg-indigo-50 text-family' : 'text-slate-600 hover:bg-slate-50'
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
