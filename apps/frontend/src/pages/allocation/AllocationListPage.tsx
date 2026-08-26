import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  AllocationListStatus,
  AllocationListType,
  type AllocationListSummary,
  type Paginated,
} from '@model-portfolio/shared';
import { api, ApiError } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { Pagination } from '../../components/ui/Pagination';
import { useToast } from '../../components/ui/useToast';

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
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data } = useQuery({
    queryKey: ['allocation-lists', page],
    queryFn: () => api.get<Paginated<AllocationListSummary>>(`/allocation-lists?page=${page}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/allocation-lists/${id}`),
    onSuccess: () => {
      toast.success('List deleted.');
      queryClient.invalidateQueries({ queryKey: ['allocation-lists'] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to delete list.'),
  });

  const filtered = data?.items.filter(
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
        <Button onClick={() => navigate('/allocation/new')}>Create New List</Button>
      </div>

      <div className="mt-4">
        <ErrorBanner message={error} />
      </div>

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
                  aria-hidden="true"
                  className={`h-2 w-2 rounded-full ${
                    l.hasExclusions || l.hasFailures ? 'bg-red-500' : 'bg-green-500'
                  }`}
                />
                <span className="font-medium">{l.name}</span>
                <span className="text-xs text-slate-400">{l.reference}</span>
                {(l.hasExclusions || l.hasFailures) && (
                  <span className="text-xs text-red-600">Has exclusions/failures</span>
                )}
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
        {filtered?.length === 0 && <EmptyState message="No lists match this filter." />}
      </div>

      {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />}
    </div>
  );
}
