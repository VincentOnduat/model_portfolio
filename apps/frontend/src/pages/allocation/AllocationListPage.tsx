import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { AllocationListStatus, AllocationListType, type AllocationListSummary } from '@model-portfolio/shared';
import { api, ApiError } from '../../api/client';

const STATUS_LABEL: Record<AllocationListStatus, string> = {
  [AllocationListStatus.CLIENT_ACCOUNTS_SELECTED]: 'Client Accounts Selected',
  [AllocationListStatus.GENERATING_ORDERS]: 'Generating Orders',
  [AllocationListStatus.POTENTIAL_ORDERS_GENERATED]: 'Potential Orders Generated',
  [AllocationListStatus.SENDING_ORDERS]: 'Sending Orders',
  [AllocationListStatus.ORDERS_SUBMITTED]: 'Orders Submitted',
};

/** Guide 4.2.1/4.2.2 "Main page" / "List's presentation". */
export function AllocationListPage() {
  const [typeFilter, setTypeFilter] = useState<Set<AllocationListType>>(new Set());
  const [statusFilter, setStatusFilter] = useState<Set<AllocationListStatus>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: lists } = useQuery({
    queryKey: ['allocation-lists'],
    queryFn: () => api.get<AllocationListSummary[]>('/allocation-lists'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/allocation-lists/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['allocation-lists'] }),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to delete list.'),
  });

  const filtered = lists?.filter(
    (l) =>
      (typeFilter.size === 0 || typeFilter.has(l.type)) &&
      (statusFilter.size === 0 || statusFilter.has(l.status)),
  );

  function toggle<T>(set: Set<T>, value: T, setter: (s: Set<T>) => void) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Money Allocation / Rebalance</h1>
        <button
          onClick={() => navigate('/allocation/new')}
          className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
        >
          Create New List
        </button>
      </div>

      {error && <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="mt-4 flex flex-wrap gap-4">
        <div className="flex gap-2">
          {Object.values(AllocationListType).map((t) => (
            <button
              key={t}
              onClick={() => toggle(typeFilter, t, setTypeFilter)}
              className={`rounded-full px-3 py-1 text-sm ${
                typeFilter.has(t) ? 'bg-brand-500 text-white' : 'border border-slate-200 bg-white text-slate-600'
              }`}
            >
              {t.replaceAll('_', ' ')}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.values(AllocationListStatus).map((s) => (
            <button
              key={s}
              onClick={() => toggle(statusFilter, s, setStatusFilter)}
              className={`rounded-full px-3 py-1 text-xs ${
                statusFilter.has(s) ? 'bg-slate-700 text-white' : 'border border-slate-200 bg-white text-slate-500'
              }`}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {filtered?.map((l) => (
          <div
            key={l.id}
            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4"
          >
            <Link to={`/allocation/${l.id}`} className="flex-1">
              <div className="flex items-center gap-3">
                <span
                  className={`h-2 w-2 rounded-full ${
                    l.hasExclusions || l.hasFailures ? 'bg-red-500' : 'bg-green-500'
                  }`}
                />
                <span className="font-medium">{l.name}</span>
                <span className="text-xs text-slate-400">{l.reference}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {l.type.replaceAll('_', ' ')} · {STATUS_LABEL[l.status]} · {l.accountCount} account(s)
              </p>
            </Link>
            {l.status !== AllocationListStatus.ORDERS_SUBMITTED && (
              <button
                onClick={() => deleteMutation.mutate(l.id)}
                className="text-xs text-red-500 hover:underline"
              >
                Delete
              </button>
            )}
          </div>
        ))}
        {filtered?.length === 0 && <p className="text-slate-500">No lists match this filter.</p>}
      </div>
    </div>
  );
}
