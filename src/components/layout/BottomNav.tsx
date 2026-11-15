import { NavLink } from 'react-router-dom';
import { Home, Lock, Plane, Settings, Users } from 'lucide-react';
import { cn } from '../../lib/utils';

const items = [
  { to: '/', label: '首頁', icon: Home },
  { to: '/family', label: '家庭帳本', icon: Users },
  { to: '/personal', label: '個人帳本', icon: Lock },
  { to: '/trips', label: '旅遊', icon: Plane },
  { to: '/settings', label: '設定', icon: Settings }
];

export function BottomNav() {
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 rounded-t-2xl border-t border-slate-200 bg-card px-2 pt-2 shadow-[0_-6px_20px_-12px_rgb(var(--shadow)/0.25)] lg:hidden">
      <div className="grid grid-cols-5 gap-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'grid justify-items-center gap-1 rounded-lg px-1 py-2 text-xs font-semibold',
                isActive ? 'text-action' : 'text-slate-500'
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
