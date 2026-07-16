import { useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

interface ConsentNoticeProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
}

export function ConsentNotice({ checked, onChange, error }: ConsentNoticeProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      border: `1px solid ${error ? 'var(--error)' : 'var(--border)'}`,
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      background: 'var(--bg-surface)',
    }}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: '12px 16px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-sm)',
          fontWeight: 600,
          color: 'var(--ink)',
          textAlign: 'left',
        }}
      >
        <AlertTriangle size={16} style={{ color: 'var(--warning)', flexShrink: 0 }} />
        <span style={{ flex: 1 }}>Data Processing & AI Analysis Notice</span>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {expanded && (
        <div style={{
          padding: '0 16px 12px',
          fontSize: 'var(--text-sm)',
          color: 'var(--ink-secondary)',
          lineHeight: 1.6,
          borderTop: '1px solid var(--border)',
          paddingTop: 12,
        }}>
          <p style={{ marginBottom: 8 }}>
            By submitting this adverse event report, you acknowledge that:
          </p>
          <ul style={{ paddingLeft: 20, marginBottom: 8 }}>
            <li>The data provided will be processed in accordance with applicable pharmacovigilance regulations and data protection laws.</li>
            <li>AI-assisted analysis, including natural language processing and automated causality assessment (Naranjo algorithm), will be applied to this report.</li>
            <li>All AI-derived assessments are subject to mandatory human review by qualified pharmacovigilance professionals before any regulatory submission.</li>
            <li>The submitted data may be included in aggregate safety analyses and signal detection processes.</li>
            <li>Personal health information will be handled in compliance with HIPAA, GDPR, and relevant local regulations.</li>
          </ul>
          <p>
            No clinical decisions will be made solely based on automated analysis. A qualified reviewer will evaluate all aspects of this case.
          </p>
        </div>
      )}

      <div style={{
        padding: '10px 16px',
        borderTop: expanded ? '1px solid var(--border)' : 'none',
        background: error ? 'var(--error-bg)' : 'transparent',
      }}>
        <label className="checkbox-group" style={{ cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={checked}
            onChange={e => onChange(e.target.checked)}
          />
          <span style={{
            fontSize: 'var(--text-sm)',
            color: error ? 'var(--error)' : 'var(--ink)',
          }}>
            I acknowledge the data processing notice and consent to AI-assisted analysis
          </span>
        </label>
        {error && (
          <p className="form-error" style={{ marginTop: 4 }}>{error}</p>
        )}
      </div>
    </div>
  );
}
