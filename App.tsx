import React, { useState } from "react";
import AdminDashboard from "./AdminDashboard";
import UsageDashboard from "./UsageDashboard";
import LoginDashboard from "./LoginDashboard";

function App() {
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem("userToken") || "";
    } catch {
      return "";
    }
  });
  
  const [username, setUsername] = useState(() => {
    try {
      return localStorage.getItem("username") || "";
    } catch {
      return "";
    }
  });

  const handleLogin = (newToken: string, newUsername: string) => {
    setToken(newToken);
    setUsername(newUsername);
  };

  const handleLogout = () => {
    localStorage.removeItem("userToken");
    localStorage.removeItem("username");
    setToken("");
    setUsername("");
  };

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
        }}
      >
        <h1 style={{ margin: 0 }}>PATAK Supplier Portal</h1>
        <p style={{ margin: "0.5rem 0 0 0" }}>
          Revolutionizing water management through IoT. Monitor consumption, automate billing, and empower communities.
        </p>
      </header>
      <main
        style={{
          flex: 1,
          width: "100vw",
          height: "100%",
          padding: "2rem",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          overflow: "auto",
        }}
      >
        {token ? (
          <UsageDashboard token={token} username={username} onLogout={handleLogout} />
        ) : (
          <LoginDashboard onLogin={handleLogin} />
        )}
      </main>
      <footer style={{ textAlign: "center", padding: "1.5rem 0", color: "#888", width: "100%", background: "#fff", borderTop: "1px solid #e0e0e0" }}>
        <div>
          &copy; 2026 PATAK. Guard every drop.
        </div>
      </footer>
    </div>
  );
}

export default App;