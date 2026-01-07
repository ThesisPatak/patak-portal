import { Platform } from 'react-native';

// Configure your server URL here or via environment variable
const DEFAULT_SERVER_URL = process.env.REACT_APP_API_URL || 'https://patak-portal.onrender.com';

// Allow manual override of server URL (stored in memory for session)
let serverBaseUrl = null;

const Api = {
  // Set custom server URL
  setServerUrl: (url) => {
    serverBaseUrl = url;
    console.log('Server URL set to', url);
  },

  // Get current server URL
  getServerUrl: async () => {
    if (serverBaseUrl) return serverBaseUrl;
    serverBaseUrl = DEFAULT_SERVER_URL;
    return serverBaseUrl;
  },

  // Attempt to login with username and password
  login: async (username, password, customServerUrl) => {
    const baseUrl = customServerUrl || (await Api.getServerUrl());
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
      if (customServerUrl) Api.setServerUrl(customServerUrl);
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

  // Usage for a specific house (token = houseId)
  getUsage: async (token) => {
    const baseUrl = await Api.getServerUrl();
    const res = await fetch(`${baseUrl}/api/houses/${encodeURIComponent(token)}`);
    if (!res.ok) throw new Error('Failed to load usage');
    return res.json();
  },

  // Register a device for the authenticated user (owner)
  // Returns: { device: { deviceId, owner, houseId }, deviceToken }
  registerDevice: async (authToken, deviceId, houseId = null, meta = {}) => {
    const baseUrl = await Api.getServerUrl();
    const res = await fetch(`${baseUrl}/devices/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({ deviceId, houseId, meta })
    });
    if (!res.ok) {
      const text = await res.text();
      const err = new Error('Device registration failed: ' + text);
      err.status = res.status;
      throw err;
    }
    return res.json();
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
