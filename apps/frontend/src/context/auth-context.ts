import { createContext } from 'react';
import type { Role } from '@model-portfolio/shared';

export interface CurrentUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  firmId: string;
}

export interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

// Split out of AuthContext.tsx (which now only exports the AuthProvider
// component) and useAuth.ts, per react-refresh/only-export-components:
// a file exporting a mix of components and non-components can't be Fast
// Refreshed reliably.
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
