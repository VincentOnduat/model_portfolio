import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ModelAim, ModelRisk, type ModelDetail } from '@model-portfolio/shared';
import { api, ApiError } from '../../api/client';

/** Guide 4.1.2 "Model Details": preliminary data entered when creating a new model. */
export function CreateModelPage() {
  const navigate = useNavigate();
  const [reference, setReference] = useState('');
  const [name, setName] = useState('');
  const [minimumTradeValue, setMinimumTradeValue] = useState('250');
  const [aim, setAim] = useState<ModelAim>(ModelAim.NOT_SPECIFIED);
  const [risk, setRisk] = useState<ModelRisk>(ModelRisk.NOT_SPECIFIED);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const model = await api.post<ModelDetail>('/models', {
        reference,
        name,
        minimumTradeValue: Number(minimumTradeValue),
        aim,
        risk,
      });
      navigate(`/models/${model.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create model.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold">Create New Model</h1>
      <p className="mt-1 text-sm text-slate-500">
        The model starts as a Draft, 100% allocated to cash. Add and allocate assets afterwards, then
        Publish to make it Live.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Model Reference</span>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. BAL-GROWTH-02"
            pattern="[A-Za-z0-9_-]+"
            title="Letters, digits, dash and underscore only - no spaces."
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            required
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Model Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            required
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Minimum Trade Value (£)</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={minimumTradeValue}
            onChange={(e) => setMinimumTradeValue(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            required
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Aim</span>
            <select
              value={aim}
              onChange={(e) => setAim(e.target.value as ModelAim)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {Object.values(ModelAim).map((a) => (
                <option key={a} value={a}>
                  {a.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Risk</span>
            <select
              value={risk}
              onChange={(e) => setRisk(e.target.value as ModelRisk)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {Object.values(ModelRisk).map((r) => (
                <option key={r} value={r}>
                  {r.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {submitting ? 'Creating...' : 'Create Model'}
        </button>
      </form>
    </div>
  );
}
