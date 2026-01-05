import React, { useState } from "react";
import AdminDashboard from "./AdminDashboard";



function App() {
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
        <h1 style={{ margin: 0 }}>PATAK Admin Portal</h1>
        <p style={{ margin: "0.5rem 0 0 0" }}>
          Admin: Create user accounts and assign ESP32 devices.
        </p>
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
        <AdminDashboard />
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