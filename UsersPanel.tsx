import React, { useEffect, useState } from 'react';

export default function UsersPanel() {
  const [token, setToken] = useState(() => { try { return localStorage.getItem('adminToken') || ''; } catch (e) { return ''; } });
  const [users, setUsers] = useState<Record<string, { role: string }>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (token) loadUsers(); }, []);

  async function loadUsers() {
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/admin/users', { headers: { 'Authorization': 'Bearer ' + token } });
      if (!res.ok) throw new Error('Failed to load users: ' + res.status);
      const j = await res.json();
      setUsers(j.users || {});
    } catch (e:any) {
      setError(String(e.message || e));
      setUsers({});
    } finally { setLoading(false); }
  }

  function saveToken() { try { localStorage.setItem('adminToken', token); } catch (e) {} loadUsers(); }
  function clearToken() { try { localStorage.removeItem('adminToken'); } catch (e) {} setToken(''); setUsers({}); }

  async function deleteUser(houseId:string) {
    if (!confirm('Delete user ' + houseId + '?')) return;
    try {
      const res = await fetch('/api/admin/users/' + encodeURIComponent(houseId), { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } });
      const j = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(j));
      await loadUsers();
    } catch (e:any) { alert('Delete failed: ' + (e.message || e)); }
  }

  return (
    <section style={{ marginTop: 24 }}>
      <h2 style={{ color: '#0057b8' }}>User Management</h2>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <input placeholder="Paste admin token here" value={token} onChange={e=>setToken(e.target.value)} style={{ flex: 1, padding: '0.5rem', borderRadius: 6, border: '1px solid #ddd' }} />
        <button onClick={saveToken} style={{ background:'#0057b8', color:'#fff', border:'none', padding:'0.5rem 0.8rem', borderRadius:6 }}>Set Token</button>
        <button onClick={clearToken} style={{ background:'#eee', border:'1px solid #ddd', padding:'0.5rem 0.8rem', borderRadius:6 }}>Clear</button>
      </div>
      {error && <div style={{ color:'#c70039', marginBottom:8 }}>{error}</div>}
      <div style={{ background:'#fafafa', padding:12, borderRadius:8 }}>
        <div style={{ display:'flex', gap:12, fontWeight:700, padding:'6px 8px', borderBottom:'1px solid #eee' }}>
          <div style={{ flex:1 }}>House ID</div>
          <div style={{ width:120 }}>Role</div>
          <div style={{ width:120 }}></div>
        </div>
        {loading ? <div style={{ padding:12 }}>Loading...</div> : null}
        {Object.keys(users).length === 0 && !loading ? <div style={{ padding:12 }}>No users to show.</div> : Object.keys(users).map(h => (
          <div key={h} style={{ display:'flex', gap:12, alignItems:'center', padding:'8px', borderBottom:'1px solid #fff' }}>
            <div style={{ flex:1 }}>{h}</div>
            <div style={{ width:120 }}>{users[h].role}</div>
            <div style={{ width:120 }}><button onClick={()=>deleteUser(h)} style={{ background:'#ff4d4f', color:'#fff', border:'none', padding:'6px 10px', borderRadius:6 }}>Delete</button></div>
          </div>
        ))}
      </div>
    </section>
  );
}
