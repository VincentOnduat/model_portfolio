import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-slate-100'
  }`;

export function Layout() {
  const { user, logout } = useAuth();
  // Below `md:`, the sidebar collapses behind a hamburger toggle instead of
  // taking a fixed 64-width slice out of a narrow viewport.
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white p-4 md:hidden">
        <h1 className="text-lg font-semibold text-brand-700">Model Portfolio</h1>
        <button
          onClick={() => setNavOpen((v) => !v)}
          aria-expanded={navOpen}
          aria-controls="sidebar-nav"
          aria-label={navOpen ? 'Close navigation menu' : 'Open navigation menu'}
          className="rounded-md border border-slate-300 p-2 text-slate-600"
        >
          <span aria-hidden="true">{navOpen ? '✕' : '☰'}</span>
        </button>
      </div>

      <aside
        id="sidebar-nav"
        className={`w-full shrink-0 border-r border-slate-200 bg-white p-4 md:block md:w-64 ${navOpen ? 'block' : 'hidden'}`}
      >
        <div className="mb-6 hidden px-2 md:block">
          <h1 className="text-lg font-semibold text-brand-700">Model Portfolio</h1>
        </div>
        {user && (
          <p className="mb-4 truncate px-2 text-xs text-slate-500 md:mb-6" title={user.email}>
            {user.displayName} · {user.role.replaceAll('_', ' ')}
          </p>
        )}
        <nav className="space-y-1">
          <NavLink to="/" end className={navItemClass} onClick={() => setNavOpen(false)}>
            Dashboard
          </NavLink>
          <NavLink to="/models" className={navItemClass} onClick={() => setNavOpen(false)}>
            Model Management
          </NavLink>
          <NavLink to="/allocation" className={navItemClass} onClick={() => setNavOpen(false)}>
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
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
