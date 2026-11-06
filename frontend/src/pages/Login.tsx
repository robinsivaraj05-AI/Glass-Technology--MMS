import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Eye, EyeOff, Zap, Shield, Lock, Mail, AlertCircle,
  Wrench, Settings, Gauge, Activity, Cpu, BarChart3,
} from 'lucide-react';

// ── Rotating quotes ───────────────────────────────────────────────────────────
const QUOTES = [
  { text: 'An ounce of prevention is worth a pound of cure.', author: 'Benjamin Franklin' },
  { text: 'Maintenance is not a cost — it is an investment in reliability.', author: '' },
  { text: 'Safety is not a gadget but a state of mind.', author: 'Eleanor Everet' },
  { text: 'Quality means doing it right when no one is looking.', author: 'Henry Ford' },
  { text: 'The strength of a maintenance team lies in preventive action, not reactive repair.', author: '' },
  { text: 'Excellence is never an accident — it results from high intention and skillful execution.', author: 'Aristotle' },
];

// ── Tool feature cards ────────────────────────────────────────────────────────
const TOOLS = [
  { Icon: Zap,       label: 'Electrical',   desc: 'E&I Systems & Wiring',        color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.22)' },
  { Icon: Wrench,    label: 'Maintenance',  desc: 'Preventive & Corrective PM',  color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.22)' },
  { Icon: Settings,  label: 'Automation',   desc: 'PLC & Control Systems',       color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.22)' },
  { Icon: Gauge,     label: 'Instruments',  desc: 'Real-time Monitoring',        color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.22)'  },
  { Icon: Shield,    label: 'Safety',       desc: 'HSE & Compliance Tracking',   color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.22)'  },
  { Icon: Activity,  label: 'Analytics',    desc: 'Performance & Insights',      color: '#06b6d4', bg: 'rgba(6,182,212,0.1)',  border: 'rgba(6,182,212,0.22)'  },
];

// ── Ambient orbs ─────────────────────────────────────────────────────────────
const ORBS: { size: number; color: string; delay: string; pos: React.CSSProperties }[] = [
  { size: 360, color: 'rgba(59,130,246,0.16)',  delay: '0s',  pos: { top: '-100px', left: '-100px' }  },
  { size: 300, color: 'rgba(99,102,241,0.14)', delay: '2.5s', pos: { bottom: '-80px', right: '-80px' } },
  { size: 200, color: 'rgba(6,182,212,0.09)',  delay: '1.2s', pos: { top: '38%', right: '8%' }         },
];

export default function Login() {
  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [visible, setVisible]   = useState(true);

  // Rotate quote every 5 s with fade transition
  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setQuoteIdx(i => (i + 1) % QUOTES.length);
        setVisible(true);
      }, 380);
    }, 5000);
    return () => clearInterval(id);
  }, []);

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

  const q = QUOTES[quoteIdx];

  return (
    <>
      <style>{`
        @keyframes orb-drift {
          0%,100% { transform: translateY(0)   scale(1);    }
          50%      { transform: translateY(-22px) scale(1.07); }
        }
        @keyframes card-hover {
          0%,100% { box-shadow: 0 2px 10px rgba(0,0,0,0.3); }
          50%      { box-shadow: 0 6px 24px rgba(0,0,0,0.5); }
        }
        .tool-card {
          transition: transform 0.25s ease, box-shadow 0.25s ease !important;
        }
        .tool-card:hover {
          transform: translateY(-3px) scale(1.025) !important;
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
      `}</style>

      <div style={{ minHeight: '100vh', display: 'flex', background: '#030712' }}>

        {/* ════════════════════════════════════════════════════════════════
            LEFT — Decorative panel
        ════════════════════════════════════════════════════════════════ */}
        <div style={{
          flex: '0 0 58%',
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(145deg, #020c1e 0%, #040f22 50%, #030810 100%)',
          display: 'flex',
          flexDirection: 'column',
          padding: '48px 52px',
        }}>

          {/* Animated ambient orbs */}
          {ORBS.map((orb, i) => (
            <div key={i} style={{
              position: 'absolute',
              width: orb.size, height: orb.size,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${orb.color}, transparent 70%)`,
              filter: 'blur(50px)',
              animation: `orb-drift ${7 + i * 2}s ease-in-out infinite`,
              animationDelay: orb.delay,
              ...orb.pos,
            }} />
          ))}

          {/* Fine dot grid */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.045) 1px, transparent 1px)',
            backgroundSize: '26px 26px',
          }} />

          {/* Subtle horizontal scan line */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'linear-gradient(to bottom, transparent 0%, rgba(59,130,246,0.03) 50%, transparent 100%)',
          }} />

          {/* ── Brand header ──────────────────────────────────────── */}
          <div style={{ position: 'relative', zIndex: 2, marginBottom: 36 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
              <div style={{
                width: 50, height: 50, borderRadius: 14,
                background: 'linear-gradient(135deg, #2563eb, #6366f1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, boxShadow: '0 6px 28px rgba(59,130,246,0.5)',
                flexShrink: 0,
              }}>⚡</div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9', letterSpacing: -0.3 }}>E&I MMS</div>
                <div style={{ fontSize: 11, color: '#475569' }}>Glass Technology India · Maintenance Portal</div>
              </div>
            </div>

            <h2 style={{
              fontSize: 30, fontWeight: 800, lineHeight: 1.2, margin: '0 0 12px',
              background: 'linear-gradient(130deg, #f1f5f9 10%, #93c5fd 55%, #c4b5fd 100%)',
              backgroundSize: '200% auto',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              animation: 'shimmer 6s linear infinite',
            }}>
              Powering Maintenance<br />Excellence
            </h2>
            <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.65, margin: 0 }}>
              Manage electrical & instrumentation systems,<br />
              track jobs, monitor attendance, and more — all in one place.
            </p>
          </div>

          {/* ── Tool cards 3 × 2 ─────────────────────────────────── */}
          <div style={{
            position: 'relative', zIndex: 2,
            display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12,
            marginBottom: 28,
          }}>
            {TOOLS.map(({ Icon, label, desc, color, bg, border }) => (
              <div key={label} className="tool-card" style={{
                background: bg,
                border: `1px solid ${border}`,
                borderRadius: 14,
                padding: '15px 13px',
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 9,
                  background: `${color}1a`,
                  border: `1px solid ${color}35`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 10,
                  boxShadow: `0 4px 14px ${color}25`,
                }}>
                  <Icon size={17} color={color} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.45 }}>{desc}</div>
              </div>
            ))}
          </div>

          {/* ── Rotating quote ────────────────────────────────────── */}
          <div style={{
            position: 'relative', zIndex: 2,
            marginTop: 'auto',
            padding: '20px 22px',
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 16,
            backdropFilter: 'blur(8px)',
          }}>
            {/* Large decorative quote mark */}
            <div style={{
              fontSize: 52, lineHeight: 0.8, color: '#3b82f6', opacity: 0.35,
              marginBottom: 10, fontFamily: 'Georgia, serif', userSelect: 'none',
            }}>"</div>

            {/* Quote text with fade */}
            <div style={{
              minHeight: 68,
              transition: 'opacity 0.38s ease, transform 0.38s ease',
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(7px)',
            }}>
              <p style={{
                fontSize: 13, color: '#94a3b8', lineHeight: 1.7,
                fontStyle: 'italic', margin: 0,
              }}>{q.text}</p>
              {q.author && (
                <p style={{ fontSize: 11, color: '#475569', marginTop: 8, fontWeight: 600 }}>
                  — {q.author}
                </p>
              )}
            </div>

            {/* Progress pills */}
            <div style={{ display: 'flex', gap: 5, marginTop: 14, alignItems: 'center' }}>
              {QUOTES.map((_, i) => (
                <div key={i} style={{
                  height: 4, borderRadius: 2,
                  width: i === quoteIdx ? 22 : 5,
                  background: i === quoteIdx ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                  transition: 'all 0.4s ease',
                }} />
              ))}
            </div>
          </div>

          {/* Bottom copyright */}
          <p style={{ position: 'relative', zIndex: 2, marginTop: 20, fontSize: 10, color: '#1e3a5f', textAlign: 'center' }}>
            © {new Date().getFullYear()} Glass Technology India · E&I Department
          </p>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            RIGHT — Login form
        ════════════════════════════════════════════════════════════════ */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 32px',
          background: 'radial-gradient(ellipse at 80% 20%, rgba(99,102,241,0.07) 0%, transparent 60%), #050507',
          position: 'relative',
        }}>
          {/* Grid overlay */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.013) 1px, transparent 1px),' +
              'linear-gradient(90deg, rgba(255,255,255,0.013) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }} />

          <div style={{ width: '100%', maxWidth: 380, position: 'relative', zIndex: 1 }}>

            {/* ── Login card ───────────────────────────────────── */}
            <div style={{
              padding: '40px 36px',
              background: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 20,
              backdropFilter: 'blur(20px)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(59,130,246,0.05)',
            }}>
              <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', margin: 0 }}>Welcome Back</h1>
                <p style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>Sign in to continue to the portal</p>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Email */}
                <div>
                  <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6, fontWeight: 500 }}>
                    Email Address
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                    <input
                      type="email" value={email} onChange={e => setEmail(e.target.value)}
                      className="input-dark" style={{ paddingLeft: 36 }}
                      placeholder="Enter your email" required autoComplete="username"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6, fontWeight: 500 }}>
                    Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                    <input
                      type={showPass ? 'text' : 'password'} value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="input-dark" style={{ paddingLeft: 36, paddingRight: 40 }}
                      placeholder="Enter your password" required autoComplete="current-password"
                    />
                    <button
                      type="button" onClick={() => setShowPass(s => !s)}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 4 }}
                    >
                      {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8 }}>
                    <AlertCircle size={14} style={{ color: '#ef4444', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#ef4444' }}>{error}</span>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit" disabled={submitting || loading}
                  className="btn-primary"
                  style={{ justifyContent: 'center', padding: '12px 20px', marginTop: 4, fontSize: 14, opacity: submitting ? 0.7 : 1 }}
                >
                  {submitting ? 'Signing in…' : 'Sign In →'}
                </button>
              </form>

              {/* Feature pills */}
              <div style={{ marginTop: 24, display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                {[
                  { icon: <Shield size={11} />, text: 'Role-based Access' },
                  { icon: <Zap size={11} />,    text: 'Real-time Alerts'  },
                  { icon: <Lock size={11} />,   text: 'Secure Session'    },
                ].map(f => (
                  <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#475569' }}>
                    <span style={{ color: '#3b82f6' }}>{f.icon}</span> {f.text}
                  </div>
                ))}
              </div>
            </div>

            {/* Session notice */}
            <p style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: '#1e293b' }}>
              Session expires after 5 minutes of inactivity
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
