import React, { useEffect, useState } from 'react';

const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<Record<string,{role:string}>>({});
  const [loading, setLoading] = useState(false);
  const [newHouse, setNewHouse] = useState('');
  const [newPass, setNewPass] = useState('');
  const [msg, setMsg] = useState('');
  const [adminPasswordModal, setAdminPasswordModal] = useState<{show: boolean, action: string, username: string}>({show: false, action: '', username: ''});
  const [adminPassword, setAdminPassword] = useState('');

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

  function promptDelete(h:string) {
    if (!confirm('Delete user ' + h + '?')) return;
    setAdminPasswordModal({show: true, action: 'delete', username: h});
    setAdminPassword('');
  }

  function promptReset(h:string) {
    if (!confirm('Reset meter for user ' + h + '?')) return;
    setAdminPasswordModal({show: true, action: 'reset', username: h});
    setAdminPassword('');
  }

  async function confirmAction() {
    if (!adminPassword) {
      setMsg('Admin password is required');
      return;
    }
    setMsg('');
    try {
      if (adminPasswordModal.action === 'delete') {
        const res = await fetch('/api/admin/users/' + encodeURIComponent(adminPasswordModal.username), { 
          method: 'DELETE', 
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (token || '') }, 
          body: JSON.stringify({ adminPassword })
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || 'Failed');
        setMsg('Deleted ' + adminPasswordModal.username);
        setAdminPasswordModal({show: false, action: '', username: ''});
        setAdminPassword('');
        await load();
      } else if (adminPasswordModal.action === 'reset') {
        const res = await fetch('/api/admin/users/' + encodeURIComponent(adminPasswordModal.username) + '/reset-meter', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (token || '') }, 
          body: JSON.stringify({ adminPassword })
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || 'Failed');
        setMsg('Reset meter for ' + adminPasswordModal.username);
        setAdminPasswordModal({show: false, action: '', username: ''});
        setAdminPassword('');
      }
    } catch (e:any) { setMsg(adminPasswordModal.action + ' error: ' + (e.message || e)); }
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
                    <td style={{ padding: '6px 8px', display: 'flex', gap: '4px' }}>
                      <button onClick={()=>promptReset(h)} style={{padding:'6px 8px',background:'#ff9800',color:'#fff',border:'none',borderRadius:6}}>Reset</button>
                      <button onClick={()=>promptDelete(h)} style={{padding:'6px 8px',background:'#f44336',color:'#fff',border:'none',borderRadius:6}}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Admin Password Modal */}
      {adminPasswordModal.show && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', minWidth: '300px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginTop: 0 }}>Confirm {adminPasswordModal.action === 'delete' ? 'Delete' : 'Reset'}</h3>
            <p>User: <strong>{adminPasswordModal.username}</strong></p>
            <p>Enter your admin password to confirm:</p>
            <input 
              type="password" 
              placeholder="Admin password" 
              value={adminPassword} 
              onChange={e=>setAdminPassword(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && confirmAction()}
              style={{width: '100%', padding: '8px', marginBottom: '16px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box'}}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => {setAdminPasswordModal({show: false, action: '', username: ''}); setAdminPassword('');}} style={{padding:'8px 16px',background:'#ccc',border:'none',borderRadius:4,cursor:'pointer'}}>Cancel</button>
              <button onClick={confirmAction} style={{padding:'8px 16px',background:'#0057b8',color:'#fff',border:'none',borderRadius:4,cursor:'pointer'}}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
