import { useState, useEffect, useRef } from 'react';
import { User, Bell, Shield, Database, Globe, Save, Camera, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useEmployees } from '../context/EmployeeContext';

const LANGUAGES = ['English', 'Tamil (தமிழ்)', 'Hindi'];
const THEMES = ['Dark (Default)', 'Light', 'System'];

export default function Settings() {
  const { user, updateUser } = useAuth();
  const { employees } = useEmployees();
  const [tab, setTab] = useState<'profile' | 'notifications' | 'security' | 'system'>('profile');
  const [saved, setSaved] = useState(false);

  // Linked employee state (by empId)
  const [linkedEmpId, setLinkedEmpId] = useState(user?.employeeId ?? '');

  // Profile form state
  const [form, setForm] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    department: user?.department ?? '',
    shift: user?.shift ?? 'General',
    phone: user?.phone ?? '',
    dateOfJoining: user?.dateOfJoining ?? '',
  });

  // Sync form when user changes (e.g. after login)
  useEffect(() => {
    setForm({
      name: user?.name ?? '',
      email: user?.email ?? '',
      department: user?.department ?? '',
      shift: user?.shift ?? 'General',
      phone: user?.phone ?? '',
      dateOfJoining: user?.dateOfJoining ?? '',
    });
    setLinkedEmpId(user?.employeeId ?? '');
  }, [user?.id]);

  // When an employee is selected from the dropdown, auto-fill all fields from their profile
  const handleEmployeeSelect = (empId: string) => {
    setLinkedEmpId(empId);
    const emp = employees.find(e => e.empId === empId);
    if (!emp) return;
    setForm(prev => ({
      ...prev,
      name: emp.name,
      email: emp.companyEmail || emp.personalEmail || prev.email,
      phone: emp.companyPhone || emp.uaePhone || emp.indiaPhone || prev.phone,
      dateOfJoining: emp.joiningDate || prev.dateOfJoining,
    }));
  };

  // Profile photo — stored in localStorage per user
  const photoKey = `profilePhoto_${user?.id || 'default'}`;
  const [photoUrl, setPhotoUrl] = useState<string>(() => localStorage.getItem(photoKey) ?? '');
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const url = ev.target?.result as string;
      setPhotoUrl(url);
      localStorage.setItem(photoKey, url);
    };
    reader.readAsDataURL(file);
  };

  const [lang, setLang] = useState('English');
  const [theme, setTheme] = useState('Dark (Default)');
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifSMS, setNotifSMS] = useState(false);
  const [notifBrowser, setNotifBrowser] = useState(true);

  const handleSave = () => {
    updateUser({
      name: form.name,
      email: form.email,
      employeeId: linkedEmpId || user?.employeeId,
      shift: form.shift,
      phone: form.phone,
      dateOfJoining: form.dateOfJoining,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const inp = (field: keyof typeof form, opts: { disabled?: boolean; type?: string; placeholder?: string } = {}) => (
    <input
      type={opts.type ?? 'text'}
      value={form[field]}
      onChange={e => !opts.disabled && setForm(p => ({ ...p, [field]: e.target.value }))}
      placeholder={opts.placeholder ?? ''}
      disabled={opts.disabled}
      className="input-dark"
      style={{ opacity: opts.disabled ? 0.5 : 1 }}
    />
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 900 }}>
      {/* Tab Nav */}
      <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.03)', padding: 4, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', width: 'fit-content' }}>
        {[
          { key: 'profile', label: 'Profile', icon: <User size={13} /> },
          { key: 'notifications', label: 'Notifications', icon: <Bell size={13} /> },
          { key: 'security', label: 'Security', icon: <Shield size={13} /> },
          { key: 'system', label: 'System', icon: <Database size={13} /> },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)} style={{
            padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
            background: tab === t.key ? '#3b82f6' : 'none', color: tab === t.key ? 'white' : '#64748b',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>{t.icon}{t.label}</button>
        ))}
      </div>

      {tab === 'profile' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
          {/* Avatar */}
          <div className="glass-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            {photoUrl ? (
              <img
                src={photoUrl}
                alt="Profile"
                style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(59,130,246,0.5)' }}
              />
            ) : (
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, color: 'white' }}>
                {(form.name || user?.name || '').split(' ').map((n: string) => n[0]).join('').slice(0, 2) || '??'}
              </div>
            )}
            {/* Hidden file input */}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handlePhotoChange}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
              <button
                className="btn-secondary"
                style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={() => photoInputRef.current?.click()}
              >
                <Camera size={12} /> Change Photo
              </button>
              {photoUrl && (
                <button
                  style={{ fontSize: 10, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  onClick={() => { setPhotoUrl(''); localStorage.removeItem(photoKey); }}
                >
                  Remove photo
                </button>
              )}
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>{form.name || user?.name || '—'}</div>
              <div style={{ fontSize: 11, color: '#60a5fa', textTransform: 'capitalize', marginTop: 2 }}>
                {employees.find(e => e.empId === linkedEmpId)?.designation || user?.role.replace(/_/g, ' ')}
              </div>
              <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{linkedEmpId || user?.employeeId || '—'}</div>
            </div>
          </div>

          {/* Form */}
          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', marginBottom: 16 }}>Profile Information</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>Full Name</label>
                <select
                  className="input-dark"
                  value={linkedEmpId}
                  onChange={e => handleEmployeeSelect(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="">— Select your employee profile —</option>
                  {employees
                    .filter(e => e.status !== 'resigned' && e.status !== 'not_joined')
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(e => (
                      <option key={e.id} value={e.empId}>{e.name} ({e.empId})</option>
                    ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>
                  Employee ID
                  {linkedEmpId && <span style={{ marginLeft: 6, fontSize: 10, color: '#22c55e' }}>● auto-filled</span>}
                </label>
                <input
                  type="text"
                  value={linkedEmpId || (user?.employeeId ?? '')}
                  disabled
                  className="input-dark"
                  style={{ opacity: 0.6, cursor: 'not-allowed' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>Email</label>
                {inp('email', { type: 'email', placeholder: 'company@email.com' })}
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>Department</label>
                <input type="text" value={user?.department ?? ''} disabled className="input-dark" style={{ opacity: 0.5 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>Designation / Role</label>
                <input type="text" value={user?.role.replace(/_/g, ' ') ?? ''} disabled className="input-dark" style={{ opacity: 0.5, textTransform: 'capitalize' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>Shift</label>
                <select
                  value={form.shift}
                  onChange={e => setForm(p => ({ ...p, shift: e.target.value }))}
                  className="input-dark"
                >
                  {['General', 'A Shift', 'B Shift', 'C Shift'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>
                  Company Mobile
                  {form.phone && form.phone !== (user?.phone ?? '') && <span style={{ marginLeft: 6, fontSize: 10, color: '#22c55e' }}>● auto-filled</span>}
                </label>
                {inp('phone', { type: 'tel', placeholder: '+971 XXXX XXXX' })}
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>Date of Joining</label>
                {inp('dateOfJoining', { type: 'date' })}
              </div>
            </div>
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={handleSave}
                className="btn-primary"
                style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {saved ? <Check size={13} /> : <Save size={13} />}
                {saved ? 'Saved!' : 'Save Changes'}
              </button>
              {saved && <span style={{ fontSize: 12, color: '#22c55e' }}>Profile updated successfully</span>}
            </div>
          </div>
        </div>
      )}

      {tab === 'notifications' && (
        <div className="glass-card" style={{ padding: 24, maxWidth: 600 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', marginBottom: 20 }}>Notification Preferences</div>
          {[
            { label: 'Email Notifications', desc: 'Receive alerts and reports via email', value: notifEmail, set: setNotifEmail },
            { label: 'SMS Notifications', desc: 'Receive critical alerts via SMS', value: notifSMS, set: setNotifSMS },
            { label: 'Browser Notifications', desc: 'Show push notifications in browser', value: notifBrowser, set: setNotifBrowser },
          ].map(n => (
            <div key={n.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>{n.label}</div>
                <div style={{ fontSize: 11, color: '#475569' }}>{n.desc}</div>
              </div>
              <button
                onClick={() => n.set(!n.value)}
                style={{
                  width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: n.value ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                  position: 'relative', transition: 'all 0.2s',
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', background: 'white',
                  position: 'absolute', top: 3,
                  left: n.value ? 23 : 3,
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }} />
              </button>
            </div>
          ))}
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12, fontWeight: 500 }}>Alert Types to Receive</div>
            {['Critical Breakdown Alerts', 'PM Due Reminders', 'Calibration Due Alerts', 'Approval Requests', 'Power Quality Alerts', 'Budget Threshold Alerts'].map(a => (
              <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
                <input type="checkbox" defaultChecked style={{ accentColor: '#3b82f6' }} />
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{a}</span>
              </div>
            ))}
          </div>
          <button className="btn-primary" style={{ marginTop: 16, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Save size={13} /> Save Preferences</button>
        </div>
      )}

      {tab === 'security' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', marginBottom: 16 }}>Change Password</div>
            {['Current Password', 'New Password', 'Confirm New Password'].map(f => (
              <div key={f} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>{f}</label>
                <input type="password" className="input-dark" placeholder="••••••••" />
              </div>
            ))}
            <button className="btn-primary" style={{ fontSize: 12 }}>Update Password</button>
          </div>
          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', marginBottom: 16 }}>Active Sessions</div>
            {[
              { device: 'Windows PC — Chrome', location: 'Chennai, IN', time: 'Now (current)', active: true },
              { device: 'Android Phone', location: 'Chennai, IN', time: '2 hours ago', active: false },
            ].map(s => (
              <div key={s.device} style={{ padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 500 }}>{s.device}</div>
                  <div style={{ fontSize: 11, color: '#475569' }}>{s.location} · {s.time}</div>
                </div>
                {s.active ? <span className="badge badge-success">Current</span> : <button className="btn-danger" style={{ padding: '3px 10px', fontSize: 11 }}>Revoke</button>}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'system' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Globe size={16} /> Preferences</div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>Language</label>
              <select value={lang} onChange={e => setLang(e.target.value)} className="input-dark">
                {LANGUAGES.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>Theme</label>
              <select value={theme} onChange={e => setTheme(e.target.value)} className="input-dark">
                {THEMES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>Date Format</label>
              <select className="input-dark">
                <option>DD/MM/YYYY</option>
                <option>MM/DD/YYYY</option>
                <option>YYYY-MM-DD</option>
              </select>
            </div>
            <button className="btn-primary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Save size={13} /> Apply Settings</button>
          </div>
          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Database size={16} /> System Info</div>
            {[
              { label: 'Application Version', value: 'MMS v2.0.0' },
              { label: 'Database', value: 'MongoDB Atlas' },
              { label: 'Server', value: 'Node.js / Express' },
              { label: 'Last Backup', value: '2026-07-25 00:00' },
              { label: 'Data Size', value: '2.4 GB' },
              { label: 'Active Users', value: '12' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12 }}>
                <span style={{ color: '#64748b' }}>{s.label}</span>
                <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{s.value}</span>
              </div>
            ))}
            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <button className="btn-secondary" style={{ fontSize: 11 }}>Backup Now</button>
              <button className="btn-secondary" style={{ fontSize: 11 }}>Clear Cache</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
