import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/** Guide 3 "Dashboard": thumbnails linking to Model Management and Money Allocation/Rebalance. */
export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-semibold">Welcome{user ? `, ${user.displayName}` : ''}</h1>
      <p className="mt-1 text-slate-500">Jump into Model Management or Money Allocation / Rebalance.</p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          to="/models"
          className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
        >
          <h2 className="text-lg font-medium text-brand-700">Model Management</h2>
          <p className="mt-2 text-sm text-slate-500">
            Create and configure models, allocate assets, attach client accounts, and manage sharing.
          </p>
        </Link>

        <Link
          to="/allocation"
          className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
        >
          <h2 className="text-lg font-medium text-brand-700">Money Allocation / Rebalance</h2>
          <p className="mt-2 text-sm text-slate-500">
            Select client accounts, generate buy/sell orders, and confirm them for trading.
          </p>
        </Link>
      </div>
    </div>
  );
}
