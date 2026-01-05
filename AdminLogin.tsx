import React, { useState } from "react";

interface AdminLoginProps {
  onLogin: (token: string) => void;
}

const API_URL = "https://patak-portal.onrender.com";

const AdminLogin: React.FC<AdminLoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/admin-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Login failed");
      }

      const data = await res.json();
      localStorage.setItem("adminToken", data.token);
      onLogin(data.token);
    } catch (err: any) {
      setError(err.message || "Login error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        fontFamily: "Poppins, Arial, sans-serif",
        background: "#f5f7fa",
        minHeight: "100vh",
        width: "100vw",
        margin: 0,
        padding: 0,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header - Full Width */}
      <header
        style={{
          padding: "2rem",
          background: "#0057b8",
          color: "#fff",
          textAlign: "center",
          width: "100%",
          boxSizing: "border-box",
          margin: 0,
        }}
      >
        <h1 style={{ margin: 0, fontSize: "2rem", fontWeight: 700 }}>
          PATAK Supplier Portal
        </h1>
        <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.95rem" }}>
          Revolutionizing water management through IoT. Monitor consumption, automate billing, and empower communities.
        </p>
      </header>

      {/* Main Content */}
      <main
        style={{
          flex: 1,
          padding: "3rem 2rem",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <div
          style={{
            background: "#fff",
            padding: "3rem 2.5rem",
            borderRadius: "12px",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)",
            width: "100%",
            maxWidth: "500px",
            textAlign: "center",
          }}
        >
          {/* Thesis Project Description */}
          <p
            style={{
              color: "#666",
              margin: "0 0 2rem 0",
              fontSize: "0.95rem",
              lineHeight: "1.6",
              fontWeight: 500,
            }}
          >
            <strong style={{ color: "#0057b8" }}>Thesis Project Design:</strong>
            <br />
            <span style={{ fontSize: "0.9rem", color: "#888" }}>
              A modern IoT-based water consumption and billing system. This portal
              enables suppliers to monitor water usage, manage automated billing,
              and provide actionable insights for efficient and sustainable water
              management.
            </span>
          </p>

          {/* Login Heading */}
          <h2
            style={{
              color: "#0057b8",
              margin: "1rem 0 1.5rem 0",
              fontSize: "1.3rem",
              fontWeight: 600,
            }}
          >
            Supplier Login
          </h2>

          <form onSubmit={handleLogin}>
            {/* Username Field */}
            <div style={{ marginBottom: "1.2rem", textAlign: "left" }}>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                disabled={loading}
                autoFocus
                style={{
                  width: "100%",
                  padding: "0.9rem 1rem",
                  border: "2px solid #ddd",
                  borderRadius: "6px",
                  fontSize: "1rem",
                  boxSizing: "border-box",
                  transition: "border-color 0.3s",
                  fontFamily: "inherit",
                  outline: "none",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#0057b8")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#ddd")}
              />
            </div>

            {/* Password Field */}
            <div style={{ marginBottom: "1.5rem", textAlign: "left" }}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "0.9rem 1rem",
                  border: "2px solid #ddd",
                  borderRadius: "6px",
                  fontSize: "1rem",
                  boxSizing: "border-box",
                  transition: "border-color 0.3s",
                  fontFamily: "inherit",
                  outline: "none",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#0057b8")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#ddd")}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div
                style={{
                  padding: "0.75rem 1rem",
                  marginBottom: "1rem",
                  background: "#fff3cd",
                  color: "#856404",
                  borderRadius: "6px",
                  fontSize: "0.9rem",
                  border: "1px solid #ffeaa7",
                }}
              >
                ⚠️ {error}
              </div>
            )}

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "0.9rem",
                background: "#0057b8",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                transition: "background 0.3s",
                opacity: loading ? 0.8 : 1,
              }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.background = "#003d82";
              }}
              onMouseLeave={(e) => {
                if (!loading) e.currentTarget.style.background = "#0057b8";
              }}
            >
              {loading ? "Logging in..." : "Log In"}
            </button>
          </form>
        </div>
      </main>

      {/* Footer - Full Width */}
      <footer
        style={{
          textAlign: "center",
          padding: "1.5rem 2rem",
          color: "#888",
          width: "100vw",
          background: "#fff",
          borderTop: "1px solid #e0e0e0",
          boxSizing: "border-box",
          margin: 0,
        }}
      >
        <div>
          &copy; 2026 PATAK. Guard every drop.
        </div>
      </footer>
    </div>
  );
};

export default AdminLogin;
