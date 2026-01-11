import React, { useEffect, useState } from "react";
import AdminUsers from "./AdminUsers";
import AdminLogin from "./AdminLogin";

interface UserData {
  id: string;
  username: string;
  cubicMeters: number;
  totalLiters: number;
  deviceCount: number;
  lastReading: string | null;
  devices: Array<{ deviceId: string; status: string; lastSeen: string | null }>;
}

const API_URL = "https://patak-portal-production.up.railway.app";

const AdminDashboard: React.FC = () => {
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem("adminToken") || "";
    } catch {
      return "";
    }
  });
  const [adminUsername, setAdminUsername] = useState(() => {
    try {
      return localStorage.getItem("adminUsername") || "";
    } catch {
      return "";
    }
  });

  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userReadings, setUserReadings] = useState<any[]>([]);
  const [readingsLoading, setReadingsLoading] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState("");

  // Handle admin login
  const handleLogin = (newToken: string, username: string) => {
    setToken(newToken);
    setAdminUsername(username);
  };

  // Confirm logout
  const confirmLogout = () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminUsername");
    setToken("");
    setAdminUsername("");
    setUsers([]);
    setSelectedUserId(null);
    setShowLogoutConfirm(false);
  };

  // Handle logout (show confirmation)
  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  // Load dashboard data
  const loadDashboard = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/dashboard`, {
        headers: { Authorization: "Bearer " + token },
      });
      if (!res.ok) throw new Error("Failed to load dashboard");
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error("Dashboard error:", err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  // Load user readings
  const loadUserReadings = async (userId: string) => {
    setReadingsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${userId}/readings`, {
        headers: { Authorization: "Bearer " + token },
      });
      if (!res.ok) throw new Error("Failed to load readings");
      const data = await res.json();
      setUserReadings(data.readings || []);
    } catch (err) {
      console.error("Readings error:", err);
      setUserReadings([]);
    } finally {
      setReadingsLoading(false);
    }
  };

  // Delete user account
  const deleteUser = async (userId: string, username: string) => {
    if (!window.confirm(`Are you sure you want to delete user "${username}" and all their data? This cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token },
      });

      if (!res.ok) throw new Error("Failed to delete user");
      
      setUsers(users.filter(u => u.id !== userId));
      if (selectedUserId === userId) {
        setSelectedUserId(null);
        setUserReadings([]);
      }
      alert(`User ${username} deleted successfully`);
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete user");
    }
  };

  // Reset readings for a specific device
  const resetDeviceReadings = async (deviceId: string) => {
    if (!window.confirm(`Clear all readings for device "${deviceId}"? This cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`${API_URL}/admin/reset-device-readings`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: "Bearer " + token 
        },
        body: JSON.stringify({ deviceId }),
      });

      if (!res.ok) throw new Error("Failed to reset readings");
      
      alert(`Readings cleared for device ${deviceId}`);
      loadDashboard(); // Refresh dashboard
    } catch (err) {
      console.error("Reset error:", err);
      alert("Failed to reset readings");
    }
  };

  // Reset all readings
  const resetAllReadings = async () => {
    if (!window.confirm(`Clear ALL readings for all devices? This cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`${API_URL}/admin/reset-readings`, {
        method: "POST",
        headers: { 
          Authorization: "Bearer " + token 
        },
      });

      if (!res.ok) throw new Error("Failed to reset readings");
      
      alert("All readings cleared successfully");
      loadDashboard(); // Refresh dashboard
    } catch (err) {
      console.error("Reset error:", err);
      alert("Failed to reset readings");
    }
  };

  // Change admin password
  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordSuccess("");

    if (!currentPassword) {
      setPasswordError("Current password is required");
      return;
    }
    if (!newPassword) {
      setPasswordError("New password is required");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/change-password`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: "Bearer " + token 
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to change password");
      }

      setPasswordSuccess("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setShowPasswordChange(false);
        setPasswordSuccess("");
      }, 2000);
    } catch (err: any) {
      setPasswordError(err.message || "Failed to change password");
    } finally {
      setPasswordLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 5000); // Refresh every 5 seconds
    
    // Handle window resize for mobile detection
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", handleResize);
    };
  }, [token]);

  return (
    <>
      {!token ? (
        <AdminLogin onLogin={handleLogin} />
      ) : (
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
              padding: isMobile ? "1rem 1rem" : "1.5rem 2rem",
              background: "#0057b8",
              color: "#fff",
              width: "100vw",
              boxSizing: "border-box",
              margin: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              textAlign: "center",
              position: "relative",
            }}
          >
            <div style={{ marginBottom: "0.5rem", fontSize: isMobile ? "0.8rem" : "0.9rem", opacity: 0.9 }}>
              Admin Panel • {adminUsername}
            </div>
            <h1 style={{ margin: 0, fontSize: isMobile ? "1.3rem" : "2rem", fontWeight: 700 }}>
              PATAK Supplier Portal
            </h1>
            <p style={{ margin: "0.25rem 0 0 0", fontSize: isMobile ? "0.75rem" : "0.9rem" }}>
              Revolutionizing water management through IoT. Monitor consumption, automate billing, and empower communities.
            </p>
            <div style={{ position: "absolute", right: isMobile ? "1rem" : "2rem", top: "50%", transform: "translateY(-50%)", display: "flex", gap: "0.5rem", flexDirection: isMobile ? "column" : "row" }}>
              <button
                onClick={() => setShowPasswordChange(true)}
                style={{
                  padding: isMobile ? "0.4rem 0.8rem" : "0.6rem 1.2rem",
                  background: "#ffc107",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: isMobile ? "0.75rem" : "0.9rem",
                  color: "#333",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                Change Password
              </button>
              <button
                onClick={handleLogout}
                style={{
                  padding: isMobile ? "0.4rem 0.8rem" : "0.6rem 1.2rem",
                  background: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: isMobile ? "0.75rem" : "0.9rem",
                  color: "#0057b8",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                Log out
              </button>
            </div>
          </header>

          {/* Main Content */}
          <main
            style={{
              flex: 1,
              padding: isMobile ? "1rem" : "2rem",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              overflow: "auto",
              width: "100%",
            }}
          >
            <div style={{ width: "100%", maxWidth: isMobile ? "100%" : "1400px" }}>
              {/* Real-Time Water Usage Section */}
              <section style={{ marginBottom: "3rem" }}>
                <h2 style={{ color: "#0057b8", fontSize: isMobile ? "1.2rem" : "1.5rem", marginBottom: "1.5rem", fontWeight: 600 }}>
                  Real-Time Water Usage
                </h2>

                {/* Total Stats Card */}
                <div style={{ background: "#e2f0ff", padding: isMobile ? "1.5rem" : "2rem", borderRadius: "12px", width: isMobile ? "100%" : "300px", marginBottom: "2rem", margin: isMobile ? "0 0 2rem 0" : "0 auto 2rem auto", textAlign: "center" }}>
                  <div style={{ fontSize: isMobile ? "0.85rem" : "0.95rem", color: "#666", fontWeight: 500, marginBottom: "0.5rem" }}>
                    Total (m³)
                  </div>
                  <div style={{ fontSize: isMobile ? "2rem" : "2.5rem", fontWeight: 700, color: "#0057b8" }}>
                    {users.reduce((sum, u) => sum + u.cubicMeters, 0).toFixed(6)} m³
                  </div>
                  <div style={{ fontSize: isMobile ? "0.75rem" : "0.85rem", color: "#666", marginTop: "0.5rem" }}>
                    Across all houses
                  </div>
                </div>

                {/* Per-House Cards */}
                {users.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: isMobile ? "0.8rem" : "1rem", marginBottom: "2rem" }}>
                    {users.map((user) => (
                      <div key={user.id} style={{ background: "#f9f9f9", padding: isMobile ? "1rem" : "1.5rem", borderRadius: "12px", border: "1px solid #e0e0e0" }}>
                        <div style={{ fontSize: isMobile ? "0.8rem" : "0.9rem", color: "#333", fontWeight: 600, marginBottom: "0.5rem" }}>
                          {user.username}
                        </div>
                        <div style={{ fontSize: isMobile ? "1.5rem" : "1.8rem", fontWeight: 700, color: "#0057b8" }}>
                          {user.cubicMeters.toFixed(6)} m³
                        </div>
                        <div style={{ fontSize: isMobile ? "0.7rem" : "0.8rem", color: "#999", marginTop: "0.3rem" }}>
                          {user.lastReading ? new Date(user.lastReading).toLocaleTimeString() : "No data"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Separator */}
              <div style={{ height: "1px", background: "#ddd", margin: "2rem 0" }} />

              {/* Automated Billing Section */}
              <section>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                  <h2 style={{ color: "#0057b8", fontSize: isMobile ? "1.2rem" : "1.5rem", margin: 0, fontWeight: 600 }}>
                    Automated Billing
                  </h2>
                  <button
                    onClick={resetAllReadings}
                    style={{
                      padding: isMobile ? "0.4rem 0.8rem" : "0.6rem 1.2rem",
                      background: "#dc3545",
                      color: "#fff",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: isMobile ? "0.75rem" : "0.9rem",
                      fontWeight: 600,
                    }}
                  >
                    Reset All Readings
                  </button>
                </div>

                <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 2px 8px #0000000f", overflow: "hidden", overflowX: "auto" }}>
                  {/* Mobile card view / Desktop table view */}
                  {isMobile ? (
                    // Mobile card view
                    <div style={{ padding: "1rem" }}>
                      {users.length === 0 ? (
                        <div style={{ padding: "1.5rem", textAlign: "center", color: "#999", fontSize: "0.9rem" }}>
                          No users registered yet
                        </div>
                      ) : (
                        users.map((user) => (
                          <div
                            key={user.id}
                            style={{
                              background: "#f9f9f9",
                              padding: "1rem",
                              marginBottom: "0.75rem",
                              borderRadius: "8px",
                              border: "1px solid #e0e0e0",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                              <div style={{ fontWeight: 600, color: "#333", fontSize: "0.95rem" }}>
                                {user.username}
                              </div>
                              <div style={{ display: "flex", gap: "0.4rem", flexDirection: "column" }}>
                                <button
                                  onClick={() => resetDeviceReadings(user.devices[0]?.deviceId || user.username)}
                                  style={{
                                    padding: "0.4rem 0.8rem",
                                    background: "#ffc107",
                                    color: "#333",
                                    border: "none",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    fontSize: "0.75rem",
                                    fontWeight: 600,
                                    minHeight: "auto",
                                  }}
                                >
                                  Reset Readings
                                </button>
                                <button
                                  onClick={() => deleteUser(user.id, user.username)}
                                  style={{
                                    padding: "0.4rem 0.8rem",
                                    background: "#dc3545",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    fontSize: "0.75rem",
                                    fontWeight: 600,
                                    minHeight: "auto",
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", fontSize: "0.85rem" }}>
                              <div>
                                <div style={{ color: "#666", marginBottom: "0.2rem" }}>Usage (m³)</div>
                                <div style={{ fontSize: "1.1rem", fontWeight: 600, color: "#0057b8" }}>
                                  {user.cubicMeters.toFixed(6)}
                                </div>
                              </div>
                              <div>
                                <div style={{ color: "#666", marginBottom: "0.2rem" }}>Amount Due</div>
                                <div style={{ fontSize: "1.1rem", fontWeight: 600, color: "#333" }}>
                                  ₱{user.monthlyBill.toFixed(2)}
                                </div>
                              </div>
                              <div>
                                <div style={{ color: "#666", marginBottom: "0.2rem" }}>Due Date</div>
                                <div style={{ fontSize: "0.85rem", color: "#999" }}>
                                  {user.cubicMeters === 0 ? 'Not yet active' : new Date(new Date().setDate(new Date().getDate() + 11)).toISOString().split("T")[0]}
                                </div>
                              </div>
                              <div>
                                <div style={{ color: "#666", marginBottom: "0.2rem" }}>Status</div>
                                <div style={{ fontSize: "0.85rem", fontWeight: 600, color: user.cubicMeters === 0 ? "#999" : "#dc3545" }}>
                                  {user.cubicMeters === 0 ? 'No data' : 'Unpaid'}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    // Desktop table view
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ background: "#f5f7fa", borderBottom: "2px solid #e0e0e0" }}>
                            <th style={{ padding: "1rem", textAlign: "left", color: "#333", fontWeight: 600, fontSize: "0.95rem" }}>
                              Household
                            </th>
                            <th style={{ padding: "1rem", textAlign: "center", color: "#333", fontWeight: 600, fontSize: "0.95rem" }}>
                              Usage (m³)
                            </th>
                            <th style={{ padding: "1rem", textAlign: "center", color: "#333", fontWeight: 600, fontSize: "0.95rem" }}>
                              Amount Due (₱)
                            </th>
                            <th style={{ padding: "1rem", textAlign: "center", color: "#333", fontWeight: 600, fontSize: "0.95rem" }}>
                              Due Date
                            </th>
                            <th style={{ padding: "1rem", textAlign: "center", color: "#333", fontWeight: 600, fontSize: "0.95rem" }}>
                              Status
                            </th>
                            <th style={{ padding: "1rem", textAlign: "center", color: "#333", fontWeight: 600, fontSize: "0.95rem" }}>
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((user) => (
                            <tr key={user.id} style={{ borderBottom: "1px solid #e0e0e0", transition: "background 0.2s" }}
                              onMouseEnter={(e) => e.currentTarget.style.background = "#f9f9f9"}
                              onMouseLeave={(e) => e.currentTarget.style.background = "#fff"}
                            >
                              <td style={{ padding: "1rem", color: "#333", fontSize: "0.95rem" }}>
                                {user.username}
                              </td>
                              <td style={{ padding: "1rem", textAlign: "center", color: "#666", fontSize: "0.95rem" }}>
                                {user.cubicMeters.toFixed(6)}
                              </td>
                              <td style={{ padding: "1rem", textAlign: "center", fontWeight: 600, color: "#333" }}>
                                ₱{user.monthlyBill.toFixed(2)}
                              </td>
                              <td style={{ padding: "1rem", textAlign: "center", color: "#666", fontSize: "0.95rem" }}>
                                {user.cubicMeters === 0 ? 'Not yet active' : new Date(new Date().setDate(new Date().getDate() + 11)).toISOString().split("T")[0]}
                              </td>
                              <td style={{ padding: "1rem", textAlign: "center" }}>
                                <span style={{ color: user.cubicMeters === 0 ? "#999" : "#dc3545", fontWeight: 600, fontSize: "0.9rem" }}>
                                  {user.cubicMeters === 0 ? 'No data' : 'Unpaid'}
                                </span>
                              </td>
                              <td style={{ padding: "1rem", textAlign: "center" }}>
                                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
                                  <button
                                    onClick={() => resetDeviceReadings(user.devices[0]?.deviceId || user.username)}
                                    style={{
                                      padding: "0.5rem 1rem",
                                      background: "#ffc107",
                                      color: "#333",
                                      border: "none",
                                      borderRadius: "6px",
                                      cursor: "pointer",
                                      fontSize: "0.85rem",
                                      fontWeight: 600,
                                      transition: "background 0.2s",
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = "#ffb300"}
                                    onMouseLeave={(e) => e.currentTarget.style.background = "#ffc107"}
                                  >
                                    Reset
                                  </button>
                                  <button
                                    onClick={() => deleteUser(user.id, user.username)}
                                    style={{
                                      padding: "0.5rem 1rem",
                                      background: "#dc3545",
                                      color: "#fff",
                                      border: "none",
                                      borderRadius: "6px",
                                      cursor: "pointer",
                                      fontSize: "0.85rem",
                                      fontWeight: 600,
                                      transition: "background 0.2s",
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = "#c82333"}
                                    onMouseLeave={(e) => e.currentTarget.style.background = "#dc3545"}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {users.length === 0 && (
                  <div style={{ padding: "2rem", textAlign: "center", color: "#999" }}>
                    No users registered yet
                  </div>
                )}
              </section>
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
      )}

      {/* Password Change Modal */}
      {showPasswordChange && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
            padding: "1rem",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: isMobile ? "1.5rem" : "2rem",
              borderRadius: "12px",
              boxShadow: "0 10px 40px rgba(0, 0, 0, 0.2)",
              maxWidth: "400px",
              width: "100%",
            }}
          >
            <h2 style={{ color: "#333", marginBottom: "1.5rem", fontSize: isMobile ? "1.1rem" : "1.3rem", fontWeight: 600 }}>
              Change Admin Password
            </h2>

            {passwordError && (
              <div style={{ background: "#f8d7da", color: "#721c24", padding: "0.75rem 1rem", borderRadius: "6px", marginBottom: "1rem", fontSize: "0.9rem" }}>
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div style={{ background: "#d4edda", color: "#155724", padding: "0.75rem 1rem", borderRadius: "6px", marginBottom: "1rem", fontSize: "0.9rem" }}>
                {passwordSuccess}
              </div>
            )}

            <input
              type="password"
              placeholder="Current Password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                border: "1px solid #ddd",
                borderRadius: "6px",
                marginBottom: "1rem",
                fontSize: "0.95rem",
                boxSizing: "border-box",
              }}
            />

            <input
              type="password"
              placeholder="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                border: "1px solid #ddd",
                borderRadius: "6px",
                marginBottom: "1rem",
                fontSize: "0.95rem",
                boxSizing: "border-box",
              }}
            />

            <input
              type="password"
              placeholder="Confirm New Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                border: "1px solid #ddd",
                borderRadius: "6px",
                marginBottom: "1.5rem",
                fontSize: "0.95rem",
                boxSizing: "border-box",
              }}
            />

            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: isMobile ? "0.75rem" : "1rem",
            }}>
              <button
                onClick={() => {
                  setShowPasswordChange(false);
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                  setPasswordError("");
                  setPasswordSuccess("");
                }}
                style={{
                  padding: "0.7rem 1.5rem",
                  background: "#f5f5f5",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: isMobile ? "0.9rem" : "0.95rem",
                  fontWeight: 600,
                  color: "#333",
                  transition: "background 0.2s",
                  minHeight: "44px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#e8e8e8"}
                onMouseLeave={(e) => e.currentTarget.style.background = "#f5f5f5"}
              >
                Cancel
              </button>
              <button
                onClick={handleChangePassword}
                disabled={passwordLoading}
                style={{
                  padding: "0.7rem 1.5rem",
                  background: passwordLoading ? "#cccccc" : "#0057b8",
                  border: "none",
                  borderRadius: "6px",
                  cursor: passwordLoading ? "not-allowed" : "pointer",
                  fontSize: isMobile ? "0.9rem" : "0.95rem",
                  fontWeight: 600,
                  color: "#fff",
                  transition: "background 0.2s",
                  minHeight: "44px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onMouseEnter={(e) => !passwordLoading && (e.currentTarget.style.background = "#004499")}
                onMouseLeave={(e) => !passwordLoading && (e.currentTarget.style.background = "#0057b8")}
              >
                {passwordLoading ? "Changing..." : "Change Password"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
            padding: "1rem",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: isMobile ? "1.5rem" : "2rem",
              borderRadius: "12px",
              textAlign: "center",
              boxShadow: "0 10px 40px rgba(0, 0, 0, 0.2)",
              maxWidth: "400px",
              width: "100%",
            }}
          >
            <h2 style={{ color: "#333", marginBottom: "1rem", fontSize: isMobile ? "1.2rem" : "1.3rem", fontWeight: 600 }}>
              Confirm Logout
            </h2>
            <p style={{ color: "#666", marginBottom: "2rem", fontSize: isMobile ? "0.9rem" : "1rem" }}>
              Are you sure you want to log out?
            </p>
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: isMobile ? "0.75rem" : "1rem",
              justifyContent: "center",
            }}>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                style={{
                  padding: "0.7rem 2rem",
                  background: "#f5f5f5",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: isMobile ? "0.9rem" : "0.95rem",
                  fontWeight: 600,
                  color: "#333",
                  transition: "background 0.2s",
                  minHeight: "44px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#e8e8e8"}
                onMouseLeave={(e) => e.currentTarget.style.background = "#f5f5f5"}
              >
                No, Stay
              </button>
              <button
                onClick={confirmLogout}
                style={{
                  padding: "0.7rem 2rem",
                  background: "#dc3545",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: isMobile ? "0.9rem" : "0.95rem",
                  fontWeight: 600,
                  color: "#fff",
                  transition: "background 0.2s",
                  minHeight: "44px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#c82333"}
                onMouseLeave={(e) => e.currentTarget.style.background = "#dc3545"}
              >
                Yes, Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminDashboard;
