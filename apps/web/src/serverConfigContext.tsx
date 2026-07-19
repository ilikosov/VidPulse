import { createContext, useContext, useEffect, useState } from 'react';
import type { ServerConfigResponse } from '@vidpulse/shared';
import { getServerConfig } from './api';

const DEFAULTS: ServerConfigResponse = {
  monitorEnabled: false,
  dangerousActionsEnabled: false,
};

const ServerConfigContext = createContext<ServerConfigResponse>(DEFAULTS);

/**
 * Fetches the whitelisted server flags (GET /api/config) once at startup and exposes them to the app.
 * Needed because config now lives server-side in vidpulse.config.yaml and can't be read by the browser.
 */
export function ServerConfigProvider({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState<ServerConfigResponse>(DEFAULTS);
  useEffect(() => {
    getServerConfig()
      .then(setFlags)
      .catch(() => undefined);
  }, []);
  return <ServerConfigContext.Provider value={flags}>{children}</ServerConfigContext.Provider>;
}

export function useServerConfig(): ServerConfigResponse {
  return useContext(ServerConfigContext);
}
