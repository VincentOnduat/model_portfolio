import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SharingKind, SharingScope, type ModelDetail } from '@model-portfolio/shared';
import { api, ApiError } from '../../api/client';

interface SharingGrantRow {
  id: string;
  scope: SharingScope;
  kind: SharingKind;
  granteeUserName: string | null;
  granteeFirmName: string | null;
  canAttachAccounts: boolean;
  canAllocateMoney: boolean;
  canRebalance: boolean;
  canEditModel: boolean;
  allowOnwardShare: boolean;
}

const SCOPE_LABEL: Record<SharingScope, string> = {
  [SharingScope.FIRM]: "My Firm's Permission",
  [SharingScope.ENTERPRISE]: 'Enterprise Permission',
  [SharingScope.THIRD_PARTY]: 'Third Party Permission',
};

/** Guide 4.1.5: Firm / Enterprise / Third Party sharing tabs, combined here. */
export function SharingTab({ model }: { model: ModelDetail }) {
  const [scope, setScope] = useState<SharingScope>(SharingScope.FIRM);
  const [granteeId, setGranteeId] = useState('');
  const [perms, setPerms] = useState({
    canAttachAccounts: false,
    canAllocateMoney: false,
    canRebalance: false,
    canEditModel: false,
    allowOnwardShare: false,
  });
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: grants } = useQuery({
    queryKey: ['sharing', model.id, scope],
    queryFn: () => api.get<SharingGrantRow[]>(`/models/${model.id}/sharing?scope=${scope}`),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['sharing', model.id] });

  const grantMutation = useMutation({
    mutationFn: () =>
      api.post(`/models/${model.id}/sharing`, {
        scope,
        kind: SharingKind.BESPOKE,
        ...(scope === SharingScope.FIRM ? { granteeUserId: granteeId } : { granteeFirmId: granteeId }),
        ...perms,
      }),
    onSuccess: () => {
      setGranteeId('');
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to create sharing grant.'),
  });

  const revokeMutation = useMutation({
    mutationFn: (grantId: string) => api.delete(`/models/${model.id}/sharing/${grantId}`),
    onSuccess: invalidate,
  });

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {Object.values(SharingScope).map((s) => (
          <button
            key={s}
            onClick={() => setScope(s)}
            className={`rounded-full px-3 py-1 text-sm ${
              scope === s ? 'bg-brand-500 text-white' : 'border border-slate-200 bg-white text-slate-600'
            }`}
          >
            {SCOPE_LABEL[s]}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="py-2">Grantee</th>
            <th>Attach/Remove</th>
            <th>Allocate Money</th>
            <th>Rebalance</th>
            {scope !== SharingScope.THIRD_PARTY && <th>Edit Model</th>}
            <th>Onward Share</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {grants?.map((g) => (
            <tr key={g.id} className="border-b border-slate-100">
              <td className="py-2">{g.granteeUserName ?? g.granteeFirmName ?? '—'}</td>
              <td>{g.canAttachAccounts ? '✓' : ''}</td>
              <td>{g.canAllocateMoney ? '✓' : ''}</td>
              <td>{g.canRebalance ? '✓' : ''}</td>
              {scope !== SharingScope.THIRD_PARTY && <td>{g.canEditModel ? '✓' : ''}</td>}
              <td>{g.allowOnwardShare ? '✓' : ''}</td>
              <td className="text-right">
                <button onClick={() => revokeMutation.mutate(g.id)} className="text-xs text-red-500 hover:underline">
                  Revoke
                </button>
              </td>
            </tr>
          ))}
          {grants?.length === 0 && (
            <tr>
              <td colSpan={7} className="py-4 text-center text-slate-400">
                No {SCOPE_LABEL[scope].toLowerCase()} grants yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <h4 className="mb-3 text-sm font-medium">
          Grant {SCOPE_LABEL[scope]} {scope === SharingScope.FIRM ? '(bespoke, to one user)' : '(to a firm)'}
        </h4>
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">
              {scope === SharingScope.FIRM ? 'User ID' : 'Firm ID'}
            </span>
            <input
              value={granteeId}
              onChange={(e) => setGranteeId(e.target.value)}
              className="w-64 rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="uuid"
            />
          </label>
          {(
            [
              ['canAttachAccounts', 'Attach/Remove accounts'],
              ['canAllocateMoney', 'Allocate Money'],
              ['canRebalance', 'Rebalance'],
              ...(scope !== SharingScope.THIRD_PARTY ? ([['canEditModel', 'Edit Model']] as const) : []),
              ['allowOnwardShare', 'Allow Onward Share'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-1.5 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={perms[key]}
                onChange={(e) => setPerms((prev) => ({ ...prev, [key]: e.target.checked }))}
              />
              {label}
            </label>
          ))}
          <button
            disabled={!granteeId || grantMutation.isPending}
            onClick={() => grantMutation.mutate()}
            className="rounded-md bg-brand-500 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            Grant
          </button>
        </div>
      </div>
    </div>
  );
}
