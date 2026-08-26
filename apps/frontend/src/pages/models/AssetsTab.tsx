import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { validateModelAllocation, type Asset, type ModelDetail } from '@model-portfolio/shared';
import { api, ApiError } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { EmptyTableRow } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { Table } from '../../components/ui/Table';
import { useToast } from '../../components/ui/useToast';

/** Guide 4.1.3 "Assets": Assets Available for the Model / Assets Allocated to this Model. */
export function AssetsTab({ model }: { model: ModelDetail }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());
  // Local, unsaved allocation edits keyed by assetId -> percent string.
  const [draftAllocations, setDraftAllocations] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: availableAssets } = useQuery({
    queryKey: ['available-assets', model.id, search],
    queryFn: () =>
      api.get<Asset[]>(`/models/${model.id}/available-assets${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  });

  const invalidateModel = () => queryClient.invalidateQueries({ queryKey: ['model', model.id] });

  const addAssetsMutation = useMutation({
    mutationFn: async (assetIds: string[]) => {
      const entries = [
        ...model.assets.map((a) => ({ assetId: a.assetId, percentAllocated: a.percentAllocated })),
        ...assetIds.map((id) => ({ assetId: id, percentAllocated: 0 })),
      ];
      return api.put<ModelDetail>(`/models/${model.id}/allocation`, { entries });
    },
    onSuccess: (_data, assetIds) => {
      toast.success(`${assetIds.length} asset(s) added to the model.`);
      setSelectedToAdd(new Set());
      setDraftAllocations(null);
      invalidateModel();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to add assets.'),
  });

  const setAllocationMutation = useMutation({
    mutationFn: async (entries: { assetId: string; percentAllocated: number }[]) =>
      api.put<ModelDetail>(`/models/${model.id}/allocation`, { entries }),
    onSuccess: () => {
      toast.success('Allocation updated.');
      setDraftAllocations(null);
      invalidateModel();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to update allocation.'),
  });

  const removeAssetMutation = useMutation({
    mutationFn: async (assetId: string) => {
      const entries = model.assets
        .filter((a) => a.assetId !== assetId)
        .map((a) => ({ assetId: a.assetId, percentAllocated: a.percentAllocated }));
      return api.put<ModelDetail>(`/models/${model.id}/allocation`, { entries });
    },
    onSuccess: () => {
      toast.success('Asset removed.');
      invalidateModel();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to remove asset.'),
  });

  const publishMutation = useMutation({
    mutationFn: async () => api.post<ModelDetail>(`/models/${model.id}/publish`),
    onSuccess: () => {
      toast.success('Model published - now Live.');
      invalidateModel();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to publish model.'),
  });

  const effectiveAllocations = model.assets.map((a) => ({
    assetId: a.assetId,
    percentAllocated: draftAllocations
      ? Number(draftAllocations[a.assetId] ?? a.percentAllocated)
      : a.percentAllocated,
  }));

  const validation = useMemo(() => validateModelAllocation(effectiveAllocations), [effectiveAllocations]);

  function startEditing() {
    setDraftAllocations(Object.fromEntries(model.assets.map((a) => [a.assetId, String(a.percentAllocated)])));
  }

  function resetAllocation() {
    setDraftAllocations(null);
  }

  return (
    <div className="space-y-8">
      <ErrorBanner message={error} />

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-medium">Assets Allocated to this Model</h3>
          <div className="flex gap-2 text-sm">
            {draftAllocations ? (
              <>
                <Button variant="secondary" size="sm" onClick={resetAllocation}>
                  Reset Allocation
                </Button>
                <Button
                  size="sm"
                  disabled={!validation.valid}
                  isLoading={setAllocationMutation.isPending}
                  onClick={() =>
                    setAllocationMutation.mutate(
                      Object.entries(draftAllocations).map(([assetId, pct]) => ({
                        assetId,
                        percentAllocated: Number(pct),
                      })),
                    )
                  }
                >
                  Set Allocation Change
                </Button>
              </>
            ) : (
              <Button variant="secondary" size="sm" onClick={startEditing}>
                Edit Allocation
              </Button>
            )}
          </div>
        </div>

        <Table>
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2">Name</th>
              <th>ISIN</th>
              <th>Sector</th>
              <th className="text-right">% Allocated</th>
              <th className="text-right">Set Allocation</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {model.assets.map((a) => (
              <tr key={a.assetId} className="border-b border-slate-100">
                <td className="py-2">{a.asset.name}</td>
                <td className="text-slate-500">{a.asset.isin}</td>
                <td className="text-slate-500">{a.asset.sector}</td>
                <td className="text-right">{a.percentAllocated.toFixed(2)}%</td>
                <td className="text-right">
                  {draftAllocations ? (
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={draftAllocations[a.assetId] ?? ''}
                      onChange={(e) =>
                        setDraftAllocations((prev) => ({ ...prev, [a.assetId]: e.target.value }))
                      }
                      className="w-24 rounded-md border border-slate-300 px-2 py-1 text-right"
                    />
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="pl-2 text-right">
                  {!a.asset.isCash && (
                    <button
                      onClick={() => removeAssetMutation.mutate(a.assetId)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>

        <div className="mt-2 flex items-center justify-between text-sm">
          <span className={validation.valid ? 'text-green-600' : 'text-red-600'}>
            Total: {validation.total.toFixed(2)}% {validation.valid ? '✓' : '(must equal 100%)'}
          </span>
          <Button
            variant="success"
            size="sm"
            disabled={!validation.valid || model.status === 'LIVE'}
            isLoading={publishMutation.isPending}
            onClick={() => publishMutation.mutate()}
            title={model.status === 'LIVE' ? 'Model is already Live' : undefined}
          >
            {model.status === 'LIVE' ? 'Live' : 'Publish'}
          </Button>
        </div>
      </section>

      <section>
        <h3 className="mb-2 font-medium">Assets Available for the Model</h3>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, ISIN or sector (3+ characters)..."
          className="mb-3 w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <Table>
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="w-8 py-2"></th>
              <th>Name</th>
              <th>ISIN</th>
              <th>Type</th>
              <th>Sector</th>
            </tr>
          </thead>
          <tbody>
            {availableAssets?.map((a) => (
              <tr key={a.id} className="border-b border-slate-100">
                <td className="py-2">
                  <input
                    type="checkbox"
                    aria-label={`Select ${a.name} to add to the model`}
                    checked={selectedToAdd.has(a.id)}
                    onChange={(e) =>
                      setSelectedToAdd((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(a.id);
                        else next.delete(a.id);
                        return next;
                      })
                    }
                  />
                </td>
                <td>{a.name}</td>
                <td className="text-slate-500">{a.isin}</td>
                <td className="text-slate-500">{a.type}</td>
                <td className="text-slate-500">{a.sector}</td>
              </tr>
            ))}
            {availableAssets?.length === 0 && <EmptyTableRow colSpan={5} message="No matching assets." />}
          </tbody>
        </Table>
        <Button
          size="sm"
          disabled={selectedToAdd.size === 0}
          isLoading={addAssetsMutation.isPending}
          onClick={() => addAssetsMutation.mutate([...selectedToAdd])}
          className="mt-3"
        >
          Add Selected Assets to Model
        </Button>
      </section>
    </div>
  );
}
