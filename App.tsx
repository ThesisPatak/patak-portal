import React, { useState } from "react";
import UsageDashboard from "./UsageDashboard";
import BillingTable from "./BillingTable";

const mockSupplier = {
  username: "landokabado",
  password: "123123"
};

function App() {
  const [loggedIn, setLoggedIn] = useState<boolean>(() => {
    try {
      return localStorage.getItem('loggedIn') === 'true';
    } catch (e) {
      return false;
    }
  });
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      form.username === mockSupplier.username &&
      form.password === mockSupplier.password
    ) {
      setLoggedIn(true);
      setError("");
      try { localStorage.setItem('loggedIn', 'true'); } catch (e) { /* ignore */ }
    } else {
      setError("Invalid credentials. Please try again.");
    }
  };

  const handleLogout = () => {
    setLoggedIn(false);
    setForm({ username: "", password: "" });
    setError("");
    try { localStorage.removeItem('loggedIn'); } catch (e) { /* ignore */ }
  };

  if (!loggedIn) {
    return (
      <div
        style={{
          minHeight: "100vh",
          minWidth: "100vw",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f5f7fa",
        }}
      >
        <div style={{
          background: "#fff",
          padding: "2.5rem 3rem 2rem 3rem",
          borderRadius: "16px",
          boxShadow: "0 4px 24px #0001",
          minWidth: "350px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center"
        }}>
          <h1 style={{ color: "#0057b8", margin: "0 0 0.5rem 0" }}>PATAK Supplier Portal</h1>
          <p style={{
            color: "#444",
            marginBottom: "1.5rem",
            textAlign: "center",
            fontSize: "1rem",
            maxWidth: "350px"
          }}>
            <strong>Thesis Project Design:</strong><br />
            A modern IoT-based water consumption and billing system. This portal enables suppliers to monitor water usage, manage automated billing, and provide actionable insights for efficient and sustainable water management.
          </p>
          <form
            onSubmit={handleLogin}
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            <h2 style={{ color: "#0057b8", marginBottom: "1rem", textAlign: "center" }}>Supplier Login</h2>
            <input
              type="text"
              name="username"
              placeholder="Username"
              value={form.username}
              onChange={handleChange}
              style={{ padding: "0.5rem", fontSize: "1rem", borderRadius: "8px", border: "1px solid #ddd" }}
              required
            />
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
              style={{ padding: "0.5rem", fontSize: "1rem", borderRadius: "8px", border: "1px solid #ddd" }}
              required
            />
            <button
              type="submit"
              style={{
                background: "#0057b8",
                color: "#fff",
                padding: "0.7rem",
                border: "none",
                borderRadius: "8px",
                fontWeight: "bold",
                fontSize: "1rem",
                cursor: "pointer"
              }}
            >
              Log In
            </button>
            {error && <div style={{ color: "#c70039", fontWeight: "bold", textAlign: "center" }}>{error}</div>}
          </form>
        </div>
      </div>
    );
  }

  // Dashboard (shown only when logged in)
  return (
    <div
      style={{
        fontFamily: "Poppins, Arial, sans-serif",
        background: "#f5f7fa",
        minHeight: "100vh",
        minWidth: "100vw",
        width: "100vw",
        height: "100vh",
        margin: 0,
        padding: 0,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          padding: "2rem 0",
          background: "#0057b8",
          color: "#fff",
          textAlign: "center",
          width: "100%",
          position: "relative"
        }}
      >
        <h1 style={{ margin: 0 }}>PATAK Supplier Portal</h1>
        <p style={{ margin: "0.5rem 0 0 0" }}>
          Revolutionizing water management through IoT. Monitor consumption, automate billing, and empower communities.
        </p>
        {/* LOGOUT BUTTON */}
        <button
          onClick={() => {
            if (window.confirm('Log out?')) handleLogout();
          }}
          style={{
            position: "absolute",
            top: "1.5rem",
            right: "2rem",
            background: "#fff",
            color: "#0057b8",
            border: "2px solid #0057b8",
            borderRadius: "8px",
            padding: "0.5rem 1.2rem",
            fontWeight: "bold",
            fontSize: "1rem",
            cursor: "pointer",
            boxShadow: "0 2px 8px #0002"
          }}
        >
          Log out
        </button>
      </header>
      <main
        style={{
          flex: 1,
          width: "100vw",
          height: "100%",
          padding: "2rem 0",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
        }}
      >
        <div
          style={{
            width: "95vw",
            maxWidth: "1600px",
            background: "#fff",
            borderRadius: "16px",
            boxShadow: "0 4px 24px #0001",
            padding: "2rem",
            boxSizing: "border-box",
            margin: "auto",
          }}
        >
          <UsageDashboard />
          <hr style={{ margin: "2rem 0" }} />
          <BillingTable />
        </div>
      </main>
      <footer style={{ textAlign: "center", padding: "1.5rem 0 0 0", color: "#888", width: "100%", background: "#fff" }}>
        <div>
          &copy; {new Date().getFullYear()} PATAK. Guard every drop.
        </div>
      </footer>
    </div>
  );
}

export default App;