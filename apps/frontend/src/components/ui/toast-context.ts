import { createContext } from 'react';

export interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
}

// Split out of Toast.tsx (which now only exports the ToastProvider
// component) and useToast.ts, per react-refresh/only-export-components:
// a file exporting a mix of components and non-components can't be Fast
// Refreshed reliably. Mirrors context/auth-context.ts's split.
export const ToastContext = createContext<ToastContextValue | null>(null);
