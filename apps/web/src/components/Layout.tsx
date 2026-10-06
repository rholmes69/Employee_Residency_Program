import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { AgentChat } from './AgentChat';
import { cx } from './ui';

export function Layout() {
  const { me, logout } = useAuth();
  if (!me) return null;
  const staff = me.role === 'REVIEWER' || me.role === 'ADMIN';

  const links = [
    { to: '/', label: 'Home', end: true },
    { to: '/application', label: 'My Application' },
    { to: '/supervisor', label: 'Supervisor Approvals' },
    ...(staff ? [{ to: '/review', label: 'Review' }] : []),
    ...(me.role === 'ADMIN' ? [{ to: '/admin', label: 'Admin' }] : []),
  ];

  return (
    <div className="min-h-screen">
      <header className="bg-brand-700 text-white shadow">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/80 text-[10px] font-bold leading-none">
              DHC
            </div>
            <div className="leading-tight">
              <div className="font-serif text-lg font-bold">Delta Health Center</div>
              <div className="text-xs text-brand-100">Employee Residency Program</div>
            </div>
          </div>
          <nav className="flex flex-1 flex-wrap gap-1">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  cx('rounded-md px-3 py-1.5 text-sm font-medium', isActive ? 'bg-white/15 text-white' : 'text-brand-100 hover:bg-white/10')
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-brand-100">
              {me.name} <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide">{me.role}</span>
            </span>
            <button onClick={() => void logout()} className="rounded-md px-2 py-1 text-brand-100 hover:bg-white/10">
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <Outlet />
      </main>
      <AgentChat />
    </div>
  );
}
