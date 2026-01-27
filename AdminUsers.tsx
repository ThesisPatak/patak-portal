import React, { useEffect, useState } from 'react';

const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<Record<string,{role:string}>>({});
  const [loading, setLoading] = useState(false);
  const [newHouse, setNewHouse] = useState('');
  const [newPass, setNewPass] = useState('');
  const [msg, setMsg] = useState('');

  const token = (() => { try { return localStorage.getItem('adminToken'); } catch (e) { return null; } })();

  async function load() {
    setLoading(true); setMsg('');
    try {
      const res = await fetch('/api/admin/users', { headers: { 'Authorization': 'Bearer ' + (token || '') } });
      if (!res.ok) throw new Error('Failed');
      const j = await res.json();
      setUsers(j.users || {});
    } catch (e:any) {
      console.error(e);
      setMsg('Failed to load users: ' + (e.message || e));
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function createUser(e?:React.FormEvent) {
    if (e) e.preventDefault();
    setMsg('');
    if (!newHouse || !newPass) return setMsg('Provide houseId and password');
    try {
      const res = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (token || '') }, body: JSON.stringify({ houseId: newHouse, password: newPass, role: 'user' }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed');
      setMsg('Created ' + newHouse);
      setNewHouse(''); setNewPass('');
      await load();
    } catch (e:any) { setMsg('Create error: ' + (e.message || e)); }
  }

  async function del(h:string) {
    if (!confirm('Delete user ' + h + '?')) return;
    setMsg('');
    try {
      const res = await fetch('/api/admin/users/' + encodeURIComponent(h), { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + (token || '') } });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed');
      setMsg('Deleted ' + h);
      await load();
    } catch (e:any) { setMsg('Delete error: ' + (e.message || e)); }
  }

  return (
    <div style={{ marginTop: 12 }}>
      {msg ? <div style={{ marginBottom: 8, color: '#b00' }}>{msg}</div> : null}
      <form onSubmit={createUser} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <input id="houseId" name="houseId" placeholder="House ID" value={newHouse} onChange={e=>setNewHouse(e.target.value)} style={{padding:'0.5rem',borderRadius:8,border:'1px solid #ddd'}} />
        <input id="newPassword" name="newPassword" type="password" placeholder="Password" value={newPass} onChange={e=>setNewPass(e.target.value)} style={{padding:'0.5rem',borderRadius:8,border:'1px solid #ddd'}} />
        <button style={{padding:'0.5rem 0.75rem',background:'#0057b8',color:'#fff',border:'none',borderRadius:8}}>Create</button>
        <button type="button" onClick={load} style={{padding:'0.5rem 0.75rem',borderRadius:8}}>Reload</button>
      </form>

      {loading ? <div>Loading...</div> : (
        <div style={{ borderTop: '1px solid #eee', paddingTop: 8 }}>
          {Object.keys(users).length === 0 ? <div>No users</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr><th style={{ textAlign: 'left', padding: '6px 8px' }}>House</th><th style={{ textAlign: 'left', padding: '6px 8px' }}>Role</th><th></th></tr>
              </thead>
              <tbody>
                {Object.keys(users).map(h => (
                  <tr key={h}>
                    <td style={{ padding: '6px 8px' }}>{h}</td>
                    <td style={{ padding: '6px 8px' }}>{users[h].role}</td>
                    <td style={{ padding: '6px 8px' }}><button onClick={()=>del(h)} style={{padding:'6px 8px',background:'#fff',border:'1px solid #ddd',borderRadius:6}}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
