import type { SeverityCategory, CaseStatus, Priority, SourceType } from '../api/types';

/* ── Date Formatters ────────────────────────────── */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* ── Score / Category Helpers ───────────────────── */
export function naranjoCategory(score: number): SeverityCategory {
  if (score >= 9) return 'Definite';
  if (score >= 5) return 'Probable';
  if (score >= 1) return 'Possible';
  return 'Doubtful';
}

export function severityColor(cat: SeverityCategory): string {
  const map: Record<SeverityCategory, string> = {
    Definite: 'var(--severity-definite)',
    Probable: 'var(--severity-probable)',
    Possible: 'var(--severity-possible)',
    Doubtful: 'var(--severity-doubtful)',
  };
  return map[cat];
}

export function severityBgColor(cat: SeverityCategory): string {
  const map: Record<SeverityCategory, string> = {
    Definite: 'var(--severity-definite-bg)',
    Probable: 'var(--severity-probable-bg)',
    Possible: 'var(--severity-possible-bg)',
    Doubtful: 'var(--severity-doubtful-bg)',
  };
  return map[cat];
}

export function statusColor(status: CaseStatus): { bg: string; text: string } {
  const map: Record<CaseStatus, { bg: string; text: string }> = {
    new: { bg: 'var(--indigo-muted)', text: 'var(--indigo)' },
    processing: { bg: 'var(--warning-bg)', text: 'var(--warning)' },
    triaged: { bg: 'var(--teal-muted)', text: 'var(--teal)' },
    under_review: { bg: 'var(--severity-probable-bg)', text: 'var(--severity-probable)' },
    reviewed: { bg: 'var(--confirmed-green-bg)', text: 'var(--confirmed-green)' },
    closed: { bg: 'var(--severity-doubtful-bg)', text: 'var(--severity-doubtful)' },
  };
  return map[status];
}

export function statusLabel(status: CaseStatus): string {
  const map: Record<CaseStatus, string> = {
    new: 'New',
    processing: 'Processing',
    triaged: 'Triaged',
    under_review: 'Under Review',
    reviewed: 'Reviewed',
    closed: 'Closed',
  };
  return map[status];
}

export function priorityColor(p: Priority): { bg: string; text: string } {
  const map: Record<Priority, { bg: string; text: string }> = {
    critical: { bg: 'var(--severity-definite-bg)', text: 'var(--severity-definite)' },
    high: { bg: 'var(--severity-probable-bg)', text: 'var(--severity-probable)' },
    medium: { bg: 'var(--severity-possible-bg)', text: 'var(--severity-possible)' },
    low: { bg: 'var(--severity-doubtful-bg)', text: 'var(--severity-doubtful)' },
  };
  return map[p];
}

export function sourceLabel(source: SourceType): string {
  const map: Record<SourceType, string> = {
    structured_field: 'Structured',
    llm_inferred: 'AI Inferred',
    reviewer_confirmed: 'Confirmed',
  };
  return map[source];
}

export function sourceIcon(source: SourceType): string {
  const map: Record<SourceType, string> = {
    structured_field: '◆',
    llm_inferred: '◇',
    reviewer_confirmed: '✓',
  };
  return map[source];
}
