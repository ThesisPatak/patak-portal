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
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        background: "#f0f2f5",
        fontFamily: "Poppins, Arial, sans-serif",
        padding: "20px",
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
        {/* Title */}
        <h1
          style={{
            color: "#0057b8",
            margin: "0 0 0.5rem 0",
            fontSize: "1.8rem",
            fontWeight: 700,
            letterSpacing: "-0.5px",
          }}
        >
          PATAK Supplier Portal
        </h1>

        {/* Subtitle */}
        <p
          style={{
            color: "#666",
            margin: "0 0 2rem 0",
            fontSize: "0.95rem",
            lineHeight: "1.5",
            fontWeight: 500,
          }}
        >
          Thesis Project Design:
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
            margin: "2rem 0 1.5rem 0",
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
    </div>
  );
};

export default AdminLogin;
