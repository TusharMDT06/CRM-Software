import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'flowdesk_custom_server_url';

// Default Production Backend URL (or fallback to EXPO_PUBLIC_API_URL or production Render URL)
export const DEFAULT_SERVER_URL = (
  process.env.EXPO_PUBLIC_API_URL
    ? process.env.EXPO_PUBLIC_API_URL.replace(/\/api\/?$/, '')
    : 'https://crm-software-wbi9.onrender.com'
).replace(/\/+$/, '');

let cachedServerUrl: string | null = null;
const listeners = new Set<(newUrl: string) => void>();

/**
 * Get the currently configured base server URL (e.g. "https://api.yourdomain.com" or "http://10.82.6.141:5000")
 */
export async function getServerUrl(): Promise<string> {
  if (cachedServerUrl) {
    return cachedServerUrl;
  }
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved && saved.trim()) {
      const clean = saved.trim().replace(/\/+$/, '');
      cachedServerUrl = clean;
      return clean;
    }
  } catch {
    // fallback to default
  }
  cachedServerUrl = DEFAULT_SERVER_URL;
  return DEFAULT_SERVER_URL;
}

/**
 * Synchronous get for immediate cached access (returns default if not yet loaded)
 */
export function getCachedServerUrl(): string {
  return cachedServerUrl || DEFAULT_SERVER_URL;
}

/**
 * Set a new server URL permanently in AsyncStorage and notify active clients
 */
export async function setServerUrl(url: string): Promise<string> {
  const clean = url.trim().replace(/\/api\/?$/, '').replace(/\/+$/, '');
  cachedServerUrl = clean;
  await AsyncStorage.setItem(STORAGE_KEY, clean);
  listeners.forEach((cb) => {
    try {
      cb(clean);
    } catch (e) {
      console.warn('Error in server url listener:', e);
    }
  });
  return clean;
}

/**
 * Reset to default server URL
 */
export async function resetServerUrl(): Promise<string> {
  cachedServerUrl = DEFAULT_SERVER_URL;
  await AsyncStorage.removeItem(STORAGE_KEY);
  listeners.forEach((cb) => cb(DEFAULT_SERVER_URL));
  return DEFAULT_SERVER_URL;
}

/**
 * Subscribe to server URL changes (e.g. to reconnect Socket.IO)
 */
export function onServerUrlChange(callback: (newUrl: string) => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Get API base URL with /api suffix
 */
export function getApiBaseUrl(): string {
  return `${getCachedServerUrl()}/api`;
}

/**
 * Get Socket.IO base URL
 */
export function getSocketBaseUrl(): string {
  return getCachedServerUrl();
}

/**
 * Test connectivity to any candidate server URL
 */
export async function testServerConnection(candidateUrl: string): Promise<{
  ok: boolean;
  latencyMs: number;
  message?: string;
}> {
  const clean = candidateUrl.trim().replace(/\/api\/?$/, '').replace(/\/+$/, '');
  const start = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(`${clean}/api/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - start;
    if (res.ok) {
      return { ok: true, latencyMs };
    }
    // Also try root /health
    const fallbackRes = await fetch(`${clean}/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (fallbackRes.ok) {
      return { ok: true, latencyMs: Date.now() - start };
    }
    return { ok: false, latencyMs, message: `Server returned HTTP ${res.status}` };
  } catch (err: any) {
    clearTimeout(timeoutId);
    return {
      ok: false,
      latencyMs: Date.now() - start,
      message: err.name === 'AbortError' ? 'Connection timed out (6s)' : (err.message || 'Network unreachable'),
    };
  }
}
