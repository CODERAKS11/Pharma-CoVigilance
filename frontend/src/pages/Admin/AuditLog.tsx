import { useState, useMemo, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { AuditTimeline } from '../../components/domain/AuditTimeline';
import type { AuditEntry } from '../../api/types';
import { API_BASE_URL } from '../../config';

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [actorFilter, setActorFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    async function loadAuditLogs() {
      const token = localStorage.getItem('pharmasafe_token');
      try {
        const response = await fetch(`${API_BASE_URL}/cases/audit`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const rawEvents = await response.json();
          const mapped: AuditEntry[] = rawEvents.map((evt: any) => {
            let actorTypeStr: 'System' | 'AI Pipeline' | 'Reviewer' | 'Admin' = 'System';
            if (evt.actor_type === 'ai_pipeline') actorTypeStr = 'AI Pipeline';
            else if (evt.actor_type === 'reviewer') actorTypeStr = 'Reviewer';
            else if (evt.actor_type === 'admin') actorTypeStr = 'Admin';

            return {
              id: evt.id,
              timestamp: evt.created_at,
              actor: evt.actor_id || evt.actor_type || 'System',
              actorType: actorTypeStr,
              action: evt.action.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
              caseId: evt.case_id,
              details: evt.detail ? JSON.stringify(evt.detail) : undefined
            };
          });
          setEntries(mapped);
        }
      } catch (err) {
        console.error('Failed to load audit logs from API:', err);
      }
    }
    loadAuditLogs();
  }, []);

  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      if (actorFilter && entry.actorType !== actorFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!entry.action.toLowerCase().includes(q) && !(entry.caseId || '').toLowerCase().includes(q) && !entry.actor.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (dateFrom) {
        const entryDate = entry.timestamp.split('T')[0];
        if (entryDate < dateFrom) return false;
      }
      if (dateTo) {
        const entryDate = entry.timestamp.split('T')[0];
        if (entryDate > dateTo) return false;
      }
      return true;
    });
  }, [actorFilter, searchQuery, dateFrom, dateTo]);

  const hasFilters = actorFilter || searchQuery || dateFrom || dateTo;

  const clearFilters = () => {
    setActorFilter('');
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>System Audit Log</h2>
        <p>{filteredEntries.length} audit entries</p>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        alignItems: 'center',
        marginBottom: 20,
      }}>
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 280 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-tertiary)' }} />
          <input
            className="form-input"
            style={{ paddingLeft: 32, fontSize: 'var(--text-sm)' }}
            placeholder="Search actions, case IDs..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <select
          className="form-select"
          style={{ width: 'auto', minWidth: 140, fontSize: 'var(--text-sm)' }}
          value={actorFilter}
          onChange={e => setActorFilter(e.target.value)}
        >
          <option value="">All Actor Types</option>
          <option value="System">System</option>
          <option value="AI Pipeline">AI Pipeline</option>
          <option value="Reviewer">Reviewer</option>
          <option value="Admin">Admin</option>
        </select>
        <input
          type="date"
          className="form-input"
          style={{ width: 'auto', fontSize: 'var(--text-sm)' }}
          value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
        />
        <input
          type="date"
          className="form-input"
          style={{ width: 'auto', fontSize: 'var(--text-sm)' }}
          value={dateTo}
          onChange={e => setDateTo(e.target.value)}
        />
        {hasFilters && (
          <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {/* Timeline */}
      <div className="card">
        <div className="card-body">
          {filteredEntries.length === 0 ? (
            <div className="empty-state">
              <h3>No audit entries found</h3>
              <p>Try adjusting your filters to see more results</p>
              {hasFilters && (
                <button className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={clearFilters}>
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <AuditTimeline entries={filteredEntries} showCaseId />
          )}
        </div>
      </div>
    </div>
  );
}
