// Keep-Alive Service: Prevents Render free tier server from sleeping
// Pings the backend every 5 minutes to keep it warm and responsive
// Also maintains session even when app is backgrounded

import { AppState } from 'react-native';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://patak-portal-production.up.railway.app';
const KEEP_ALIVE_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds
let keepAliveTimer = null;
let lastPingTime = null;

export function startKeepAlive() {
  if (keepAliveTimer) return; // Already running

  console.log('[KeepAlive] Service starting...');
  
  // Ping immediately on start
  pingBackend();

  // Then ping every 5 minutes (keeps running even in background)
  keepAliveTimer = setInterval(() => {
    pingBackend();
  }, KEEP_ALIVE_INTERVAL);

  console.log('[KeepAlive] Service started - pinging every 5 minutes');
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
    const now = new Date().toLocaleTimeString();
    const response = await fetch(`${BACKEND_URL}/health`, {
      method: 'GET',
      timeout: 8000, // 8 second timeout for background pings
    });

    if (response.ok) {
      lastPingTime = new Date();
      const data = await response.json();
      console.log(`[KeepAlive] ✓ Ping successful at ${now} - Server is alive`);
    } else {
      // Silently fail on 404 - endpoint may not exist
      if (response.status !== 404) {
        console.warn(`[KeepAlive] Ping returned status ${response.status}`);
      }
    }
  } catch (error) {
    // Silently fail - keep-alive is best-effort
    if (error.message && error.message.includes('Network')) {
      console.log('[KeepAlive] Network unavailable - will retry next interval');
    } else {
      console.log('[KeepAlive] Ping error (non-critical):', error.message);
    }
  }
}

// Get last successful ping time for diagnostics
export function getLastPingTime() {
  return lastPingTime ? lastPingTime.toLocaleTimeString() : 'Never';
}
