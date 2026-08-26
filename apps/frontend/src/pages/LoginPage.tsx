import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { ApiError } from '../api/client';
import { Button } from '../components/ui/Button';
import { ErrorBanner } from '../components/ui/ErrorBanner';

export function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('owner@northbridge.test');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-brand-700">Model Portfolio</h1>
        <p className="mb-6 text-sm text-slate-500">Sign in to continue.</p>

        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>

        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-slate-600">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            required
          />
        </label>

        <label className="mb-6 block text-sm">
          <span className="mb-1 block text-slate-600">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            required
          />
        </label>

        <Button type="submit" isLoading={submitting} loadingLabel="Signing in..." className="w-full">
          Sign in
        </Button>

        <p className="mt-4 text-xs text-slate-400">
          Demo seed users (password <code>Password123!</code>): owner@northbridge.test,
          advisor@northbridge.test, owner@aldgate.test, admin@platform.test
        </p>
      </form>
    </div>
  );
}
