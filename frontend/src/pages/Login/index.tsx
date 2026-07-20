import { useState } from 'react';
import '../../styles/forms.css';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, LogIn } from 'lucide-react';
import { useAuth } from '../../api/auth';
import { getDefaultRoute } from '../../routes/RequireRole';
import { loginSchema, type LoginFormData } from '../../lib/schemas';

const DEMO_CREDENTIALS = [
  { role: 'Reporter', email: 'reporter@pharmasafe.io', password: 'reporter123' },
  { role: 'Reviewer', email: 'reviewer@pharmasafe.io', password: 'reviewer123' },
  { role: 'Admin', email: 'admin@pharmasafe.io', password: 'admin123' }
];

const ROLE_OPTIONS = ['Reporter', 'Reviewer', 'Admin'] as const;

type RoleOption = (typeof ROLE_OPTIONS)[number];

function getDemoCredentials(role: RoleOption) {
  return DEMO_CREDENTIALS.find(item => item.role === role) || DEMO_CREDENTIALS[0];
}

/* ── Custom pharma SVG drift icons ──────────────── */
function CapsuleIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
      <g transform="rotate(-30 32 32)">
        <path d="M14 26h18a8 8 0 0 1 8 8v0a8 8 0 0 1-8 8H14a8 8 0 0 1 0-16Z" fill="var(--coral)" fillOpacity=".85"/>
        <path d="M32 26h18a8 8 0 0 1 0 16H32Z" fill="var(--coral-2)" fillOpacity=".55"/>
        <rect x="12" y="24" width="40" height="16" rx="8" stroke="#fff" strokeOpacity=".35" strokeWidth="1.3"/>
      </g>
    </svg>
  );
}

function SyringeIcon() {
  return (
    <svg width="60" height="60" viewBox="0 0 64 64" fill="none">
      <g transform="rotate(35 32 32)">
        <rect x="24" y="10" width="8" height="8" rx="1.5" fill="var(--indigo)" fillOpacity=".8"/>
        <rect x="20" y="17" width="16" height="26" rx="3" fill="none" stroke="var(--indigo)" strokeWidth="2.4" strokeOpacity=".85"/>
        <rect x="24" y="23" width="8" height="14" fill="var(--indigo)" fillOpacity=".3"/>
        <line x1="28" y1="43" x2="28" y2="54" stroke="var(--indigo)" strokeWidth="2.4" strokeOpacity=".85"/>
        <line x1="20" y1="21" x2="14" y2="21" stroke="var(--indigo)" strokeWidth="2" strokeOpacity=".7"/>
        <line x1="20" y1="27" x2="15" y2="27" stroke="var(--indigo)" strokeWidth="2" strokeOpacity=".7"/>
        <line x1="20" y1="33" x2="14" y2="33" stroke="var(--indigo)" strokeWidth="2" strokeOpacity=".7"/>
      </g>
    </svg>
  );
}

function MedicineBottleIcon() {
  return (
    <svg width="50" height="50" viewBox="0 0 64 64" fill="none">
      <rect x="20" y="8" width="10" height="8" rx="1.5" fill="var(--cyan)" fillOpacity=".8"/>
      <path d="M17 18h16l3 6v28a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V24Z" fill="var(--cyan)" fillOpacity=".18" stroke="var(--cyan)" strokeWidth="2" strokeOpacity=".8"/>
      <line x1="16" y1="32" x2="34" y2="32" stroke="var(--cyan)" strokeWidth="1.4" strokeOpacity=".55"/>
      <path d="M22 40h6M25 37v6" stroke="var(--cyan)" strokeWidth="2" strokeLinecap="round" strokeOpacity=".9"/>
    </svg>
  );
}

function DropperBottleIcon() {
  return (
    <svg width="46" height="46" viewBox="0 0 64 64" fill="none">
      <path d="M28 8h8v10l6 6v28a5 5 0 0 1-5 5H27a5 5 0 0 1-5-5V24l6-6Z" fill="var(--amber)" fillOpacity=".22" stroke="var(--amber)" strokeWidth="2" strokeOpacity=".85"/>
      <rect x="26" y="6" width="12" height="6" rx="1.5" fill="var(--amber)" fillOpacity=".8"/>
      <line x1="22" y1="38" x2="42" y2="38" stroke="var(--amber)" strokeWidth="1.4" strokeOpacity=".5"/>
      <line x1="22" y1="46" x2="42" y2="46" stroke="var(--amber)" strokeWidth="1.4" strokeOpacity=".5"/>
    </svg>
  );
}

function StethoscopeIcon() {
  return (
    <svg width="54" height="54" viewBox="0 0 64 64" fill="none">
      <path d="M16 10v12a10 10 0 0 0 20 0V10" stroke="var(--coral-2)" strokeWidth="2.6" strokeLinecap="round" fill="none" strokeOpacity=".9"/>
      <path d="M26 22v8a10 10 0 0 0 10 10h2a8 8 0 0 1 8 8v2" stroke="var(--coral-2)" strokeWidth="2.6" strokeLinecap="round" fill="none" strokeOpacity=".9"/>
      <circle cx="46" cy="52" r="6" fill="var(--coral)" fillOpacity=".85"/>
      <circle cx="16" cy="9" r="3" fill="var(--coral-2)"/>
      <circle cx="36" cy="9" r="3" fill="var(--coral-2)"/>
    </svg>
  );
}

function AmpouleIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 64 64" fill="none">
      <g transform="rotate(20 32 32)">
        <path d="M26 12h12l2 8-8 32-8-32Z" fill="var(--cyan)" fillOpacity=".16" stroke="var(--cyan)" strokeWidth="2" strokeOpacity=".85"/>
        <line x1="24" y1="12" x2="40" y2="12" stroke="var(--cyan)" strokeWidth="2.4" strokeOpacity=".9"/>
        <line x1="27" y1="24" x2="37" y2="24" stroke="var(--cyan)" strokeWidth="1.3" strokeOpacity=".5"/>
      </g>
    </svg>
  );
}

function PlusBadgeIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
      <path d="M12 3v18M3 12h18" stroke="var(--indigo)" strokeWidth="2.6" strokeLinecap="round" strokeOpacity=".8"/>
    </svg>
  );
}

function SmallCapsuleIcon() {
  return (
    <svg width="38" height="38" viewBox="0 0 64 64" fill="none">
      <g transform="rotate(60 32 32)">
        <path d="M14 26h18a8 8 0 0 1 8 8v0a8 8 0 0 1-8 8H14a8 8 0 0 1 0-16Z" fill="var(--amber)" fillOpacity=".8"/>
        <path d="M32 26h18a8 8 0 0 1 0 16H32Z" fill="var(--coral-2)" fillOpacity=".5"/>
      </g>
    </svg>
  );
}

export default function LoginPage() {
  const { login, error: authError, loading } = useAuth();
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<RoleOption>('Reporter');

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: getDemoCredentials('Reporter').email,
      password: getDemoCredentials('Reporter').password,
    },
  });

  const applyRole = (role: RoleOption) => {
    const credentials = getDemoCredentials(role);
    setSelectedRole(role);
    setValue('email', credentials.email, { shouldValidate: true, shouldDirty: true });
    setValue('password', credentials.password, { shouldValidate: true, shouldDirty: true });
  };

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
    <div className="login-page-shell">
      <div className="login-bg-layer" aria-hidden="true">
        <div className="login-grid" />
        <div className="login-orb login-orb-coral" />
        <div className="login-orb login-orb-indigo" />

        {/* Custom pharma SVG drift icons */}
        <div className="drift-icon drift-icon-pill"><CapsuleIcon /></div>
        <div className="drift-icon drift-icon-syringe"><SyringeIcon /></div>
        <div className="drift-icon drift-icon-bottle"><MedicineBottleIcon /></div>
        <div className="drift-icon drift-icon-dropper"><DropperBottleIcon /></div>
        <div className="drift-icon drift-icon-stethoscope"><StethoscopeIcon /></div>
        <div className="drift-icon drift-icon-ampoule"><AmpouleIcon /></div>
        <div className="drift-icon drift-icon-plus"><PlusBadgeIcon /></div>
        <div className="drift-icon drift-icon-capsule"><SmallCapsuleIcon /></div>

        <div className="login-monitor">
          <div className="login-monitor-head">
            <span className="login-monitor-label">CASE MONITOR · LIVE</span>
            <span className="login-monitor-status"><span className="login-monitor-led" /> ACTIVE</span>
          </div>
          <svg width="100%" height="54" viewBox="0 0 320 54" preserveAspectRatio="none" aria-hidden="true">
            <path className="login-monitor-trace" d="M0,30 L60,30 L78,30 L92,8 L106,48 L120,30 L145,30 L205,30 L223,30 L237,8 L251,48 L265,30 L320,30" />
          </svg>
        </div>
      </div>

      <main className="login-stage">
        <section className="login-panel">
          <aside className="login-brand-side">
            <div>
              <div className="login-brand-row">
                <div className="login-brand-mark">Ps</div>
                <div className="login-brand-name">PharmaSafe</div>
              </div>

              <div className="login-tagline">
                Case review, <em>grounded</em> in evidence — not guesswork.
              </div>

              <div className="login-feature-list">
                <div className="login-feature-item">
                  <span className="login-feature-ic">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2v20M2 12h20" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/></svg>
                  </span>
                  Naranjo-scale causality scoring, fully auditable
                </div>
                <div className="login-feature-item">
                  <span className="login-feature-ic">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/><path d="m20 20-3.2-3.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                  </span>
                  Duplicate case detection via semantic search
                </div>
                <div className="login-feature-item">
                  <span className="login-feature-ic">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 12h4l2-7 4 14 2-7h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                  Every AI inference tagged, sourced, reviewable
                </div>
              </div>
            </div>

            <div className="login-brand-foot">
              SNOMED CT coding · PvPI-aligned workflow<br />
              Built on HIPAA / DPDP data-handling principles
            </div>
          </aside>

          <section className="login-form-side">
            <div className="login-form-shell">
              <div className="login-form-header">
                <div className="login-form-kicker">Welcome back</div>
                <p className="login-form-sub">Sign in to continue to your workspace.</p>
              </div>

              <div className="login-role-toggle" role="tablist" aria-label="Select role">
                {ROLE_OPTIONS.map(role => (
                  <button
                    key={role}
                    type="button"
                    className={selectedRole === role ? 'active' : ''}
                    role="tab"
                    aria-selected={selectedRole === role}
                    onClick={() => applyRole(role)}
                  >
                    {role}
                  </button>
                ))}
              </div>

              {authError && (
                <div className="login-error field-error-shake">
                  <AlertCircle size={16} />
                  <span>{authError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)}>
                <div className="field">
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    placeholder="you@organization.in"
                    autoComplete="username"
                    className={errors.email ? 'error' : ''}
                    {...register('email')}
                  />
                  {errors.email && <p className="form-error">{errors.email.message}</p>}
                </div>

                <div className="field">
                  <label htmlFor="pw">Password</label>
                  <input
                    id="pw"
                    type="password"
                    placeholder="••••••••••"
                    autoComplete="current-password"
                    className={errors.password ? 'error' : ''}
                    {...register('password')}
                  />
                  {errors.password && <p className="form-error">{errors.password.message}</p>}
                </div>

                <div className="login-row-between">
                  <label className="login-remember">
                    <input type="checkbox" defaultChecked />
                    <span>Remember me</span>
                  </label>
                  <a href="#" onClick={e => e.preventDefault()}>Forgot password?</a>
                </div>

                <button type="submit" className="signin-btn" disabled={loading}>
                  <LogIn size={16} />
                  <span>{loading ? 'Signing in...' : 'Sign in'}</span>
                </button>
              </form>

              

              <div className="login-credentials">
                {DEMO_CREDENTIALS.map(credential => (
                  <div key={credential.role} className="login-credential-line">
                    <span className="login-credential-role">{credential.role}</span>
                    <span className="mono">{credential.email}</span>
                    <span className="mono">{credential.password}</span>
                  </div>
                ))}
              </div>

              <div className="login-foot-note">
                By continuing you acknowledge PharmaSafe's data-handling notice, including AI-assisted case analysis.
              </div>
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}