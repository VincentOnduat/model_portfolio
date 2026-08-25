import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AllocationListType, type AllocationListSummary } from '@model-portfolio/shared';
import { api, ApiError } from '../../api/client';

interface ClientAccountRow {
  id: string;
  accountNumber: string;
  accountName: string;
  clientName: string;
  linkedModelId: string | null;
  linkedModelName: string | null;
  availableCash: number;
}

/** Guide 4.2.3/4.2.4 Step 1: Select Accounts. */
export function AllocationCreatePage() {
  const navigate = useNavigate();
  const [type, setType] = useState<AllocationListType>(AllocationListType.MONEY_ALLOCATION);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allocateAllFor, setAllocateAllFor] = useState<Set<string>>(new Set());
  const [amountFor, setAmountFor] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const { data: accounts } = useQuery({
    queryKey: ['client-accounts', 'attached-any'],
    // Any account linked to a model is eligible; the model-per-account is resolved server-side.
    queryFn: () => api.get<ClientAccountRow[]>('/client-accounts'),
  });

  const eligible = accounts?.filter((a) => a.linkedModelId);

  const createMutation = useMutation({
    mutationFn: async () => {
      const list = await api.post<AllocationListSummary>('/allocation-lists', {
        type,
        name,
        accounts: [...selected].map((accountId) => ({
          accountId,
          allocateAll: type === AllocationListType.MONEY_ALLOCATION ? allocateAllFor.has(accountId) : undefined,
          allocationAmount:
            type === AllocationListType.MONEY_ALLOCATION && !allocateAllFor.has(accountId)
              ? Number(amountFor[accountId] ?? 0)
              : undefined,
        })),
      });
      // Guide 4.2.3/4.2.4 Step 1 -> Step 2: pressing "Generate Orders" both
      // creates the list and immediately kicks off order generation.
      await api.post(`/allocation-lists/${list.id}/generate-orders`);
      return list;
    },
    onSuccess: (list) => navigate(`/allocation/${list.id}`),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to generate orders.'),
  });

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold">Create New List</h1>

      <div className="mt-4 flex gap-2">
        {Object.values(AllocationListType).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`rounded-full px-4 py-1.5 text-sm ${
              type === t ? 'bg-brand-500 text-white' : 'border border-slate-200 bg-white text-slate-600'
            }`}
          >
            {t.replaceAll('_', ' ')}
          </button>
        ))}
      </div>

      <label className="mt-4 block max-w-sm text-sm">
        <span className="mb-1 block text-slate-600">List Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </label>

      {error && <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <h3 className="mb-2 mt-6 font-medium">Available Client Accounts</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="w-8 py-2"></th>
            <th>Account No.</th>
            <th>Client Name</th>
            <th>Model</th>
            <th className="text-right">Available Cash</th>
            {type === AllocationListType.MONEY_ALLOCATION && <th className="text-center">Allocate All</th>}
            {type === AllocationListType.MONEY_ALLOCATION && <th className="text-right">Allocation Amount</th>}
          </tr>
        </thead>
        <tbody>
          {eligible?.map((a) => (
            <tr key={a.id} className="border-b border-slate-100">
              <td className="py-2">
                <input
                  type="checkbox"
                  checked={selected.has(a.id)}
                  onChange={(e) =>
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(a.id);
                      else next.delete(a.id);
                      return next;
                    })
                  }
                />
              </td>
              <td>{a.accountNumber}</td>
              <td>{a.clientName}</td>
              <td className="text-slate-500">{a.linkedModelName}</td>
              <td className="text-right">£{a.availableCash.toFixed(2)}</td>
              {type === AllocationListType.MONEY_ALLOCATION && (
                <td className="text-center">
                  <input
                    type="checkbox"
                    checked={allocateAllFor.has(a.id)}
                    onChange={(e) =>
                      setAllocateAllFor((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(a.id);
                        else next.delete(a.id);
                        return next;
                      })
                    }
                  />
                </td>
              )}
              {type === AllocationListType.MONEY_ALLOCATION && (
                <td className="text-right">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    disabled={allocateAllFor.has(a.id)}
                    value={amountFor[a.id] ?? ''}
                    onChange={(e) => setAmountFor((prev) => ({ ...prev, [a.id]: e.target.value }))}
                    className="w-28 rounded-md border border-slate-300 px-2 py-1 text-right disabled:bg-slate-100"
                  />
                </td>
              )}
            </tr>
          ))}
          {eligible?.length === 0 && (
            <tr>
              <td colSpan={6} className="py-4 text-center text-slate-400">
                No client accounts are attached to a model yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <button
        disabled={selected.size === 0 || !name || createMutation.isPending}
        onClick={() => createMutation.mutate()}
        className="mt-4 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        Generate Orders
      </button>
    </div>
  );
}
