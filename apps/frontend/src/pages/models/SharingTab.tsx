import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SharingKind, SharingScope, type ModelDetail } from '@model-portfolio/shared';
import { api, ApiError } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { EmptyTableRow } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { Table } from '../../components/ui/Table';
import { useToast } from '../../components/ui/useToast';

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

interface EligibleGrantee {
  id: string;
  name: string;
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
  const toast = useToast();

  const { data: grants } = useQuery({
    queryKey: ['sharing', model.id, scope],
    queryFn: () => api.get<SharingGrantRow[]>(`/models/${model.id}/sharing?scope=${scope}`),
  });

  // Guide 4.1.5: only offer grantees this grant could actually target for
  // the selected scope (descendant firms for Enterprise, contracted firms
  // for Third Party, firm users for Firm) - the API enforces the same
  // restriction, this just avoids a round-trip 422 for an ineligible pick.
  const { data: eligibleGrantees } = useQuery({
    queryKey: ['sharing', model.id, 'eligible-grantees', scope],
    queryFn: () => api.get<EligibleGrantee[]>(`/models/${model.id}/sharing/eligible-grantees?scope=${scope}`),
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
      toast.success('Sharing grant created.');
      setGranteeId('');
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to create sharing grant.'),
  });

  const revokeMutation = useMutation({
    mutationFn: (grantId: string) => api.delete(`/models/${model.id}/sharing/${grantId}`),
    onSuccess: () => {
      toast.success('Sharing grant revoked.');
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to revoke sharing grant.'),
  });

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {Object.values(SharingScope).map((s) => (
          <button
            key={s}
            onClick={() => {
              setScope(s);
              setGranteeId('');
            }}
            className={`rounded-full px-3 py-1 text-sm ${
              scope === s ? 'bg-brand-500 text-white' : 'border border-slate-200 bg-white text-slate-600'
            }`}
          >
            {SCOPE_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <ErrorBanner message={error} />
      </div>

      <Table>
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
            <EmptyTableRow colSpan={7} message={`No ${SCOPE_LABEL[scope].toLowerCase()} grants yet.`} />
          )}
        </tbody>
      </Table>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <h4 className="mb-3 text-sm font-medium">
          Grant {SCOPE_LABEL[scope]} {scope === SharingScope.FIRM ? '(bespoke, to one user)' : '(to a firm)'}
        </h4>
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">
              {scope === SharingScope.FIRM
                ? 'User'
                : scope === SharingScope.ENTERPRISE
                  ? 'Firm (below yours in the org chart)'
                  : 'Firm (with a signed contract)'}
            </span>
            <select
              value={granteeId}
              onChange={(e) => setGranteeId(e.target.value)}
              className="w-64 rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select...</option>
              {eligibleGrantees?.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            {eligibleGrantees?.length === 0 && (
              <p className="mt-1 text-xs text-slate-400">
                {scope === SharingScope.ENTERPRISE
                  ? 'No firms below yours in the org chart.'
                  : scope === SharingScope.THIRD_PARTY
                    ? 'No firms with a signed contract yet.'
                    : 'No users found.'}
              </p>
            )}
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
          <Button disabled={!granteeId} isLoading={grantMutation.isPending} onClick={() => grantMutation.mutate()}>
            Grant
          </Button>
        </div>
      </div>
    </div>
  );
}
