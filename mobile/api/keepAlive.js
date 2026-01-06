// Keep-Alive Service: Prevents Render free tier server from sleeping
// Pings the backend every 12 minutes to keep it warm and responsive

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:4000';
const KEEP_ALIVE_INTERVAL = 12 * 60 * 1000; // 12 minutes in milliseconds
let keepAliveTimer = null;

export function startKeepAlive() {
  if (keepAliveTimer) return; // Already running

  // Ping immediately on start
  pingBackend();

  // Then ping every 12 minutes
  keepAliveTimer = setInterval(pingBackend, KEEP_ALIVE_INTERVAL);
  console.log('[KeepAlive] Service started - will ping backend every 12 minutes');
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
      console.warn('[KeepAlive] Ping failed with status', response.status);
    }
  } catch (error) {
    // Silently fail - don't disrupt user experience
    // Keep-alive is best-effort, not critical
    console.log('[KeepAlive] Ping error (non-critical):', error.message);
  }
}
