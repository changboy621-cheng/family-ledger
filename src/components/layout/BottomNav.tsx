import { NavLink } from 'react-router-dom';
import { Home, Lock, Settings, Users } from 'lucide-react';
import { cn } from '../../lib/utils';

const items = [
  { to: '/', label: '首頁', icon: Home },
  { to: '/family', label: '家庭帳本', icon: Users },
  { to: '/personal', label: '個人帳本', icon: Lock },
  { to: '/settings', label: '設定', icon: Settings }
];

export function BottomNav() {
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white px-2 pt-2 lg:hidden">
      <div className="grid grid-cols-4 gap-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'grid justify-items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium',
                isActive ? 'bg-indigo-50 text-family' : 'text-slate-500'
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
