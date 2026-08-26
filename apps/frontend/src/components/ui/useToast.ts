import { useContext } from 'react';
import { ToastContext, type ToastContextValue } from './toast-context';

// Split into its own file (rather than living in Toast.tsx) so that file
// only exports components - keeps Vite's react-refresh plugin able to Fast
// Refresh ToastProvider without a full page reload.
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider.');
  return ctx;
}
