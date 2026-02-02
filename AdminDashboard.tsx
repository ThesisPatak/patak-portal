import React, { useEffect, useState } from "react";
import AdminLogin from "./AdminLogin";
import { computeResidentialBill } from "./billingUtils";

const API_URL = "https://patak-portal-production.up.railway.app";

interface UserData {
  id: string;
  username: string;
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
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
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
  
  // Destructive action confirmation (Delete/Reset with password)
  const [showDestructiveConfirm, setShowDestructiveConfirm] = useState(false);
  const [destructiveAction, setDestructiveAction] = useState<{ type: 'delete' | 'reset'; userId: string; username: string } | null>(null);
  const [destructivePassword, setDestructivePassword] = useState("");
  const [destructiveError, setDestructiveError] = useState("");
  const [destructiveLoading, setDestructiveLoading] = useState(false);

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
    if (!token) {
      console.warn('[ADMIN-DASHBOARD] No token found');
      return;
    }
    setLoading(true);
    console.log('[ADMIN-DASHBOARD] Loading dashboard with token:', token.substring(0, 20) + '...');
    try {
      const url = `${API_URL}/api/admin/dashboard`;
      console.log('[ADMIN-DASHBOARD] Calling:', url);
      const res = await fetch(url, {
        headers: { Authorization: "Bearer " + token },
      });
      console.log('[ADMIN-DASHBOARD] Response status:', res.status);
      if (!res.ok) {
        const errorText = await res.text();
        console.error('[ADMIN-DASHBOARD] Response error:', errorText);
        throw new Error(`Failed to load dashboard: ${res.status} ${errorText}`);
      }
      const data = await res.json();
      console.log('[ADMIN-DASHBOARD] Received users:', data.users?.length || 0);
      console.log('[ADMIN-DASHBOARD] Pending users:', data.pendingUsers?.length || 0);
      
      // Set pending users
      setPendingUsers(data.pendingUsers || []);
      
      // Calculate bill using tiered rates
      const usersWithCorrectBill = (data.users || []).map((user: any) => ({
        ...user,
        monthlyBill: computeResidentialBill(user.cubicMeters || 0)
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

    // Generate two 31-day billing cycles starting from account creation date
    const billingBaseDate = new Date(createdAt);
    let previousPeriodLastReading = 0; // Track meter reading at end of previous period

    for (let i = 0; i < 2; i++) {
      const periodStartDate = new Date(billingBaseDate);
      periodStartDate.setDate(periodStartDate.getDate() + (i * 31));
      const periodEndDate = new Date(periodStartDate);
      periodEndDate.setDate(periodEndDate.getDate() + 31);

      // Get readings for this period
      const periodReadings = (readings || []).filter((r: any) => {
        const readingDate = r.receivedAt ? new Date(r.receivedAt) : new Date(r.timestamp);
        return readingDate >= periodStartDate && readingDate < periodEndDate;
      }).sort((a: any, b: any) => {
        const dateA = a.receivedAt ? new Date(a.receivedAt) : new Date(a.timestamp);
        const dateB = b.receivedAt ? new Date(b.receivedAt) : new Date(b.timestamp);
        return dateA.getTime() - dateB.getTime();
      });

      let consumption = 0;

      // Status will be determined after payment check
      let billStatus = 'Pending';
      let statusColor = '#ff9800';
      let statusIcon = '⏳';

      // Calculate consumption as DIFFERENCE between period readings (not cumulative total)
      if (periodReadings.length > 0) {
        const firstReading = periodReadings[0].cubicMeters;
        const lastReading = periodReadings[periodReadings.length - 1].cubicMeters;
        consumption = Math.max(0, lastReading - firstReading);
        previousPeriodLastReading = lastReading; // Store for next cycle
      } else if (i > 0 && previousPeriodLastReading > 0) {
        // No readings in this period, but previous period had readings
        // Use the latest meter reading from all data to show current consumption
        consumption = Math.max(0, latestMeterReading - previousPeriodLastReading);
      }

      const monthStr = `${periodStartDate.toLocaleString('default',{month:'short', day:'numeric'})} – ${new Date(periodEndDate.getTime()-1).toLocaleString('default',{month:'short', day:'numeric', year:'numeric'})}`;
      const amountDue = computeResidentialBill(consumption);

      const totalConsumption = (billStatus === 'Upcoming') ? '0.000000' : latestMeterReading.toFixed(6);

      history.push({
        month: monthStr,
        monthDate: periodStartDate,
        consumption: consumption.toFixed(6),
        totalConsumption: totalConsumption,
        amountDue: amountDue.toFixed(2),
        billStatus,
        statusColor,
        statusIcon,
        dueDate: periodEndDate.toISOString().split('T')[0],
        billingMonth: periodStartDate.getMonth() + 1,
        billingYear: periodStartDate.getFullYear()
      });
    }

    // Only show current cycle, and next cycle only if current is paid
    const visibleCycles: any[] = [];
    if (history.length > 0) {
      // Determine billing month/year for the first (current) cycle
      const firstCycle = history[0];
      const billDate = firstCycle.monthDate instanceof Date ? firstCycle.monthDate : new Date(firstCycle.monthDate);
      const billingMonth = billDate.getMonth() + 1;
      const billingYear = billDate.getFullYear();

      const paymentForFirst = (userPayments || []).find(p =>
        p.billingMonth === billingMonth &&
        p.billingYear === billingYear &&
        (p.status === 'verified' || p.status === 'confirmed' || p.status === 'PAID')
      );

      if (paymentForFirst) {
        // First is paid - use locked consumption if available, otherwise keep calculated value
        if (paymentForFirst.lockedConsumption !== undefined && paymentForFirst.lockedConsumption !== null && paymentForFirst.lockedConsumption > 0) {
          history[0].consumption = paymentForFirst.lockedConsumption.toFixed(6);
        }
        // If no locked consumption, keep the calculated value from history
        
        // First is paid, show it as Paid and next as Current (if available)
        history[0].billStatus = 'Paid';
        history[0].statusColor = '#059669';
        history[0].statusIcon = '✅';
        visibleCycles.push(history[0]);

        if (history.length > 1) {
          history[1].billStatus = 'Current';
          history[1].statusColor = '#4CAF50';
          history[1].statusIcon = '📊';
          visibleCycles.push(history[1]);
        }
      } else {
        // First is not paid, show it as Current only
        history[0].billStatus = 'Current';
        history[0].statusColor = '#4CAF50';
        history[0].statusIcon = '📊';
        visibleCycles.push(history[0]);
      }
    }

    return visibleCycles;
  };

  // Delete user account - now shows password confirmation modal
  const deleteUser = async (userId: string, username: string) => {
    setDestructiveAction({ type: 'delete', userId, username });
    setShowDestructiveConfirm(true);
    setDestructivePassword("");
    setDestructiveError("");
  };

  // Reset user meter - now shows password confirmation modal
  const resetUserMeter = async (userId: string, username: string) => {
    setDestructiveAction({ type: 'reset', userId, username });
    setShowDestructiveConfirm(true);
    setDestructivePassword("");
    setDestructiveError("");
  };

  // Handle destructive action with password verification
  const handleDestructiveAction = async () => {
    if (!destructivePassword) {
      setDestructiveError("Password required");
      return;
    }
    if (!destructiveAction) return;

    setDestructiveLoading(true);
    setDestructiveError("");

    try {
      // Check if this is a pending user approve action
      const isPendingUser = pendingUsers.some(u => u.username === destructiveAction.username);
      
      if (destructiveAction.type === 'delete' && isPendingUser) {
        // Approve pending user
        await handlePendingUserAction(destructiveAction.username, 'approve');
        return;
      }
      
      if (destructiveAction.type === 'delete') {
        // Delete user
        const res = await fetch(`${API_URL}/api/admin/users/${encodeURIComponent(destructiveAction.username)}`, {
          method: "DELETE",
          headers: { 
            Authorization: "Bearer " + token,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ adminPassword: destructivePassword }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to delete user");
        }

        setUsers(users.filter(u => u.id !== destructiveAction.userId));
        if (selectedUserId === destructiveAction.userId) {
          setSelectedUserId(null);
          setUserReadings([]);
        }
        alert(`User ${destructiveAction.username} deleted successfully`);
      } else if (destructiveAction.type === 'reset') {
        // Reset meter
        const res = await fetch(`${API_URL}/api/admin/users/${encodeURIComponent(destructiveAction.username)}/reset-meter`, {
          method: "POST",
          headers: { 
            Authorization: "Bearer " + token,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ adminPassword: destructivePassword }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to reset meter");
        }

        alert(`Meter reset for ${destructiveAction.username}`);
        await loadDashboard();
      }

      setShowDestructiveConfirm(false);
      setDestructiveAction(null);
      setDestructivePassword("");
    } catch (err: any) {
      setDestructiveError(err.message || "Operation failed");
    } finally {
      setDestructiveLoading(false);
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

  // Approve pending user
  const approvePendingUser = async (username: string) => {
    setDestructiveAction({ type: 'delete', userId: username, username });
    setShowDestructiveConfirm(true);
    setDestructivePassword("");
    setDestructiveError("");
  };

  // Handle approve/reject with password
  const handlePendingUserAction = async (username: string, action: 'approve' | 'reject') => {
    if (!destructivePassword) {
      setDestructiveError("Password required");
      return;
    }

    setDestructiveLoading(true);
    setDestructiveError("");

    try {
      const res = await fetch(`${API_URL}/api/admin/users/${encodeURIComponent(username)}/${action}`, {
        method: "POST",
        headers: { 
          Authorization: "Bearer " + token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ adminPassword: destructivePassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed to ${action} user`);
      }

      alert(`User ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
      setPendingUsers(pendingUsers.filter(u => u.username !== username));
      setShowDestructiveConfirm(false);
      setDestructivePassword("");
      await loadDashboard();
    } catch (err: any) {
      setDestructiveError(err.message || `Failed to ${action} user`);
    } finally {
      setDestructiveLoading(false);
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

  // Auto-refresh user details modal every 3 seconds when open
  useEffect(() => {
    if (!selectedUserId) return;
    
    const user = users.find(u => u.id === selectedUserId);
    if (!user) return;
    
    const interval = setInterval(() => {
      loadUserReadings(selectedUserId, user.username);
    }, 3000); // Refresh every 3 seconds
    
    return () => clearInterval(interval);
  }, [selectedUserId, users, token]);

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
                    {users.reduce((sum, u) => sum + u.totalConsumption, 0).toFixed(6)} m³
                  </div>
                  <div style={{ fontSize: isMobile ? "0.75rem" : "0.85rem", color: "#666", marginTop: "0.5rem" }}>
                    Across all houses
                  </div>
                </div>

  
              </section>

              {/* Separator */}
              <div style={{ height: "1px", background: "#ddd", margin: "2rem 0" }} />

              {/* Pending Registrations Section */}
              {pendingUsers.length > 0 && (
                <section style={{ marginBottom: "3rem" }}>
                  <h2 style={{ color: "#d97706", fontSize: isMobile ? "1.2rem" : "1.5rem", marginBottom: "1.5rem", fontWeight: 600 }}>
                    ⏳ Pending Registrations ({pendingUsers.length})
                  </h2>
                  <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 2px 8px #0000000f", overflow: "hidden", overflowX: "auto" }}>
                    <div style={{ padding: "1rem" }}>
                      {pendingUsers.map((user) => (
                        <div
                          key={user.id}
                          style={{
                            background: "#fffbeb",
                            padding: "1rem",
                            marginBottom: "0.75rem",
                            borderRadius: "8px",
                            border: "1px solid #fcd34d",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            flexWrap: isMobile ? "wrap" : "nowrap",
                            gap: "1rem"
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, color: "#333", fontSize: "0.95rem" }}>
                              {user.username}
                            </div>
                            <div style={{ color: "#666", fontSize: "0.85rem", marginTop: "0.2rem" }}>
                              {user.email && `Email: ${user.email}`}
                            </div>
                            <div style={{ color: "#999", fontSize: "0.8rem", marginTop: "0.2rem" }}>
                              Registered: {new Date(user.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                            <button
                              onClick={() => {
                                setDestructiveAction({ type: 'delete', userId: user.id, username: user.username });
                                setShowDestructiveConfirm(true);
                                setDestructivePassword("");
                                setDestructiveError("");
                              }}
                              style={{
                                padding: "0.5rem 1rem",
                                background: "#10b981",
                                color: "#fff",
                                border: "none",
                                borderRadius: "6px",
                                cursor: "pointer",
                                fontSize: "0.85rem",
                                fontWeight: 600,
                                transition: "background 0.2s",
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = "#059669"}
                              onMouseLeave={(e) => e.currentTarget.style.background = "#10b981"}
                            >
                              ✅ Approve
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to reject "${user.username}"?`)) {
                                  handlePendingUserAction(user.username, 'reject');
                                }
                              }}
                              style={{
                                padding: "0.5rem 1rem",
                                background: "#ef4444",
                                color: "#fff",
                                border: "none",
                                borderRadius: "6px",
                                cursor: "pointer",
                                fontSize: "0.85rem",
                                fontWeight: 600,
                                transition: "background 0.2s",
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = "#dc2626"}
                              onMouseLeave={(e) => e.currentTarget.style.background = "#ef4444"}
                            >
                              ❌ Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}

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
                                  {(!user.lastReadingTimestamp && !user.createdAt) ? 'Not yet active' : (() => {
                                    const base = user.lastReadingTimestamp ? new Date(user.lastReadingTimestamp) : new Date(user.createdAt);
                                    const due = new Date(base.getTime() + 31 * 24 * 60 * 60 * 1000);
                                    return due.toISOString().split('T')[0];
                                  })()}
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
                              <td style={{ padding: "1rem", textAlign: "center", fontWeight: 600, color: "#0057b8" }}>
                                {(user.totalConsumption || 0).toFixed(6)}
                              </td>
                              <td style={{ padding: "1rem", textAlign: "center", fontWeight: 600, color: "#333" }}>
                                ₱{user.monthlyBill.toFixed(2)}
                              </td>
                              <td style={{ padding: "1rem", textAlign: "center", color: "#666", fontSize: "0.95rem" }}>
                                {(!user.lastReadingTimestamp && !user.createdAt) ? 'Not yet active' : (() => {
                                  const base = user.lastReadingTimestamp ? new Date(user.lastReadingTimestamp) : new Date(user.createdAt);
                                  const due = new Date(base.getTime() + 31 * 24 * 60 * 60 * 1000);
                                  return due.toISOString().split('T')[0];
                                })()}
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
                                    onClick={() => resetUserMeter(user.id, user.username)}
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
                  <div style={{ display: "flex", gap: "0.5rem" }}>
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
                        {users.find(u => u.id === selectedUserId)?.totalConsumption.toFixed(6) || "0.000000"} m³
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
                          <th style={{ padding: "0.75rem", textAlign: "center", color: "#333", fontWeight: 600 }}>Previous (m³)</th>
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
                            <td style={{ padding: "0.75rem", textAlign: "center", fontWeight: 600, color: "#666", fontSize: "0.9rem" }}>
                              {bill.billStatus === 'Paid' && idx > 0 ? (arr[idx - 1]?.consumption || '—') : '—'}
                            </td>
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
                                const payment = userPayments.find(p => 
                                  p.billingMonth === bill.billingMonth && 
                                  p.billingYear === bill.billingYear &&
                                  (p.status === 'verified' || p.status === 'confirmed' || p.status === 'PAID')
                                );
                                
                                if (payment) {
                                  const paymentDate = payment.paymentDate || payment.verifiedAt || payment.submittedAt || payment.paidAt;
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
                                
                                return <span style={{ color: '#ff9800', fontWeight: 600 }}>⏳ Pending</span>;
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

      {/* Destructive Action Confirmation Modal (Delete/Reset with Password) */}
      {showDestructiveConfirm && destructiveAction && (
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
              maxWidth: "450px",
              width: "100%",
            }}
          >
            <h2 style={{ color: "#dc3545", marginBottom: "0.5rem", fontSize: isMobile ? "1.1rem" : "1.3rem", fontWeight: 600 }}>
              ⚠️ Confirm {destructiveAction.type === 'delete' ? 'Delete User' : 'Reset Meter'}
            </h2>
            
            <p style={{ color: "#666", marginBottom: "1rem", fontSize: "0.95rem" }}>
              {destructiveAction.type === 'delete' 
                ? `This will permanently delete user "${destructiveAction.username}" and ALL their data (readings, payments, history). This CANNOT be undone.`
                : `This will reset the water meter for "${destructiveAction.username}". Their current consumption will be locked into their billing history, and the meter will start from 0.`
              }
            </p>

            <p style={{ color: "#d97706", background: "#fef3c7", padding: "0.75rem", borderRadius: "6px", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
              🔐 Enter your admin password to confirm this action.
            </p>

            {destructiveError && (
              <div style={{ background: "#f8d7da", color: "#721c24", padding: "0.75rem 1rem", borderRadius: "6px", marginBottom: "1rem", fontSize: "0.9rem" }}>
                {destructiveError}
              </div>
            )}

            <input
              type="password"
              placeholder="Admin Password"
              value={destructivePassword}
              onChange={(e) => setDestructivePassword(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && destructivePassword) {
                  handleDestructiveAction();
                }
              }}
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
                  setShowDestructiveConfirm(false);
                  setDestructiveAction(null);
                  setDestructivePassword("");
                  setDestructiveError("");
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
                onClick={handleDestructiveAction}
                disabled={destructiveLoading || !destructivePassword}
                style={{
                  padding: "0.7rem 1.5rem",
                  background: destructiveLoading || !destructivePassword ? "#ccc" : "#dc3545",
                  border: "none",
                  borderRadius: "6px",
                  cursor: destructiveLoading || !destructivePassword ? "not-allowed" : "pointer",
                  fontSize: isMobile ? "0.9rem" : "0.95rem",
                  fontWeight: 600,
                  color: "#fff",
                  transition: "background 0.2s",
                  minHeight: "44px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onMouseEnter={(e) => !destructiveLoading && destructivePassword && (e.currentTarget.style.background = "#bb2d3b")}
                onMouseLeave={(e) => !destructiveLoading && destructivePassword && (e.currentTarget.style.background = "#dc3545")}
              >
                {destructiveLoading ? "Confirming..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminDashboard;
