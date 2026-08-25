import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from './auth-context';

// Split into its own file (rather than living in AuthContext.tsx) so that
// file only exports components - keeps Vite's react-refresh plugin able to
// Fast Refresh AuthProvider without a full page reload.
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
