import React, { useEffect, useState } from "react";
import AdminUsers from "./AdminUsers";

interface UserData {
  id: string;
  username: string;
  cubicMeters: number;
  totalLiters: number;
  deviceCount: number;
  lastReading: string | null;
  devices: Array<{ deviceId: string; status: string; lastSeen: string | null }>;
}

const AdminDashboard: React.FC = () => {
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem("adminToken") || "";
    } catch {
      return "";
    }
  });

  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userReadings, setUserReadings] = useState<any[]>([]);
  const [readingsLoading, setReadingsLoading] = useState(false);

  // Load dashboard data
  const loadDashboard = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/dashboard", {
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
      const res = await fetch(`/api/admin/users/${userId}/readings`, {
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

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [token]);

  return (
    <div style={{ display: "flex", gap: "2rem", width: "100%", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Left: User Management */}
      <div style={{ flex: 1, minWidth: "300px" }}>
        <AdminUsers />
      </div>

      {/* Right: Monitoring Dashboard */}
      <div style={{ flex: 1.5, minWidth: "400px" }}>
        <div style={{ background: "#fff", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 2px 8px #0000000f" }}>
          <h2 style={{ color: "#0057b8", margin: "0 0 1rem 0" }}>Water Usage Monitoring</h2>

          {!token && (
            <div style={{ padding: "1rem", background: "#fee", color: "#c33", borderRadius: "6px" }}>
              Please set admin token in User Management section
            </div>
          )}

          {loading && <div>Loading users...</div>}

          {!loading && users.length === 0 && (
            <div style={{ padding: "1rem", color: "#666" }}>No users registered yet</div>
          )}

          {users.length > 0 && (
            <>
              {/* Summary Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
                <div style={{ background: "#e2f3ff", padding: "1rem", borderRadius: "8px" }}>
                  <div style={{ fontSize: "0.9rem", color: "#666" }}>Total Users</div>
                  <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#0057b8" }}>{users.length}</div>
                </div>
                <div style={{ background: "#e2f3ff", padding: "1rem", borderRadius: "8px" }}>
                  <div style={{ fontSize: "0.9rem", color: "#666" }}>Total Devices</div>
                  <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#0057b8" }}>
                    {users.reduce((sum, u) => sum + u.deviceCount, 0)}
                  </div>
                </div>
                <div style={{ background: "#e2f3ff", padding: "1rem", borderRadius: "8px" }}>
                  <div style={{ fontSize: "0.9rem", color: "#666" }}>Total Usage (m³)</div>
                  <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#0057b8" }}>
                    {users.reduce((sum, u) => sum + u.cubicMeters, 0).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* User List */}
              <h3 style={{ color: "#333", marginBottom: "1rem" }}>Users</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {users.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => {
                      setSelectedUserId(user.id);
                      loadUserReadings(user.id);
                    }}
                    style={{
                      padding: "1rem",
                      background: selectedUserId === user.id ? "#e2f3ff" : "#f9f9f9",
                      border: selectedUserId === user.id ? "2px solid #0057b8" : "1px solid #e0e0e0",
                      borderRadius: "8px",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <h4 style={{ margin: "0 0 0.25rem 0", color: "#0057b8" }}>{user.username}</h4>
                        <small style={{ color: "#666" }}>{user.deviceCount} device(s)</small>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#0057b8" }}>
                          {user.cubicMeters.toFixed(3)} m³
                        </div>
                        <small style={{ color: "#666" }}>
                          {user.lastReading
                            ? `Updated: ${new Date(user.lastReading).toLocaleTimeString()}`
                            : "No data"}
                        </small>
                      </div>
                    </div>

                    {/* Device status */}
                    {user.devices.length > 0 && (
                      <div style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>
                        {user.devices.map((d, idx) => (
                          <div key={idx} style={{ color: d.status === "online" ? "#0a7e3a" : "#999" }}>
                            {d.deviceId}: {d.status}
                            {d.lastSeen && ` - Seen: ${new Date(d.lastSeen).toLocaleTimeString()}`}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Readings Detail */}
              {selectedUserId && (
                <div style={{ marginTop: "2rem", borderTop: "1px solid #e0e0e0", paddingTop: "1.5rem" }}>
                  <h3 style={{ color: "#333" }}>
                    {users.find((u) => u.id === selectedUserId)?.username} - Reading History
                  </h3>

                  {readingsLoading && <div>Loading readings...</div>}

                  {!readingsLoading && userReadings.length === 0 && (
                    <div style={{ padding: "1rem", color: "#666" }}>No readings yet</div>
                  )}

                  {userReadings.length > 0 && (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                        <thead>
                          <tr style={{ background: "#f5f5f5" }}>
                            <th style={{ padding: "0.5rem", textAlign: "left", borderBottom: "1px solid #ddd" }}>
                              Device
                            </th>
                            <th style={{ padding: "0.5rem", textAlign: "right", borderBottom: "1px solid #ddd" }}>
                              m³
                            </th>
                            <th style={{ padding: "0.5rem", textAlign: "right", borderBottom: "1px solid #ddd" }}>
                              Liters
                            </th>
                            <th style={{ padding: "0.5rem", textAlign: "left", borderBottom: "1px solid #ddd" }}>
                              Received At
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {userReadings.slice(0, 20).map((r, idx) => (
                            <tr key={idx} style={{ borderBottom: "1px solid #e0e0e0" }}>
                              <td style={{ padding: "0.5rem" }}>{r.deviceId || "N/A"}</td>
                              <td style={{ padding: "0.5rem", textAlign: "right" }}>
                                {(r.data?.cubicMeters || r.cubicMeters || 0).toFixed(3)}
                              </td>
                              <td style={{ padding: "0.5rem", textAlign: "right" }}>
                                {(r.data?.totalLiters || r.totalLiters || 0).toFixed(0)}
                              </td>
                              <td style={{ padding: "0.5rem" }}>
                                {new Date(r.receivedAt).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {userReadings.length > 20 && (
                        <div style={{ marginTop: "0.5rem", color: "#666", fontSize: "0.85rem" }}>
                          Showing latest 20 readings (total: {userReadings.length})
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
