import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { ModelStatus, type ModelSummary, type Paginated } from '@model-portfolio/shared';
import { api } from '../../api/client';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Pagination } from '../../components/ui/Pagination';

/** Guide 4.1.1 "Main page": list of model templates, filterable by Draft/Live status. */
export function ModelListPage() {
  const [statusFilter, setStatusFilter] = useState<ModelStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['models', statusFilter, page],
    queryFn: () =>
      api.get<Paginated<ModelSummary>>(
        `/models?page=${page}${statusFilter === 'ALL' ? '' : `&status=${statusFilter}`}`,
      ),
  });

  function changeStatusFilter(s: ModelStatus | 'ALL') {
    setStatusFilter(s);
    setPage(1);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Model Management</h1>
        <Button onClick={() => navigate('/models/new')}>Create New Model</Button>
      </div>

      <div className="mt-4 flex gap-2">
        {(['ALL', ModelStatus.DRAFT, ModelStatus.LIVE] as const).map((s) => (
          <button
            key={s}
            onClick={() => changeStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-sm ${
              statusFilter === s ? 'bg-brand-500 text-white' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {isLoading && <p className="mt-6 text-slate-500">Loading models...</p>}
      {error && (
        <p role="alert" className="mt-6 text-red-600">
          Failed to load models.
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.items.map((m) => (
          <Link
            key={m.id}
            to={`/models/${m.id}`}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <h3 className="font-medium">{m.name}</h3>
              <Badge tone={m.status === 'LIVE' ? 'green' : 'amber'}>{m.status}</Badge>
            </div>
            <p className="mt-1 text-xs text-slate-400">{m.reference}</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-slate-500">
              <dt>Aim</dt>
              <dd className="text-right">{m.aim.replaceAll('_', ' ')}</dd>
              <dt>Risk</dt>
              <dd className="text-right">{m.risk.replaceAll('_', ' ')}</dd>
              <dt>Min trade</dt>
              <dd className="text-right">£{m.minimumTradeValue.toFixed(2)}</dd>
              <dt>Accounts attached</dt>
              <dd className="text-right">{m.accountsAttachedCount}</dd>
            </dl>
            {m.lockState === 'LOCKED' && (
              <p className="mt-2 text-xs text-slate-400">
                <span aria-hidden="true">🔒</span> Locked
              </p>
            )}
          </Link>
        ))}
        {data?.items.length === 0 && <EmptyState message="No models match this filter." />}
      </div>

      {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />}
    </div>
  );
}
