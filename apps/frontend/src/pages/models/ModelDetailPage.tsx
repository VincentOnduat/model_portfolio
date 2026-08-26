import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import type { ModelDetail } from '@model-portfolio/shared';
import { api, ApiError } from '../../api/client';
import { AssetsTab } from './AssetsTab';
import { ClientAccountsTab } from './ClientAccountsTab';
import { SharingTab } from './SharingTab';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { useToast } from '../../components/ui/useToast';

type Tab = 'details' | 'assets' | 'accounts' | 'sharing';

const TABS: [Tab, string][] = [
  ['details', 'Model Details'],
  ['assets', 'Assets'],
  ['accounts', 'Client Accounts'],
  ['sharing', 'Sharing'],
];

export function ModelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('details');
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { data: model, isLoading } = useQuery({
    queryKey: ['model', id],
    queryFn: () => api.get<ModelDetail>(`/models/${id}`),
    enabled: !!id,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['model', id] });

  const lockMutation = useMutation({
    mutationFn: (lock: boolean) => api.post<ModelDetail>(`/models/${id}/${lock ? 'lock' : 'unlock'}`),
    onSuccess: (_data, lock) => {
      toast.success(lock ? 'Model locked for editing.' : 'Model unlocked.');
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to update lock state.'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/models/${id}`),
    onSuccess: () => {
      toast.success('Model deleted.');
      navigate('/models');
    },
    onError: (err) => {
      setConfirmingDelete(false);
      setError(err instanceof ApiError ? err.message : 'Failed to delete model.');
    },
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
        <div className="flex items-center gap-2">
          <Badge tone={model.status === 'LIVE' ? 'green' : 'amber'} className="self-center">
            {model.status}
          </Badge>
          <Button
            variant="secondary"
            size="sm"
            isLoading={lockMutation.isPending}
            onClick={() => lockMutation.mutate(model.lockState === 'UNLOCKED')}
          >
            <span aria-hidden="true">{model.lockState === 'LOCKED' ? '🔓' : '🔒'}</span>
            {model.lockState === 'LOCKED' ? 'Unlock' : 'Lock to edit'}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setConfirmingDelete(true)}
            disabled={model.status === 'LIVE' && model.accountsAttachedCount > 0}
            title={
              model.status === 'LIVE' && model.accountsAttachedCount > 0
                ? 'Live models with attached accounts cannot be deleted.'
                : undefined
            }
          >
            Delete
          </Button>
        </div>
      </div>

      <div className="mt-4">
        <ErrorBanner message={error} />
      </div>

      <div className="mt-6 border-b border-slate-200">
        <nav role="tablist" aria-label="Model sections" className="-mb-px flex gap-6">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              role="tab"
              id={`tab-${key}`}
              aria-selected={tab === key}
              aria-controls={`tabpanel-${key}`}
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

      {/* Only the active tab's panel is mounted, so switching tabs doesn't
          fire every tab's data queries up front - the panel wrapper still
          carries the ARIA tabpanel role/labelling for the one that's shown. */}
      <div role="tabpanel" id={`tabpanel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-6">
        {tab === 'details' && <DetailsTab model={model} />}
        {tab === 'assets' && <AssetsTab model={model} />}
        {tab === 'accounts' && <ClientAccountsTab model={model} />}
        {tab === 'sharing' && <SharingTab model={model} />}
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete this model?"
        description="This cannot be undone."
        confirmLabel="Delete"
        danger
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setConfirmingDelete(false)}
      />
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
