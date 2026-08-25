import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { ModelStatus, type ModelSummary } from '@model-portfolio/shared';
import { api } from '../../api/client';

/** Guide 4.1.1 "Main page": list of model templates, filterable by Draft/Live status. */
export function ModelListPage() {
  const [statusFilter, setStatusFilter] = useState<ModelStatus | 'ALL'>('ALL');
  const navigate = useNavigate();

  const { data: models, isLoading, error } = useQuery({
    queryKey: ['models', statusFilter],
    queryFn: () =>
      api.get<ModelSummary[]>(`/models${statusFilter === 'ALL' ? '' : `?status=${statusFilter}`}`),
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Model Management</h1>
        <button
          onClick={() => navigate('/models/new')}
          className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
        >
          Create New Model
        </button>
      </div>

      <div className="mt-4 flex gap-2">
        {(['ALL', ModelStatus.DRAFT, ModelStatus.LIVE] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-sm ${
              statusFilter === s ? 'bg-brand-500 text-white' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {isLoading && <p className="mt-6 text-slate-500">Loading models...</p>}
      {error && <p className="mt-6 text-red-600">Failed to load models.</p>}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {models?.map((m) => (
          <Link
            key={m.id}
            to={`/models/${m.id}`}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <h3 className="font-medium">{m.name}</h3>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  m.status === 'LIVE' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}
              >
                {m.status}
              </span>
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
              <p className="mt-2 text-xs text-slate-400">🔒 Locked</p>
            )}
          </Link>
        ))}
        {models?.length === 0 && <p className="text-slate-500">No models match this filter.</p>}
      </div>
    </div>
  );
}
