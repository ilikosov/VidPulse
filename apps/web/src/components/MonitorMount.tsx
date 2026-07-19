import { Monitor } from '@vidpulse/monitor';
import { API_BASE_URL } from '../api/client';
import { useServerConfig } from '../serverConfigContext';

/** Mounts the monitor overlay once, gated by the server `monitorEnabled` flag. Route-independent. */
export default function MonitorMount() {
  const { monitorEnabled } = useServerConfig();
  return <Monitor baseUrl={API_BASE_URL} enabled={monitorEnabled} />;
}
