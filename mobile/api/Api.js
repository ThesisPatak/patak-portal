import { Platform } from 'react-native';

// Production server URL - locked to Railway
const DEFAULT_SERVER_URL = 'https://patak-portal-production.up.railway.app';

const Api = {
  // Get production server URL (always returns Railway)
  getServerUrl: async () => {
    return DEFAULT_SERVER_URL;
  },

  // Attempt to login with username and password (always uses Railway in production)
  login: async (username, password) => {
    const baseUrl = DEFAULT_SERVER_URL;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 second timeout for auth operations
    
    try {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        const error = new Error('Login failed');
        error.status = res.status;
        throw error;
      }
      const data = await res.json();
      return { token: data.token, user: data.user };
    } catch (e) {
      clearTimeout(timeoutId);
      throw e;
    }
  },

  // Dashboard: return overall summary (requires token)
  getDashboard: async (token) => {
    const baseUrl = await Api.getServerUrl();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 second timeout
    
    try {
      const res = await fetch(`${baseUrl}/api/houses`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (!res.ok) throw new Error('Failed to load dashboard');
      return res.json();
    } catch (e) {
      clearTimeout(timeoutId);
      throw e;
    }
  },

  // Usage for a specific house (returns history of readings for authenticated user)
  getUsage: async (token) => {
    const baseUrl = await Api.getServerUrl();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    try {
      const res = await fetch(`${baseUrl}/api/user/readings`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        const errorData = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorData}`);
      }
      return res.json();
    } catch (e) {
      clearTimeout(timeoutId);
      throw e;
    }
  },

  // Check if user has any registered devices
  // Returns: { devices: [...], hasDevices: boolean }
  checkDeviceRegistration: async (authToken) => {
    const baseUrl = await Api.getServerUrl();
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
    
    try {
      const res = await fetch(`${baseUrl}/devices/list`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Failed to check devices`)
      }
      const data = await res.json()
      return {
        devices: data.devices || [],
        hasDevices: (data.devices && data.devices.length > 0)
      }
    } catch (err) {
      clearTimeout(timeoutId)
      if (err.name === 'AbortError') {
        throw new Error('Device check timeout - check your internet connection')
      }
      throw err
    }
  },

  // Register a device for the authenticated user (owner)
  // Returns: { device: { deviceId, owner, houseId }, deviceToken }
  registerDevice: async (authToken, deviceId, houseId = null, meta = {}) => {
    const baseUrl = await Api.getServerUrl();
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
    
    try {
      const res = await fetch(`${baseUrl}/devices/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ deviceId, houseId, meta }),
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      
      if (!res.ok) {
        const text = await res.text()
        const err = new Error(`HTTP ${res.status}: ${text}`)
        err.status = res.status
        throw err
      }
      return res.json()
    } catch (err) {
      clearTimeout(timeoutId)
      if (err.name === 'AbortError') {
        throw new Error('Device registration timeout - check your internet connection')
      }
      throw err
    }
  },

  // Reset readings for a house (admin function)
  resetReadings: async (authToken, house) => {
    const baseUrl = await Api.getServerUrl();
    const res = await fetch(`${baseUrl}/api/reset-readings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({ house })
    });
    if (!res.ok) throw new Error('Failed to reset readings');
    return res.json();
  }
};

export default Api;
