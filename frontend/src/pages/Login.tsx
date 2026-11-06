import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Zap, Shield, Lock, Mail, AlertCircle } from 'lucide-react';

export default function Login() {
  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    else setError('Invalid credentials. Please contact your administrator.');
    setSubmitting(false);
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

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>
        <div style={{
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: '44px 40px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20,
          backdropFilter: 'blur(20px)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 36 }}>
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

          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#f8fafc', margin: 0 }}>Sign In</h1>
            <p style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>Enter your credentials to access the portal</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6, fontWeight: 500 }}>Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="input-dark" style={{ paddingLeft: 36 }}
                  placeholder="Enter your email" required autoComplete="username"
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
                  className="input-dark" style={{ paddingLeft: 36, paddingRight: 40 }}
                  placeholder="Enter your password" required autoComplete="current-password"
                />
                <button
                  type="button" onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 4 }}
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
              type="submit" disabled={submitting || loading}
              className="btn-primary"
              style={{ justifyContent: 'center', padding: '12px 20px', marginTop: 4, fontSize: 14, opacity: submitting ? 0.7 : 1 }}
            >
              {submitting ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div style={{ marginTop: 28, display: 'flex', gap: 20, justifyContent: 'center' }}>
            {[
              { icon: <Shield size={12} />, text: 'Role-based Access' },
              { icon: <Zap size={12} />, text: 'Real-time Alerts' },
              { icon: <Lock size={12} />, text: 'Secure Session' },
            ].map(f => (
              <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#475569' }}>
                <span style={{ color: '#3b82f6' }}>{f.icon}</span> {f.text}
              </div>
            ))}
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: '#334155' }}>
          Session expires after 5 minutes of inactivity
        </p>
      </div>
    </div>
  );
}
