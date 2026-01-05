import React, { useState } from "react";

interface AdminLoginProps {
  onLogin: (token: string) => void;
}

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
      const res = await fetch("/auth/admin-login", {
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
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0057b8 0%, #0047a3 100%)",
      }}
    >
      <div
        style={{
          background: "#fff",
          padding: "2.5rem",
          borderRadius: "16px",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.3)",
          width: "100%",
          maxWidth: "450px",
        }}
      >
        {/* Logo/Title Area */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <h1
            style={{
              color: "#0057b8",
              margin: "0 0 0.5rem 0",
              fontSize: "2rem",
              fontWeight: 700,
            }}
          >
            PATAK
          </h1>
          <p style={{ color: "#666", margin: "0", fontSize: "0.95rem" }}>
            Admin Portal
          </p>
          <p
            style={{
              color: "#999",
              margin: "0.5rem 0 0 0",
              fontSize: "0.85rem",
              fontStyle: "italic",
            }}
          >
            Monitor water consumption & manage users
          </p>
        </div>

        <form onSubmit={handleLogin}>
          {/* Username Field */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                color: "#333",
                fontWeight: 600,
                fontSize: "0.95rem",
              }}
            >
              Admin Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter admin username"
              disabled={loading}
              autoFocus
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                border: "2px solid #ddd",
                borderRadius: "8px",
                fontSize: "1rem",
                boxSizing: "border-box",
                transition: "border-color 0.2s",
                outline: "none",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#0057b8")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#ddd")}
            />
          </div>

          {/* Password Field */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                color: "#333",
                fontWeight: 600,
                fontSize: "0.95rem",
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              disabled={loading}
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                border: "2px solid #ddd",
                borderRadius: "8px",
                fontSize: "1rem",
                boxSizing: "border-box",
                transition: "border-color 0.2s",
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
                marginBottom: "1.5rem",
                background: "#fee",
                color: "#c33",
                borderRadius: "8px",
                fontSize: "0.9rem",
                border: "1px solid #fcc",
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
              padding: "0.85rem",
              background: loading ? "#0057b8cc" : "#0057b8",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontSize: "1rem",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "background 0.2s",
              marginBottom: "1rem",
            }}
            onMouseEnter={(e) => {
              if (!loading) e.currentTarget.style.background = "#003d82";
            }}
            onMouseLeave={(e) => {
              if (!loading) e.currentTarget.style.background = "#0057b8";
            }}
          >
            {loading ? "Logging in..." : "Sign In"}
          </button>
        </form>

        {/* Footer */}
        <div
          style={{
            textAlign: "center",
            paddingTop: "1.5rem",
            borderTop: "1px solid #e0e0e0",
            color: "#999",
            fontSize: "0.85rem",
          }}
        >
          <p style={{ margin: "0" }}>PATAK Thesis Project</p>
          <p style={{ margin: "0.25rem 0 0 0" }}>
            © 2026 Water Management System
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
