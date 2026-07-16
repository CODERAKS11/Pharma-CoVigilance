import type { SeverityCategory, CaseStatus, Priority, SourceType } from '../../api/types';
import { severityColor, severityBgColor, statusColor, statusLabel, priorityColor } from '../../lib/formatters';

type BadgeVariant = 'severity' | 'status' | 'priority' | 'source' | 'custom';

interface BadgeProps {
  variant: BadgeVariant;
  severity?: SeverityCategory;
  status?: CaseStatus;
  priority?: Priority;
  source?: SourceType;
  label?: string;
  color?: string;
  bgColor?: string;
  icon?: React.ReactNode;
  size?: 'sm' | 'md';
}

export function Badge({ variant, severity, status, priority, source, label, color, bgColor, icon, size = 'sm' }: BadgeProps) {
  let displayLabel = label || '';
  let displayColor = color || 'var(--ink-secondary)';
  let displayBg = bgColor || 'var(--bg-surface-hover)';

  if (variant === 'severity' && severity) {
    displayLabel = severity;
    displayColor = severityColor(severity);
    displayBg = severityBgColor(severity);
  } else if (variant === 'status' && status) {
    const c = statusColor(status);
    displayLabel = statusLabel(status);
    displayColor = c.text;
    displayBg = c.bg;
  } else if (variant === 'priority' && priority) {
    const c = priorityColor(priority);
    displayLabel = priority.charAt(0).toUpperCase() + priority.slice(1);
    displayColor = c.text;
    displayBg = c.bg;
  } else if (variant === 'source' && source) {
    if (source === 'llm_inferred') {
      displayLabel = 'AI Inferred';
      displayColor = 'var(--indigo)';
      displayBg = 'var(--indigo-muted)';
    } else if (source === 'reviewer_confirmed') {
      displayLabel = 'Confirmed';
      displayColor = 'var(--confirmed-green)';
      displayBg = 'var(--confirmed-green-bg)';
    } else {
      displayLabel = 'Structured';
      displayColor = 'var(--teal)';
      displayBg = 'var(--teal-muted)';
    }
  }

  const sizeStyles = size === 'sm'
    ? { fontSize: 'var(--text-xs)', padding: '2px 8px' }
    : { fontSize: 'var(--text-sm)', padding: '3px 10px' };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        borderRadius: 'var(--radius-full)',
        fontWeight: 500,
        fontFamily: 'var(--font-sans)',
        whiteSpace: 'nowrap',
        color: displayColor,
        background: displayBg,
        lineHeight: 1.4,
        ...sizeStyles,
      }}
    >
      {icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
      {displayLabel}
    </span>
  );
}
