import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ModelDetail } from '@model-portfolio/shared';
import { api, ApiError } from '../../api/client';

interface ClientAccountRow {
  id: string;
  accountNumber: string;
  accountName: string;
  clientName: string;
  adviserName: string;
  linkedModelId: string | null;
  linkedModelName: string | null;
  availableCash: number;
  accountType: string;
  hasConsent: boolean;
  /** Only present when the row was fetched against this specific model. */
  eligible?: boolean;
  ineligibleReason?: string;
}

interface IneligibleAccountDetail {
  accountId: string;
  accountNumber: string;
  reason: string;
}

/** Guide 4.1.4 "Client Accounts": attach/detach accounts to this model. */
export function ClientAccountsTab({ model }: { model: ModelDetail }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [onlyUnattached, setOnlyUnattached] = useState(true);
  const [selectedAvailable, setSelectedAvailable] = useState<Set<string>>(new Set());
  const [selectedAttached, setSelectedAttached] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const availableQuery = useQuery({
    queryKey: ['client-accounts', 'available', model.id, search, onlyUnattached],
    queryFn: () =>
      // eligibilityModelId (not modelId - that filters by attachment, which
      // would conflict with unattachedOnly) so the API can compute
      // eligibility - see guide 4.1.4 consent/account-type suitability gating.
      api.get<ClientAccountRow[]>(
        `/client-accounts?eligibilityModelId=${model.id}&${onlyUnattached ? 'unattachedOnly=true&' : ''}${
          search.length >= 3 ? `search=${encodeURIComponent(search)}` : ''
        }`,
      ),
  });

  const attachedQuery = useQuery({
    queryKey: ['client-accounts', 'attached', model.id],
    queryFn: () => api.get<ClientAccountRow[]>(`/client-accounts?modelId=${model.id}`),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['client-accounts'] });
    queryClient.invalidateQueries({ queryKey: ['model', model.id] });
  };

  const attachMutation = useMutation({
    mutationFn: (accountIds: string[]) => api.post('/client-accounts/attach', { modelId: model.id, accountIds }),
    onSuccess: () => {
      setSelectedAvailable(new Set());
      invalidate();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'ACCOUNTS_NOT_ELIGIBLE' && Array.isArray(err.details)) {
        const details = err.details as IneligibleAccountDetail[];
        setError(details.map((d) => `${d.accountNumber}: ${d.reason}`).join(' '));
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to attach accounts.');
      }
    },
  });

  const detachMutation = useMutation({
    mutationFn: (accountIds: string[]) => api.post('/client-accounts/detach', { accountIds }),
    onSuccess: () => {
      setSelectedAttached(new Set());
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to detach accounts.'),
  });

  return (
    <div className="space-y-8">
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <section>
        <h3 className="mb-2 font-medium">Client Accounts Available for this Model</h3>
        <div className="mb-3 flex items-center gap-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Account No. or Adviser..."
            className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={onlyUnattached} onChange={(e) => setOnlyUnattached(e.target.checked)} />
            Only show accounts not attached to a model
          </label>
        </div>

        <AccountTable
          accounts={availableQuery.data}
          selected={selectedAvailable}
          onToggle={(id, checked) =>
            setSelectedAvailable((prev) => {
              const next = new Set(prev);
              if (checked) next.add(id);
              else next.delete(id);
              return next;
            })
          }
        />
        <button
          disabled={selectedAvailable.size === 0 || attachMutation.isPending}
          onClick={() => attachMutation.mutate([...selectedAvailable])}
          className="mt-3 rounded-md bg-brand-500 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          Attach Selected Client Accounts to Model
        </button>
      </section>

      <section>
        <h3 className="mb-2 font-medium">Client Accounts Attached to this Model</h3>
        <AccountTable
          accounts={attachedQuery.data}
          selected={selectedAttached}
          onToggle={(id, checked) =>
            setSelectedAttached((prev) => {
              const next = new Set(prev);
              if (checked) next.add(id);
              else next.delete(id);
              return next;
            })
          }
        />
        <button
          disabled={selectedAttached.size === 0 || detachMutation.isPending}
          onClick={() => detachMutation.mutate([...selectedAttached])}
          className="mt-3 rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 disabled:opacity-50"
        >
          Detach Selected Account from Model
        </button>
      </section>
    </div>
  );
}

function AccountTable({
  accounts,
  selected,
  onToggle,
}: {
  accounts: ClientAccountRow[] | undefined;
  selected: Set<string>;
  onToggle: (id: string, checked: boolean) => void;
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-left text-slate-500">
          <th className="w-8 py-2"></th>
          <th>Account No.</th>
          <th>Account Name</th>
          <th>Client Name</th>
          <th>Type</th>
          <th>Adviser</th>
          <th className="text-right">Available Cash</th>
        </tr>
      </thead>
      <tbody>
        {accounts?.map((a) => {
          // eligible is only present (true/false) on the "available" table,
          // which fetches with eligibilityModelId - guide 4.1.4 consent/
          // account-type suitability gating.
          const ineligible = a.eligible === false;
          return (
            <tr
              key={a.id}
              className={`border-b border-slate-100 ${ineligible ? 'opacity-50' : ''}`}
              title={ineligible ? a.ineligibleReason : undefined}
            >
              <td className="py-2">
                <input
                  type="checkbox"
                  checked={selected.has(a.id)}
                  disabled={ineligible}
                  onChange={(e) => onToggle(a.id, e.target.checked)}
                />
              </td>
              <td>{a.accountNumber}</td>
              <td>{a.accountName}</td>
              <td>{a.clientName}</td>
              <td className="text-slate-500">
                {a.accountType}
                {ineligible && <span className="ml-1 text-red-500">- {a.ineligibleReason}</span>}
              </td>
              <td className="text-slate-500">{a.adviserName}</td>
              <td className="text-right">£{a.availableCash.toFixed(2)}</td>
            </tr>
          );
        })}
        {accounts?.length === 0 && (
          <tr>
            <td colSpan={7} className="py-4 text-center text-slate-400">
              No accounts found.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
