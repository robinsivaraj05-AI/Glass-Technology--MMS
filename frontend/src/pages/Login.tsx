import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Zap, Shield, Lock, Mail, AlertCircle } from 'lucide-react';

const DEMO_ACCOUNTS = [
  { label: 'Manager',        email: 'manager@mms.com', password: 'mgr@2026', color: '#ef4444', role: 'Admin Access' },
  { label: 'Deputy Manager', email: 'deputy@mms.com',  password: 'dm@2026',  color: '#3b82f6', role: 'Admin Access' },
  { label: 'Shift Engineer', email: 'shift@mms.com',   password: 'se@2026',  color: '#22c55e', role: 'Limited Access' },
  { label: 'Guest',          email: 'guest@mms.com',   password: 'guest123', color: '#64748b', role: 'View Only' },
];

export default function Login() {
  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('manager@mms.com');
  const [password, setPassword] = useState('mgr@2026');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const ok = await login(email, password);
    if (ok) navigate('/dashboard');
    else setError('Invalid credentials. Try a demo account below.');
    setSubmitting(false);
  };

  const fillDemo = (acc: typeof DEMO_ACCOUNTS[0]) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setError('');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 20% 50%, rgba(59,130,246,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(99,102,241,0.06) 0%, transparent 60%), #050507',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }}>
      {/* Background grid */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      <div style={{ width: '100%', maxWidth: 1000, display: 'flex', gap: 32, alignItems: 'stretch' }}>
        {/* Left Panel */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: '40px 32px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 20,
          backdropFilter: 'blur(20px)',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 40 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, boxShadow: '0 8px 32px rgba(59,130,246,0.4)',
            }}>⚡</div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#f8fafc', letterSpacing: -0.5 }}>E&I MMS</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Maintenance Management System</div>
            </div>
          </div>

          <div style={{ marginBottom: 8 }}>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: '#f8fafc', margin: 0 }}>Welcome Back</h1>
            <p style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>Sign in to continue to the E&I MMS portal</p>
          </div>

          <form onSubmit={handleSubmit} style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6, fontWeight: 500 }}>Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="input-dark" style={{ paddingLeft: 36 }}
                  placeholder="Enter your email" required
                />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6, fontWeight: 500 }}>Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                <input
                  type={showPass ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input-dark" style={{ paddingLeft: 36, paddingRight: 36 }}
                  placeholder="Enter your password" required
                />
                <button
                  type="button" onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#475569', cursor: 'pointer' }}
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8 }}>
                <AlertCircle size={14} style={{ color: '#ef4444', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#ef4444' }}>{error}</span>
              </div>
            )}

            <button
              type="submit" disabled={submitting}
              className="btn-primary"
              style={{ justifyContent: 'center', padding: '11px 20px', marginTop: 4, fontSize: 14, opacity: submitting ? 0.7 : 1 }}
            >
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Features */}
          <div style={{ marginTop: 32, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[
              { icon: <Shield size={13} />, text: 'Role-based Access' },
              { icon: <Zap size={13} />, text: 'Real-time Alerts' },
              { icon: <Lock size={13} />, text: 'Secure & Encrypted' },
            ].map(f => (
              <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#475569' }}>
                <span style={{ color: '#3b82f6' }}>{f.icon}</span> {f.text}
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel - Demo accounts */}
        <div style={{ width: 300, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
            Demo Accounts
          </div>
          {DEMO_ACCOUNTS.map(acc => (
            <button
              key={acc.email}
              onClick={() => fillDemo(acc)}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${email === acc.email ? acc.color + '60' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 12, padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
                transition: 'all 0.2s',
                boxShadow: email === acc.email ? `0 0 20px ${acc.color}20` : 'none',
              }}
              onMouseOver={e => { if (email !== acc.email) e.currentTarget.style.borderColor = acc.color + '40'; }}
              onMouseOut={e => { if (email !== acc.email) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: acc.color + '20',
                  border: `1px solid ${acc.color}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16,
                }}>
                  {acc.label === 'Manager' ? '👔' : acc.label === 'Deputy Manager' ? '👨‍💼' : acc.label === 'Shift Engineer' ? '👷' : '👁️'}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{acc.label}</div>
                  <div style={{ fontSize: 11, color: acc.color }}>{acc.role}</div>
                  <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{acc.email}</div>
                </div>
              </div>
            </button>
          ))}

          <div style={{
            marginTop: 8, padding: '12px 14px',
            background: 'rgba(59,130,246,0.06)',
            border: '1px solid rgba(59,130,246,0.15)',
            borderRadius: 10, fontSize: 11, color: '#64748b',
            lineHeight: 1.6,
          }}>
            💡 Click any demo account to auto-fill credentials, then click <strong style={{ color: '#94a3b8' }}>Sign In</strong>.
          </div>
        </div>
      </div>
    </div>
  );
}

