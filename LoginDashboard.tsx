import React, { useState, useEffect } from "react";

const API_URL = "https://patak-portal-production.up.railway.app";

interface LoginDashboardProps {
  onLogin: (token: string, username: string) => void;
}

const LoginDashboard: React.FC<LoginDashboardProps> = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Login failed");
      }

      const data = await res.json();
      localStorage.setItem("userToken", data.token);
      localStorage.setItem("username", data.user.username);
      onLogin(data.token, data.user.username);
    } catch (err: any) {
      setError(err.message || "Login error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0057b8 0%, #003d82 100%)",
      padding: isMobile ? "1rem" : "2rem",
      boxSizing: "border-box",
    }}>
      <div className="login-container" style={{
        background: "#fff",
        padding: isMobile ? "1.5rem 1rem" : "2rem",
        borderRadius: "12px",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.15)",
        width: "100%",
        maxWidth: "400px",
        boxSizing: "border-box",
      }}>
        <h2 style={{
          color: "#0057b8",
          textAlign: "center",
          margin: "0 0 0.5rem 0",
          fontSize: isMobile ? "1.5rem" : "1.8rem",
          fontWeight: 700,
        }}>
          PATAK Portal
        </h2>
        
        <p style={{
          color: "#666",
          textAlign: "center",
          margin: "0 0 1.5rem 0",
          fontSize: isMobile ? "0.8rem" : "0.9rem",
        }}>
          Water Management System
        </p>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{
              display: "block",
              marginBottom: "0.5rem",
              color: "#333",
              fontWeight: 600,
              fontSize: isMobile ? "0.85rem" : "0.95rem",
            }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              disabled={loading}
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "16px",
                boxSizing: "border-box",
                transition: "border-color 0.2s, box-shadow 0.2s",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#0057b8";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0, 87, 184, 0.1)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#ddd";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{
              display: "block",
              marginBottom: "0.5rem",
              color: "#333",
              fontWeight: 600,
              fontSize: isMobile ? "0.85rem" : "0.95rem",
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              disabled={loading}
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "16px",
                boxSizing: "border-box",
                transition: "border-color 0.2s, box-shadow 0.2s",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#0057b8";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0, 87, 184, 0.1)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#ddd";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: "0.75rem",
              marginBottom: "1rem",
              background: "#fee",
              color: "#c33",
              borderRadius: "6px",
              fontSize: isMobile ? "0.8rem" : "0.9rem",
              border: "1px solid #fcc",
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "0.85rem",
              background: "#0057b8",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              fontSize: isMobile ? "0.95rem" : "1rem",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              transition: "background 0.2s, transform 0.1s",
              minHeight: "44px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseDown={(e) => {
              if (!loading) (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.98)";
            }}
            onMouseUp={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
            }}
          >
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginDashboard;
