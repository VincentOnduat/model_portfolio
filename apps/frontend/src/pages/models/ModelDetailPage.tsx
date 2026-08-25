import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import type { ModelDetail } from '@model-portfolio/shared';
import { api, ApiError } from '../../api/client';
import { AssetsTab } from './AssetsTab';
import { ClientAccountsTab } from './ClientAccountsTab';
import { SharingTab } from './SharingTab';

type Tab = 'details' | 'assets' | 'accounts' | 'sharing';

export function ModelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('details');
  const [error, setError] = useState<string | null>(null);

  const { data: model, isLoading } = useQuery({
    queryKey: ['model', id],
    queryFn: () => api.get<ModelDetail>(`/models/${id}`),
    enabled: !!id,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['model', id] });

  const lockMutation = useMutation({
    mutationFn: (lock: boolean) => api.post<ModelDetail>(`/models/${id}/${lock ? 'lock' : 'unlock'}`),
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to update lock state.'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/models/${id}`),
    onSuccess: () => navigate('/models'),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to delete model.'),
  });

  if (isLoading || !model) {
    return <p className="text-slate-500">Loading model...</p>;
  }

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{model.name}</h1>
          <p className="text-sm text-slate-400">{model.reference}</p>
        </div>
        <div className="flex gap-2">
          <span
            className={`self-start rounded-full px-3 py-1 text-xs font-medium ${
              model.status === 'LIVE' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
            }`}
          >
            {model.status}
          </span>
          <button
            onClick={() => lockMutation.mutate(model.lockState === 'UNLOCKED')}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            {model.lockState === 'LOCKED' ? '🔓 Unlock' : '🔒 Lock to edit'}
          </button>
          <button
            onClick={() => {
              if (confirm('Delete this model? This cannot be undone.')) deleteMutation.mutate();
            }}
            disabled={model.status === 'LIVE' && model.accountsAttachedCount > 0}
            title={
              model.status === 'LIVE' && model.accountsAttachedCount > 0
                ? 'Live models with attached accounts cannot be deleted.'
                : undefined
            }
            className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 disabled:opacity-40"
          >
            Delete
          </button>
        </div>
      </div>

      {error && <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="mt-6 border-b border-slate-200">
        <nav className="-mb-px flex gap-6">
          {(
            [
              ['details', 'Model Details'],
              ['assets', 'Assets'],
              ['accounts', 'Client Accounts'],
              ['sharing', 'Sharing'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`border-b-2 px-1 pb-3 text-sm font-medium ${
                tab === key ? 'border-brand-500 text-brand-700' : 'border-transparent text-slate-500'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-6">
        {tab === 'details' && <DetailsTab model={model} />}
        {tab === 'assets' && <AssetsTab model={model} />}
        {tab === 'accounts' && <ClientAccountsTab model={model} />}
        {tab === 'sharing' && <SharingTab model={model} />}
      </div>
    </div>
  );
}

function DetailsTab({ model }: { model: ModelDetail }) {
  return (
    <dl className="grid max-w-lg grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-slate-200 bg-white p-6 text-sm">
      <dt className="text-slate-500">Aim</dt>
      <dd>{model.aim.replaceAll('_', ' ')}</dd>
      <dt className="text-slate-500">Risk</dt>
      <dd>{model.risk.replaceAll('_', ' ')}</dd>
      <dt className="text-slate-500">Minimum Trade Value</dt>
      <dd>£{model.minimumTradeValue.toFixed(2)}</dd>
      {model.chargePercent != null && (
        <>
          <dt className="text-slate-500">Charge</dt>
          <dd>
            {model.chargePercent}% {model.vatIncluded ? '(VAT included)' : '(ex. VAT)'}
          </dd>
        </>
      )}
      <dt className="text-slate-500">Accounts Attached</dt>
      <dd>{model.accountsAttachedCount}</dd>
      <dt className="text-slate-500">State</dt>
      <dd>{model.lockState === 'LOCKED' ? `Locked by ${model.lockedByUserId}` : 'Unlocked'}</dd>
      <dt className="text-slate-500">Created</dt>
      <dd>{new Date(model.createdAt).toLocaleString()}</dd>
      <dt className="text-slate-500">Last edited</dt>
      <dd>{new Date(model.updatedAt).toLocaleString()}</dd>
    </dl>
  );
}
