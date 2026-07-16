import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  accentColor?: string;
}

export function StatCard({ label, value, subtitle, icon, trend, trendLabel, accentColor = 'var(--teal)' }: StatCardProps) {
  return (
    <div className="card" style={{ padding: '20px', position: 'relative', overflow: 'hidden' }}>
      {/* Accent bar top */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        background: accentColor,
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--ink-tertiary)',
            marginBottom: 6,
          }}>
            {label}
          </p>
          <p style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 700,
            color: 'var(--ink)',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '-0.02em',
          }}>
            {value}
          </p>
          {subtitle && (
            <p style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--ink-secondary)',
              marginTop: 4,
            }}>
              {subtitle}
            </p>
          )}
          {trend && trendLabel && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginTop: 8,
              fontSize: 'var(--text-xs)',
              fontWeight: 500,
              color: trend === 'up' ? 'var(--confirmed-green)' : trend === 'down' ? 'var(--error)' : 'var(--ink-tertiary)',
            }}>
              {trend === 'up' ? <TrendingUp size={12} /> : trend === 'down' ? <TrendingDown size={12} /> : <Minus size={12} />}
              {trendLabel}
            </div>
          )}
        </div>
        {icon && (
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 'var(--radius-lg)',
            background: `${accentColor}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: accentColor,
          }}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
