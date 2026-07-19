import { useState } from 'react';
import '../../styles/forms.css';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Shield, Eye, EyeOff, AlertCircle, Mail, Lock, Activity, Database, Cpu, ShieldCheck, BadgeInfo } from 'lucide-react';
import { useAuth } from '../../api/auth';
import { getDefaultRoute } from '../../routes/RequireRole';
import { loginSchema, type LoginFormData } from '../../lib/schemas';

const DEMO_CREDENTIALS = [
  { role: 'Reporter', email: 'reporter@pharmasafe.io', password: 'reporter123' },
  { role: 'Reviewer', email: 'reviewer@pharmasafe.io', password: 'reviewer123' },
  { role: 'Admin', email: 'admin@pharmasafe.io', password: 'admin123' }
];

export default function LoginPage() {
  const { login, error: authError, loading } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login(data.email, data.password);
      const stored = localStorage.getItem('pharmasafe_user');
      if (stored) {
        const user = JSON.parse(stored);
        navigate(getDefaultRoute(user.role), { replace: true });
      }
    } catch {
      // Error handled by auth context
    }
  };

  return (
    <div className="login-page-wrapper">
      {/* Left visual console panel (hidden below 1024px) */}
      <div className="login-visual-panel">
        <div className="login-visual-grid" />
        
        {/* Visual Panel Header */}
        <div className="login-visual-header">
          <div className="login-visual-header-logo">
            <Shield size={20} color="#8be8e2" />
          </div>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.9)' }}>
            PharmaSafe Portal
          </span>
        </div>

        {/* Visual Panel Body */}
        <div className="login-visual-body">
          <h2 className="login-visual-tagline">
            Next-Gen AI Clinical Safety & Triage Console
          </h2>
          <p className="login-visual-desc">
            Automated adverse event extraction, medical coding, and Naranjo causality scoring built for clinical safety review professionals.
          </p>

          {/* Interactive Healthcare Dashboard Mockup Card */}
          <div className="simulated-panel">
            <div className="simulated-header">
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Activity size={12} color="var(--indigo-light)" />
                Active Extraction Pipeline
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--confirmed-green)', fontWeight: 600 }}>ONLINE</span>
                <div className="simulated-dot" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, margin: '14px 0' }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <p style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase' }}>Extraction Accuracy</p>
                <p style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: '#8be8e2', fontFamily: 'var(--font-mono)', marginTop: 2 }}>99.8%</p>
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <p style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase' }}>Avg Review Time</p>
                <p style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--indigo-light)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>4.2 hrs</p>
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <p style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase' }}>Processed Today</p>
                <p style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: '#ffffff', fontFamily: 'var(--font-mono)', marginTop: 2 }}>147 cases</p>
              </div>
            </div>

            <div className="simulated-pulse-line" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: 'rgba(255, 255, 255, 0.4)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Cpu size={10} /> NLP Engine v4.4.2</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Database size={10} /> SNOMED CT Release 2025</span>
            </div>
          </div>
        </div>

        {/* Visual Panel Footer Compliance Badges */}
        <div className="compliance-row">
          <span className="compliance-badge" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <ShieldCheck size={12} color="var(--confirmed-green)" /> HIPAA Secure
          </span>
          <span className="compliance-badge">FDA 21 CFR Part 11</span>
          <span className="compliance-badge">GDPR Data Privacy Compliant</span>
        </div>
      </div>

      {/* Right form panel */}
      <div className="login-form-panel">
        <div className="ambient-glow-1" />
        <div className="ambient-glow-2" />

        <div className="login-form-wrapper">
          {/* Brand header for mobile layout */}
          <div style={{ textAlign: 'center', marginBottom: 28 }} className="lg:hidden">
            <div style={{
              width: 48,
              height: 48,
              background: 'var(--teal)',
              borderRadius: 'var(--radius-lg)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            }}>
              <Shield size={24} color="#fff" />
            </div>
            <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--ink)' }}>
              PharmaSafe
            </h1>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-secondary)' }}>
              Adverse Drug Event Processing Portal
            </p>
          </div>

          {/* Login card */}
          <div className="login-form-card">
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--ink-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Portal Authentication
            </span>
            <h2 style={{
              fontSize: 'var(--text-lg)',
              fontWeight: 600,
              color: 'var(--ink)',
              marginTop: 4,
              marginBottom: 20,
            }}>
              Sign in to Console
            </h2>

            {authError && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                background: 'var(--error-bg)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 16,
                fontSize: 'var(--text-sm)',
                color: 'var(--error)',
              }} className="field-error-shake">
                <AlertCircle size={16} />
                {authError}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Email</label>
                <div className="input-icon-wrapper">
                  <Mail size={16} className="input-icon-left" />
                  <input
                    type="email"
                    className={`form-input input-with-icon ${errors.email ? 'error' : ''}`}
                    placeholder="you@pharmasafe.io"
                    autoComplete="email"
                    {...register('email')}
                  />
                </div>
                {errors.email && <p className="form-error">{errors.email.message}</p>}
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label">Password</label>
                <div className="input-icon-wrapper">
                  <Lock size={16} className="input-icon-left" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={`form-input input-with-icon ${errors.password ? 'error' : ''}`}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    style={{ paddingRight: 36 }}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--ink-tertiary)',
                      padding: 2,
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && <p className="form-error">{errors.password.message}</p>}
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-lg"
                style={{ width: '100%' }}
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div className="demo-credentials">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <BadgeInfo size={16} color="var(--indigo)" />
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink)' }}>
                  Demo credentials
                </span>
              </div>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-secondary)', marginBottom: 12 }}>
                Use any of the following accounts to sign in:
              </p>
              <div style={{ display: 'grid', gap: 10 }}>
                {DEMO_CREDENTIALS.map((credential) => (
                  <div key={credential.role} style={{ display: 'grid', gap: 4 }}>
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--ink-tertiary)' }}>
                      {credential.role}
                    </div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>
                      {credential.email}
                    </div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>
                      {credential.password}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
