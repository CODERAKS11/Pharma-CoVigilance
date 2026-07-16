import { Bot, User, Settings, Shield } from 'lucide-react';
import { formatDateTime } from '../../lib/formatters';
import type { AuditEntry } from '../../api/types';

interface AuditTimelineProps {
  entries: AuditEntry[];
  showCaseId?: boolean;
}

const ACTOR_ICON: Record<string, React.ReactNode> = {
  System: <Settings size={14} />,
  'AI Pipeline': <Bot size={14} />,
  Reviewer: <User size={14} />,
  Admin: <Shield size={14} />,
};

export function AuditTimeline({ entries, showCaseId = false }: AuditTimelineProps) {
  if (entries.length === 0) {
    return (
      <div className="empty-state" style={{ padding: '24px 16px' }}>
        <p>No audit entries yet</p>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', paddingLeft: 20 }}>
      {/* Timeline line */}
      <div style={{
        position: 'absolute',
        left: 8,
        top: 4,
        bottom: 4,
        width: 2,
        background: 'var(--border)',
      }} />

      {entries.map((entry, i) => {
        const isAI = entry.actorType === 'AI Pipeline';
        const isSystem = entry.actorType === 'System';

        return (
          <div key={entry.id || i} style={{
            position: 'relative',
            paddingBottom: i < entries.length - 1 ? 16 : 0,
            paddingLeft: 16,
          }}>
            {/* Timeline dot */}
            <div style={{
              position: 'absolute',
              left: -14,
              top: 3,
              width: 12,
              height: 12,
              borderRadius: 'var(--radius-full)',
              background: isAI ? 'var(--indigo)' : isSystem ? 'var(--ink-tertiary)' : 'var(--teal)',
              border: '2px solid var(--bg-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }} />

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  color: isAI ? 'var(--indigo)' : isSystem ? 'var(--ink-tertiary)' : 'var(--teal)',
                }}>
                  {ACTOR_ICON[entry.actorType]}
                  {entry.actor}
                </span>
                {showCaseId && entry.caseId && (
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--ink-tertiary)',
                    background: 'var(--bg-surface-hover)',
                    padding: '1px 6px',
                    borderRadius: 'var(--radius-sm)',
                  }}>
                    {entry.caseId}
                  </span>
                )}
                <span style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--ink-tertiary)',
                  marginLeft: 'auto',
                }}>
                  {formatDateTime(entry.timestamp)}
                </span>
              </div>
              <p style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--ink)',
                lineHeight: 1.4,
              }}>
                {entry.action}
              </p>
              {entry.details && (
                <p style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--ink-secondary)',
                  marginTop: 2,
                  fontStyle: 'italic',
                }}>
                  {entry.details}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
