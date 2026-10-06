import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { PublicClientApplication } from '@azure/msal-browser';
import type { Role } from '@erp/shared';
import { api } from './api';
import type { Me } from './types';

interface AuthConfig {
  entra: { tenantId: string; clientId: string } | null;
  devLogin: boolean;
}

interface AuthState {
  me: Me | null;
  loading: boolean;
  config: AuthConfig | null;
  loginMicrosoft: () => Promise<void>;
  loginDev: (email: string, name: string, role: Role) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>(null!);
export const useAuth = () => useContext(AuthContext);

let msal: PublicClientApplication | null = null;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const cfg = await api.get<AuthConfig>('/auth/config');
        setConfig(cfg);
        if (cfg.entra && !msal) {
          msal = new PublicClientApplication({
            auth: {
              clientId: cfg.entra.clientId,
              authority: `https://login.microsoftonline.com/${cfg.entra.tenantId}`,
              redirectUri: window.location.origin,
            },
            cache: { cacheLocation: 'sessionStorage' },
          });
          await msal.initialize();
        }
        setMe(await api.get<Me>('/auth/me'));
      } catch {
        setMe(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loginMicrosoft = useCallback(async () => {
    if (!msal) throw new Error('Microsoft sign-in is not configured');
    const result = await msal.loginPopup({ scopes: ['openid', 'profile', 'email'], prompt: 'select_account' });
    setMe(await api.post<Me>('/auth/entra', { idToken: result.idToken }));
  }, []);

  const loginDev = useCallback(async (email: string, name: string, role: Role) => {
    setMe(await api.post<Me>('/auth/dev-login', { email, name, role }));
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout');
    setMe(null);
    if (msal?.getActiveAccount()) await msal.clearCache();
  }, []);

  return (
    <AuthContext.Provider value={{ me, loading, config, loginMicrosoft, loginDev, logout }}>{children}</AuthContext.Provider>
  );
}
