// Keep-Alive Service: Prevents Render free tier server from sleeping
// Pings the backend every 5 minutes to keep it warm and responsive

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://patak-portal-production.up.railway.app';
const KEEP_ALIVE_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds (keeps server warm without hitting Render limits)
let keepAliveTimer = null;

export function startKeepAlive() {
  if (keepAliveTimer) return; // Already running

  // Ping immediately on start
  pingBackend();

  // Then ping every 5 minutes
  keepAliveTimer = setInterval(pingBackend, KEEP_ALIVE_INTERVAL);
  console.log('[KeepAlive] Service started - will ping backend every 5 minutes to prevent cold-start');
}

export function stopKeepAlive() {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
    console.log('[KeepAlive] Service stopped');
  }
}

async function pingBackend() {
  try {
    const response = await fetch(`${BACKEND_URL}/health`, {
      method: 'GET',
      timeout: 5000, // 5 second timeout
    });

    if (response.ok) {
      const data = await response.json();
      console.log('[KeepAlive] Ping successful at', data.timestamp);
    } else {
      // Silently fail on 404 - not critical if endpoint doesn't exist on all servers
      if (response.status !== 404) {
        console.warn('[KeepAlive] Ping failed with status', response.status);
      }
    }
  } catch (error) {
    // Silently fail - don't disrupt user experience
    // Keep-alive is best-effort, not critical
    console.log('[KeepAlive] Ping error (non-critical):', error.message);
  }
}
