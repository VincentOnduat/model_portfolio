import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { AllocationListStatus } from '@model-portfolio/shared';
import { api, ApiError } from '../../api/client';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyTableRow } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { Table } from '../../components/ui/Table';
import { useToast } from '../../components/ui/useToast';

interface OrderLine {
  id: string;
  accountId: string;
  accountName: string;
  assetId: string;
  assetName: string;
  isin: string;
  side: 'BUY' | 'SELL';
  units: number | null;
  value: number;
  lastPrice: number | null;
  belowMinTrade: boolean;
}

interface AllocationListDetail {
  id: string;
  reference: string;
  name: string;
  type: string;
  status: AllocationListStatus;
  orders: OrderLine[];
  exclusions: { id: string; reason: string; detail: string }[];
  failures: { id: string; reason: string; detail: string }[];
  totals: {
    totalAccounts: number;
    totalBuyOrders: number;
    totalBuyOrdersValue: number;
    totalSellOrders: number;
    totalSellOrdersValue: number;
  };
}

/** Guide 4.2.3/4.2.4 Step 2 (Generate Orders) & Step 3 (Trade Confirmation), combined by status. */
export function AllocationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const { data: list, isLoading } = useQuery({
    queryKey: ['allocation-list', id],
    queryFn: () => api.get<AllocationListDetail>(`/allocation-lists/${id}`),
    enabled: !!id,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['allocation-list', id] });

  const removeMutation = useMutation({
    mutationFn: () => api.post(`/allocation-lists/${id}/remove-orders`, { orderLineIds: [...selectedOrders] }),
    onSuccess: () => {
      toast.success('Selected orders removed.');
      setSelectedOrders(new Set());
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to remove orders.'),
  });

  const confirmMutation = useMutation({
    mutationFn: () => api.post(`/allocation-lists/${id}/confirm-orders`),
    onSuccess: () => {
      toast.success('Orders confirmed and submitted for trading.');
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to confirm orders.'),
  });

  if (isLoading || !list) return <p className="text-slate-500">Loading...</p>;

  const isStep2 = list.status === AllocationListStatus.POTENTIAL_ORDERS_GENERATED;
  const isStep3 = list.status === AllocationListStatus.ORDERS_SUBMITTED;

  return (
    <div>
      <h1 className="text-2xl font-semibold">{list.name}</h1>
      <p className="text-sm text-slate-400">
        {list.reference} · {list.type.replaceAll('_', ' ')}
      </p>
      <Badge tone="slate" className="mt-2">
        {list.status.replaceAll('_', ' ')}
      </Badge>

      <div className="mt-4">
        <ErrorBanner message={error} />
      </div>

      {list.exclusions.length > 0 && (
        <section className="mt-6">
          <h3 className="mb-2 font-medium text-red-700">Exclusions</h3>
          <ul className="space-y-1 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {list.exclusions.map((e) => (
              <li key={e.id}>
                <strong>{e.reason.replaceAll('_', ' ')}</strong> — {e.detail}
              </li>
            ))}
          </ul>
        </section>
      )}

      {list.failures.length > 0 && (
        <section className="mt-6">
          <h3 className="mb-2 font-medium text-red-700">Failures</h3>
          <ul className="space-y-1 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {list.failures.map((f) => (
              <li key={f.id}>
                <strong>{f.reason.replaceAll('_', ' ')}</strong> — {f.detail}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h3 className="mb-2 font-medium">Totals</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <TotalCard label="Accounts" value={list.totals.totalAccounts} />
          <TotalCard label="Buy Orders" value={list.totals.totalBuyOrders} />
          <TotalCard label="Buy Orders Value" value={`£${list.totals.totalBuyOrdersValue.toFixed(2)}`} />
          {list.totals.totalSellOrders > 0 && (
            <TotalCard label="Sell Orders" value={list.totals.totalSellOrders} />
          )}
        </div>
      </section>

      <section className="mt-6">
        <h3 className="mb-2 font-medium">Detailed Confirmation</h3>
        <Table>
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              {isStep2 && <th className="w-8 py-2"></th>}
              <th>Account</th>
              <th>Asset</th>
              <th>ISIN</th>
              <th>Buy/Sell</th>
              <th className="text-right">Units</th>
              <th className="text-right">Value</th>
              <th>Below Min Trade</th>
            </tr>
          </thead>
          <tbody>
            {list.orders.map((o) => (
              <tr key={o.id} className="border-b border-slate-100">
                {isStep2 && (
                  <td className="py-2">
                    <input
                      type="checkbox"
                      aria-label={`Select order: ${o.side} ${o.assetName} for ${o.accountName}`}
                      checked={selectedOrders.has(o.id)}
                      onChange={(e) =>
                        setSelectedOrders((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(o.id);
                          else next.delete(o.id);
                          return next;
                        })
                      }
                    />
                  </td>
                )}
                <td>{o.accountName}</td>
                <td>{o.assetName}</td>
                <td className="text-slate-500">{o.isin}</td>
                <td>
                  <span className={o.side === 'BUY' ? 'text-green-700' : 'text-red-700'}>{o.side}</span>
                </td>
                <td className="text-right">{o.units?.toFixed(2) ?? '—'}</td>
                <td className="text-right">£{o.value.toFixed(2)}</td>
                <td>{o.belowMinTrade ? 'Yes' : ''}</td>
              </tr>
            ))}
            {list.orders.length === 0 && <EmptyTableRow colSpan={8} message="No orders." />}
          </tbody>
        </Table>
      </section>

      {isStep2 && (
        <div className="mt-6 flex gap-3">
          <Button
            variant="danger"
            disabled={selectedOrders.size === 0}
            isLoading={removeMutation.isPending}
            onClick={() => removeMutation.mutate()}
          >
            Remove Potential Orders
          </Button>
          <Button isLoading={confirmMutation.isPending} onClick={() => confirmMutation.mutate()}>
            Confirm Orders
          </Button>
        </div>
      )}

      {isStep3 && (
        <p className="mt-6 text-sm text-slate-500">
          This list has been submitted for trading and is now informational only.
        </p>
      )}
    </div>
  );
}

function TotalCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
