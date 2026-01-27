import React, { useEffect, useState } from "react";
import AdminLogin from "./AdminLogin";

interface UserData {
  id: string;
  username: string;
  createdAt?: string;
  cubicMeters: number;
  currentConsumption?: number;
  previousConsumption?: number;
  totalConsumption?: number;
  totalLiters: number;
  deviceCount: number;
  lastReading: string | null;
  devices: Array<{ deviceId: string; status: string; lastSeen: string | null }>;
  monthlyBill?: number;
}

const API_URL = "https://patak-portal-production.up.railway.app";

// Tiered water billing calculation
function calculateWaterBill(cubicMeters: number): number {
  const MINIMUM_CHARGE = 255.00;
  const FREE_USAGE = 10; // cubic meters included in minimum
  
  // No bill if no consumption
  if (cubicMeters <= 0) {
    return 0;
  }
  
  if (cubicMeters <= FREE_USAGE) {
    return MINIMUM_CHARGE;
  }
  
  const excess = cubicMeters - FREE_USAGE;
  
  // Apply tiered rates for usage above 10 m³
  const tier1 = Math.min(excess, 10);           // 11-20 m³: 33.00 per m³
  const tier2 = Math.min(Math.max(excess - 10, 0), 10);  // 21-30 m³: 40.50 per m³
  const tier3 = Math.min(Math.max(excess - 20, 0), 10);  // 31-40 m³: 48.00 per m³
  const tier4 = Math.max(excess - 30, 0);      // 41+ m³: 55.50 per m³
  
  const excessCharge = (tier1 * 33.00) + (tier2 * 40.50) + (tier3 * 48.00) + (tier4 * 55.50);
  
  return Math.round((MINIMUM_CHARGE + excessCharge) * 100) / 100;
}

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
  const [userPayments, setUserPayments] = useState<any[]>([]);
  const [readingsLoading, setReadingsLoading] = useState(false);
  const [userConsumption, setUserConsumption] = useState<Record<string, { present: number; previous: number }>>({});
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [searchUsername, setSearchUsername] = useState("");

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
      // Calculate bill using tiered rates
      const usersWithCorrectBill = (data.users || []).map((user: any) => ({
        ...user,
        monthlyBill: calculateWaterBill(user.cubicMeters || 0)
      }));
      setUsers(usersWithCorrectBill);
      
      // Fetch consumption data for all users
      const consumptionMap: Record<string, { present: number; previous: number }> = {};
      for (const user of usersWithCorrectBill) {
        try {
          const readingsRes = await fetch(`${API_URL}/api/admin/users/${user.id}/readings`, {
            headers: { Authorization: "Bearer " + token },
          });
          if (readingsRes.ok) {
            const readingsData = await readingsRes.json();
            const readings = readingsData.readings || [];
            consumptionMap[user.id] = {
              present: getPresentConsumption(readings),
              previous: getPreviousConsumption(readings),
            };
          }
        } catch (err) {
          console.error(`Failed to fetch readings for user ${user.id}:`, err);
          consumptionMap[user.id] = { present: 0, previous: 0 };
        }
      }
      setUserConsumption(consumptionMap);
    } catch (err) {
      console.error("Dashboard error:", err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  // Load user readings
  const loadUserReadings = async (userId: string, username: string) => {
    setReadingsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${userId}/readings`, {
        headers: { Authorization: "Bearer " + token },
      });
      if (!res.ok) throw new Error("Failed to load readings");
      const data = await res.json();
      setUserReadings(data.readings || []);
      
      // Load payments for this user
      try {
        const paymentsRes = await fetch(`${API_URL}/api/payments/${encodeURIComponent(username)}`, {
          headers: { Authorization: "Bearer " + token },
        });
        if (paymentsRes.ok) {
          const paymentsData = await paymentsRes.json();
          setUserPayments(paymentsData.payments || []);
        }
      } catch (paymentErr) {
        console.error("Payments error:", paymentErr);
        setUserPayments([]);
      }
    } catch (err) {
      console.error("Readings error:", err);
      setUserReadings([]);
    } finally {
      setReadingsLoading(false);
    }
  };

  // Calculate consumption for current month (from start of month to now)
  const getPresentConsumption = (readings: any[]) => {
    if (!readings || readings.length === 0) return 0;
    
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const monthReadings = readings.filter((r: any) => {
      const readingDate = new Date(r.timestamp);
      return readingDate >= startOfMonth;
    }).sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    if (monthReadings.length === 0) return 0;
    
    // If only one reading in month, it's the consumption from month start
    if (monthReadings.length === 1) {
      return monthReadings[0].cubicMeters;
    }
    
    // Get the first reading of this month
    const firstReading = monthReadings[0];
    const lastReading = monthReadings[monthReadings.length - 1];
    
    // Return the difference from first to last reading in the month
    return Math.max(0, lastReading.cubicMeters - firstReading.cubicMeters);
  };

  // Calculate consumption for previous month
  const getPreviousConsumption = (readings: any[]) => {
    if (!readings || readings.length === 0) return 0;
    
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    
    const prevMonthReadings = readings.filter((r: any) => {
      const readingDate = new Date(r.timestamp);
      return readingDate >= startOfPrevMonth && readingDate < startOfMonth;
    }).sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    if (prevMonthReadings.length === 0) return 0;
    
    const firstReading = prevMonthReadings[0];
    const lastReading = prevMonthReadings[prevMonthReadings.length - 1];
    
    return Math.max(0, lastReading.cubicMeters - firstReading.cubicMeters);
  };

  // Generate billing history for a user - shows 12 calendar months (current year and next)
  // Dynamically generates months based on current date
  const generateBillingHistory = (readings: any[], createdAt: string) => {
    const history = [];
    const now = new Date();

    // Get the latest meter reading (cumulative total)
    const allReadings = readings || [];
    let latestMeterReading = 0;
    if (allReadings.length > 0) {
      const sorted = allReadings.sort((a: any, b: any) => {
        const dateA = a.receivedAt ? new Date(a.receivedAt) : new Date(a.timestamp);
        const dateB = b.receivedAt ? new Date(b.receivedAt) : new Date(b.timestamp);
        return dateB.getTime() - dateA.getTime();
      });
      latestMeterReading = sorted[0].cubicMeters || 0;
    }

    // Generate 12 calendar months starting from current month
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    for (let month = 0; month < 12; month++) {
      // Calculate year and month for each billing period
      const monthIndex = (currentMonth + month) % 12;
      const yearOffset = Math.floor((currentMonth + month) / 12);
      const year = currentYear + yearOffset;
      
      const periodStartDate = new Date(year, monthIndex, 1);
      const periodEndDate = new Date(year, monthIndex + 1, 1);

      // Get readings for this month
      const periodReadings = (readings || [])
        .filter((r: any) => {
          const readingDate = r.receivedAt ? new Date(r.receivedAt) : new Date(r.timestamp);
          return readingDate >= periodStartDate && readingDate < periodEndDate;
        })
        .sort((a: any, b: any) => {
          const dateA = a.receivedAt ? new Date(a.receivedAt) : new Date(a.timestamp);
          const dateB = b.receivedAt ? new Date(b.receivedAt) : new Date(b.timestamp);
          return dateA.getTime() - dateB.getTime();
        });

      let consumption = 0;
      
      // Determine bill status first
      let billStatus = 'Pending';
      if (now > periodEndDate) {
        billStatus = 'Overdue';
      } else if (now >= periodStartDate && now < periodEndDate) {
        billStatus = 'Current';
      } else if (now < periodStartDate) {
        billStatus = 'Upcoming';
      }

      // For current month, show latest meter reading. For past months, show difference between readings in that month
      if (billStatus === 'Current') {
        consumption = latestMeterReading;
      } else if (periodReadings.length > 0) {
        const firstReading = periodReadings[0];
        const lastReading = periodReadings[periodReadings.length - 1];
        consumption = Math.max(0, lastReading.cubicMeters - firstReading.cubicMeters);
      }

      const monthStr = periodStartDate.toLocaleString('default', { month: 'long', year: 'numeric' });
      const amountDue = calculateWaterBill(consumption);

      // Total consumption only for past/current months, 0 for upcoming
      const totalConsumption = (billStatus === 'Upcoming') ? '0.000000' : latestMeterReading.toFixed(6);

      history.push({
        month: monthStr,
        monthDate: periodStartDate,
        consumption: consumption.toFixed(6),
        totalConsumption: totalConsumption,
        amountDue: amountDue.toFixed(2),
        billStatus,
        dueDate: periodEndDate.toISOString().split('T')[0],
      });
    }

    return history;
  };

  // Delete user account
  const deleteUser = async (userId: string, username: string) => {
    if (!window.confirm(`Are you sure you want to delete user "${username}" and all their data? This cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/admin/users/${encodeURIComponent(username)}`, {
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
    const interval = setInterval(loadDashboard, 1000); // Refresh every 1 second
    
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
                    Total Consumption (m³)
                  </div>
                  <div style={{ fontSize: isMobile ? "2rem" : "2.5rem", fontWeight: 700, color: "#0057b8" }}>
                    {users.reduce((sum, u) => sum + u.cubicMeters, 0).toFixed(6)} m³
                  </div>
                  <div style={{ fontSize: isMobile ? "0.75rem" : "0.85rem", color: "#666", marginTop: "0.5rem" }}>
                    Across all houses
                  </div>
                </div>

  
              </section>

              {/* Separator */}
              <div style={{ height: "1px", background: "#ddd", margin: "2rem 0" }} />

              {/* User's Accounts Section */}
              <section>
                <div style={{ marginBottom: "1.5rem" }}>
                  <h2 style={{ color: "#0057b8", fontSize: isMobile ? "1.2rem" : "1.5rem", margin: 0, marginBottom: "1rem", fontWeight: 600 }}>
                    User's Accounts
                  </h2>
                  
                  {/* Search Input */}
                  <input
                    id="searchUsername"
                    name="searchUsername"
                    type="text"
                    placeholder="🔍 Search by username..."
                    value={searchUsername}
                    onChange={(e) => setSearchUsername(e.target.value)}
                    style={{
                      width: isMobile ? "100%" : "300px",
                      padding: "0.75rem 1rem",
                      fontSize: "0.95rem",
                      border: "1px solid #ddd",
                      borderRadius: "6px",
                      boxSizing: "border-box",
                      fontFamily: "Poppins, Arial, sans-serif",
                    }}
                  />
                </div>

                {/* Calculate filtered users */}
                {(() => {
                  const filteredUsers = users.filter(user =>
                    user.username.toLowerCase().includes(searchUsername.toLowerCase())
                  );

                  return (
                    <>
                      <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 2px 8px #0000000f", overflow: "hidden", overflowX: "auto" }}>
                        {/* Mobile card view / Desktop table view */}
                        {isMobile ? (
                          // Mobile card view
                          <div style={{ padding: "1rem" }}>
                      {filteredUsers.length === 0 ? (
                        <div style={{ padding: "1.5rem", textAlign: "center", color: "#999", fontSize: "0.9rem" }}>
                          {searchUsername ? `No users found matching "${searchUsername}"` : "No users registered yet"}
                        </div>
                      ) : (
                        filteredUsers.map((user) => {
                          // Calculate bill status
                          const getBillStatus = () => {
                            if (user.cubicMeters === 0 || !user.lastReadingTimestamp) {
                              return { text: 'Not yet active', color: '#999' };
                            }
                            
                            const firstReadingDate = new Date(user.lastReadingTimestamp);
                            const dueDate = new Date(firstReadingDate);
                            dueDate.setMonth(dueDate.getMonth() + 1);
                            
                            const now = new Date();
                            if (now > dueDate) {
                              return { text: '🔴 Overdue', color: '#ff6b6b' };
                            } else {
                              return { text: '⏳ Pending', color: '#ff9800' };
                            }
                          };
                          
                          const billStatus = getBillStatus();
                          
                          return (
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
                                <div style={{ color: "#666", marginBottom: "0.2rem" }}>Bill Status</div>
                                <div style={{ fontSize: "0.85rem", fontWeight: 600, color: billStatus.color }}>
                                  {billStatus.text}
                                </div>
                              </div>
                              <div>
                                <div style={{ color: "#666", marginBottom: "0.2rem" }}>Device Status</div>
                                <div style={{ fontSize: "0.85rem", fontWeight: 600, color: user.isOnline ? "#4caf50" : "#ff6b6b" }}>
                                  {user.isOnline ? '🟢 Online' : '🔴 Offline'}
                                </div>
                              </div>
                            </div>
                          </div>
                          );
                        })
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
                              Current Consumption (m³)
                            </th>
                            <th style={{ padding: "1rem", textAlign: "center", color: "#333", fontWeight: 600, fontSize: "0.95rem" }}>
                              Previous Consumption (m³)
                            </th>
                            <th style={{ padding: "1rem", textAlign: "center", color: "#333", fontWeight: 600, fontSize: "0.95rem" }}>
                              Total Consumption (m³)
                            </th>
                            <th style={{ padding: "1rem", textAlign: "center", color: "#333", fontWeight: 600, fontSize: "0.95rem" }}>
                              Amount Due (₱)
                            </th>
                            <th style={{ padding: "1rem", textAlign: "center", color: "#333", fontWeight: 600, fontSize: "0.95rem" }}>
                              Due Date
                            </th>
                            <th style={{ padding: "1rem", textAlign: "center", color: "#333", fontWeight: 600, fontSize: "0.95rem" }}>
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredUsers.map((user) => {
                            // Calculate bill status
                            const getBillStatus = () => {
                              if (user.cubicMeters === 0 || !user.lastReadingTimestamp) {
                                return { text: 'Not yet active', color: '#999' };
                              }
                              
                              const firstReadingDate = new Date(user.lastReadingTimestamp);
                              const dueDate = new Date(firstReadingDate);
                              dueDate.setMonth(dueDate.getMonth() + 1);
                              
                              const now = new Date();
                              if (now > dueDate) {
                                return { text: '🔴 Overdue', color: '#ff6b6b' };
                              } else {
                                return { text: '⏳ Pending', color: '#ff9800' };
                              }
                            };
                            
                            const billStatus = getBillStatus();
                            
                            return (
                            <tr key={user.id} style={{ borderBottom: "1px solid #e0e0e0", transition: "background 0.2s" }}
                              onMouseEnter={(e) => e.currentTarget.style.background = "#f9f9f9"}
                              onMouseLeave={(e) => e.currentTarget.style.background = "#fff"}
                            >
                              <td style={{ padding: "1rem", color: "#333", fontSize: "0.95rem" }}>
                                {user.username}
                              </td>
                              <td style={{ padding: "1rem", textAlign: "center", fontWeight: 600, color: "#0057b8", fontSize: "0.95rem" }}>
                                {(user.currentConsumption || 0).toFixed(6)}
                              </td>
                              <td style={{ padding: "1rem", textAlign: "center", fontWeight: 600, color: "#0057b8", fontSize: "0.95rem" }}>
                                {(user.previousConsumption || 0).toFixed(6)}
                              </td>
                              <td style={{ padding: "1rem", textAlign: "center", fontWeight: 600, color: "#0057b8" }}>
                                {(user.totalConsumption || 0).toFixed(6)}
                              </td>
                              <td style={{ padding: "1rem", textAlign: "center", fontWeight: 600, color: "#333" }}>
                                ₱{user.monthlyBill.toFixed(2)}
                              </td>
                              <td style={{ padding: "1rem", textAlign: "center", color: "#666", fontSize: "0.95rem" }}>
                                {user.cubicMeters === 0 ? 'Not yet active' : new Date(new Date().setDate(new Date().getDate() + 11)).toISOString().split("T")[0]}
                              </td>
                              <td style={{ padding: "1rem", textAlign: "center" }}>
                                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
                                  <button
                                    onClick={async () => {
                                      setSelectedUserId(user.id);
                                      await loadUserReadings(user.id, user.username);
                                    }}
                                    style={{
                                      padding: "0.5rem 1rem",
                                      background: "#0057b8",
                                      color: "#fff",
                                      border: "none",
                                      borderRadius: "6px",
                                      cursor: "pointer",
                                      fontSize: "0.85rem",
                                      fontWeight: 600,
                                      transition: "background 0.2s",
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = "#004399"}
                                    onMouseLeave={(e) => e.currentTarget.style.background = "#0057b8"}
                                  >
                                    View
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (!window.confirm(`Reset meter for "${user.username}"?`)) return;
                                      try {
                                        const res = await fetch(`${API_URL}/api/admin/users/${encodeURIComponent(user.username)}/reset-meter`, {
                                          method: "POST",
                                          headers: { Authorization: "Bearer " + token },
                                        });
                                        if (!res.ok) throw new Error("Failed");
                                        alert(`Meter reset for ${user.username}`);
                                        await loadDashboard();
                                      } catch (err) {
                                        alert("Failed to reset meter");
                                      }
                                    }}
                                    style={{
                                      padding: "0.5rem 1rem",
                                      background: "#ff9800",
                                      color: "#fff",
                                      border: "none",
                                      borderRadius: "6px",
                                      cursor: "pointer",
                                      fontSize: "0.85rem",
                                      fontWeight: 600,
                                      transition: "background 0.2s",
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = "#e68900"}
                                    onMouseLeave={(e) => e.currentTarget.style.background = "#ff9800"}
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
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                      {filteredUsers.length === 0 && searchUsername && (
                        <div style={{ padding: "2rem", textAlign: "center", color: "#999" }}>
                          No users found matching "{searchUsername}"
                        </div>
                      )}

                      {users.length === 0 && (
                        <div style={{ padding: "2rem", textAlign: "center", color: "#999" }}>
                          No users registered yet
                        </div>
                      )}
                      </div>
                    </>
                  );
                })()}
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
              &copy; {new Date().getFullYear()} PATAK. Guard every drop.
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
              id="currentPassword"
              name="currentPassword"
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
              id="newPassword"
              name="newPassword"
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
              id="confirmPassword"
              name="confirmPassword"
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

      {/* User Details Modal */}
      {selectedUserId && (
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
            zIndex: 9998,
            padding: "1rem",
            boxSizing: "border-box",
            overflowY: "auto",
          }}
          onClick={() => setSelectedUserId(null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "12px",
              boxShadow: "0 10px 40px rgba(0, 0, 0, 0.2)",
              maxWidth: "900px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: isMobile ? "1.5rem" : "2rem",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {readingsLoading ? (
              <div style={{ textAlign: "center", padding: "2rem" }}>Loading user details...</div>
            ) : users.find(u => u.id === selectedUserId) ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
                  <h2 style={{ color: "#0057b8", margin: 0, fontSize: isMobile ? "1.3rem" : "1.5rem" }}>
                    {users.find(u => u.id === selectedUserId)?.username}
                  </h2>
                  <button
                    onClick={() => setSelectedUserId(null)}
                    style={{
                      padding: "0.5rem 1rem",
                      background: "#f5f5f5",
                      border: "1px solid #ddd",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Close
                  </button>
                </div>

                {/* User Info */}
                <div style={{ background: "#f9f9f9", padding: "1.5rem", borderRadius: "8px", marginBottom: "2rem" }}>
                  <h3 style={{ color: "#333", marginTop: 0, marginBottom: "1rem" }}>User Information</h3>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: "1rem", fontSize: "0.95rem" }}>
                    <div>
                      <span style={{ color: "#666", fontWeight: 600 }}>Registered:</span>
                      <div style={{ color: "#333", marginTop: "0.25rem" }}>
                        {users.find(u => u.id === selectedUserId)?.createdAt ? new Date(users.find(u => u.id === selectedUserId)!.createdAt!).toLocaleDateString() : "—"}
                      </div>
                    </div>
                    <div>
                      <span style={{ color: "#666", fontWeight: 600 }}>Devices:</span>
                      <div style={{ color: "#333", marginTop: "0.25rem" }}>
                        {users.find(u => u.id === selectedUserId)?.deviceCount || 0}
                      </div>
                    </div>
                    <div>
                      <span style={{ color: "#666", fontWeight: 600 }}>Total Usage:</span>
                      <div style={{ color: "#333", marginTop: "0.25rem" }}>
                        {users.find(u => u.id === selectedUserId)?.cubicMeters.toFixed(6) || "0.000000"} m³
                      </div>
                    </div>
                    <div>
                      <span style={{ color: "#666", fontWeight: 600 }}>Last Reading:</span>
                      <div style={{ color: "#333", marginTop: "0.25rem" }}>
                        {users.find(u => u.id === selectedUserId)?.lastReading
                          ? `${(users.find(u => u.id === selectedUserId)?.lastReading?.cubicMeters || 0).toFixed(2)} m³ (${new Date(users.find(u => u.id === selectedUserId)!.lastReading!.timestamp || new Date()).toLocaleString()})`
                          : "No data"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Billing History */}
                <div>
                  <h3 style={{ color: "#333", marginBottom: "1rem" }}>Billing History (Current Month + Upcoming)</h3>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: isMobile ? "0.8rem" : "0.9rem" }}>
                      <thead>
                        <tr style={{ background: "#f5f7fa", borderBottom: "2px solid #e0e0e0" }}>
                          <th style={{ padding: "0.75rem", textAlign: "left", color: "#333", fontWeight: 600 }}>Month</th>
                          <th style={{ padding: "0.75rem", textAlign: "center", color: "#333", fontWeight: 600 }}>Consumption (m³)</th>
                          <th style={{ padding: "0.75rem", textAlign: "center", color: "#333", fontWeight: 600 }}>Total Consumption (m³)</th>
                          <th style={{ padding: "0.75rem", textAlign: "center", color: "#333", fontWeight: 600 }}>Amount Due (₱)</th>
                          <th style={{ padding: "0.75rem", textAlign: "center", color: "#333", fontWeight: 600 }}>Due Date</th>
                          <th style={{ padding: "0.75rem", textAlign: "center", color: "#333", fontWeight: 600 }}>Status</th>
                          <th style={{ padding: "0.75rem", textAlign: "center", color: "#333", fontWeight: 600 }}>Payment Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {generateBillingHistory(userReadings, users.find(u => u.id === selectedUserId)?.createdAt || new Date().toISOString()).map((bill, idx, arr) => {
                          const now = new Date();
                          const isCurrentPeriod = bill.billStatus === 'Current' || bill.billStatus === 'Pending';
                          return (
                          <tr key={idx} style={{ borderBottom: "1px solid #e0e0e0", background: isCurrentPeriod ? "#f0f8ff" : "transparent" }}>
                            <td style={{ padding: "0.75rem", color: "#333", fontWeight: isCurrentPeriod ? 600 : 400 }}>{bill.month}</td>
                            <td style={{ padding: "0.75rem", textAlign: "center", fontWeight: 600, color: "#0057b8" }}>{bill.consumption}</td>
                            <td style={{ padding: "0.75rem", textAlign: "center", fontWeight: 600, color: "#0057b8" }}>{bill.totalConsumption}</td>
                            <td style={{ padding: "0.75rem", textAlign: "center", fontWeight: 600, color: "#333" }}>₱{bill.amountDue}</td>
                            <td style={{ padding: "0.75rem", textAlign: "center", color: "#666" }}>{bill.dueDate}</td>
                            <td style={{ padding: "0.75rem", textAlign: "center" }}>
                              <span style={{
                                fontWeight: 600,
                                color: bill.billStatus === 'Overdue' ? '#ff6b6b' : bill.billStatus === 'Current' ? '#4CAF50' : bill.billStatus === 'Pending' ? '#ff9800' : '#2196F3',
                                fontSize: isMobile ? "0.75rem" : "0.85rem"
                              }}>
                                {bill.billStatus === 'Overdue' ? '🔴 Overdue' : bill.billStatus === 'Current' ? '📊 Current' : bill.billStatus === 'Pending' ? '⏳ Pending' : bill.billStatus === 'Upcoming' ? '📅 Upcoming' : '—'}
                              </span>
                            </td>
                            <td style={{ padding: "0.75rem", textAlign: "center" }}>
                              {(() => {
                                const billDate = new Date(bill.dueDate);
                                const payment = userPayments.find(p => 
                                  p.billingMonth === (billDate.getMonth() + 1) && 
                                  p.billingYear === billDate.getFullYear()
                                );
                                
                                if (payment) {
                                  const paymentDate = payment.verifiedAt || payment.submittedAt || payment.paidAt;
                                  const formattedDate = paymentDate ? new Date(paymentDate).toLocaleDateString() : 'Unknown';
                                  
                                  return (
                                    <div style={{ fontSize: isMobile ? "0.75rem" : "0.85rem" }}>
                                      <div style={{ color: '#4caf50', fontWeight: 600 }}>✅ Paid ₱{parseFloat(payment.amount).toFixed(2)}</div>
                                      <div style={{ color: '#aaa', fontSize: '0.7rem', marginTop: '2px' }}>
                                        {formattedDate}
                                      </div>
                                    </div>
                                  );
                                }
                                
                                return <span style={{ color: '#aaa' }}>—</span>;
                              })()}
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : null}
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
