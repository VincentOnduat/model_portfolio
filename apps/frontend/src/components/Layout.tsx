import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-slate-100'
  }`;

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 border-r border-slate-200 bg-white p-4">
        <div className="mb-6 px-2">
          <h1 className="text-lg font-semibold text-brand-700">Model Portfolio</h1>
          {user && (
            <p className="mt-1 truncate text-xs text-slate-500" title={user.email}>
              {user.displayName} · {user.role.replaceAll('_', ' ')}
            </p>
          )}
        </div>
        <nav className="space-y-1">
          <NavLink to="/" end className={navItemClass}>
            Dashboard
          </NavLink>
          <NavLink to="/models" className={navItemClass}>
            Model Management
          </NavLink>
          <NavLink to="/allocation" className={navItemClass}>
            Money Allocation / Rebalance
          </NavLink>
        </nav>
        <button
          onClick={logout}
          className="mt-6 w-full rounded-md border border-slate-200 px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50"
        >
          Sign out
        </button>
      </aside>
      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
