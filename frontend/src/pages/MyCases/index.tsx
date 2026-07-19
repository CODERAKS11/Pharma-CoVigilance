import { useEffect, useMemo, useState } from 'react';
import { Clock, FileText, RefreshCw, CheckCircle2, Activity, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../../styles/queue.css';
import { DataTable } from '../../components/ui/DataTable';
import { Badge } from '../../components/ui/Badge';
import { FilterBar, type FilterState } from '../../components/ui/FilterBar';
import { StatCard } from '../../components/ui/StatCard';
import { formatDate, formatTimeAgo } from '../../lib/formatters';
import type { CaseRecord } from '../../api/types';
import { API_BASE_URL } from '../../config';
import { useAuth } from '../../api/auth';

function mapBackendCase(c: any): CaseRecord {
  return {
    id: c.id,
    caseNumber: c.id.substring(0, 8).toUpperCase(),
    status: c.status || 'new',
    priority: c.priority || 'low',
    patientAge: c.patient?.age || 35,
    patientSex: c.patient?.sex === 'male' ? 'Male' : (c.patient?.sex === 'female' ? 'Female' : 'Other'),
    drugName: c.drug?.name || 'Unknown drug',
    drugDosage: c.dosage || 'N/A',
    indication: 'Reported adverse event',
    adverseEvent: c.narrative ? `${c.narrative.substring(0, 70)}${c.narrative.length > 70 ? '...' : ''}` : 'Adverse event',
    narrative: c.narrative || '',
    seriousness: [
      c.hospitalization && 'hospitalization',
      c.life_threatening && 'life_threatening',
      c.disability && 'disability'
    ].filter(Boolean) as any[],
    onsetDate: c.onset_date || new Date().toISOString(),
    reportDate: c.created_at || new Date().toISOString(),
    reporterType: c.reporter_type || 'healthcare_professional',
    naranjoScore: c.naranjo_score || 0,
    naranjoCategory: c.naranjo_category || 'Doubtful',
    naranjoAnswers: c.naranjo_answers || [],
    snomedCandidates: c.snomed_candidates || [],
    auditTrail: [],
    createdAt: c.created_at || new Date().toISOString(),
    updatedAt: c.updated_at || c.created_at || new Date().toISOString(),
  };
}

export default function MyCasesPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>({ search: '', status: '', priority: '', dateFrom: '', dateTo: '' });
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  async function loadCases() {
    setLoading(true);
    const token = localStorage.getItem('pharmasafe_token');

    try {
      const response = await fetch(`${API_BASE_URL}/cases`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        logout();
        navigate('/login', { replace: true });
        return;
      }

      if (response.ok) {
        const raw = await response.json();
        const rawList = Array.isArray(raw) ? raw : (raw.cases || []);
        setCases(rawList.map(mapBackendCase));
      }
    } catch (err) {
      console.error('Failed to load submitted cases:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCases();
  }, []);

  const filteredCases = useMemo(() => {
    return cases.filter(c => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!c.caseNumber.toLowerCase().includes(q) && !c.drugName.toLowerCase().includes(q) && !c.adverseEvent.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (filters.status && c.status !== filters.status) return false;
      if (filters.priority && c.priority !== filters.priority) return false;
      if (filters.dateFrom && c.reportDate < filters.dateFrom) return false;
      if (filters.dateTo && c.reportDate > filters.dateTo) return false;
      return true;
    });
  }, [filters, cases]);

  const selectedCase = selectedCaseId ? cases.find(c => c.id === selectedCaseId) || null : null;

  const caseStats = useMemo(() => {
    const activeStatuses = new Set(['intake', 'processing', 'triaged', 'needs_review', 'under_review']);
    return {
      total: cases.length,
      active: cases.filter(c => activeStatuses.has(c.status)).length,
      reviewed: cases.filter(c => c.status === 'reviewed' || c.status === 'exported').length,
      lastUpdated: cases.length > 0 ? cases.reduce((latest, current) => (current.updatedAt > latest ? current.updatedAt : latest), cases[0].updatedAt) : null,
    };
  }, [cases]);

  const columns = [
    {
      key: 'caseNumber',
      header: 'Case ID',
      sortable: true,
      sticky: true,
      width: '140px',
      render: (row: CaseRecord) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--teal)' }}>
          {row.caseNumber}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row: CaseRecord) => <Badge variant="status" status={row.status} />,
    },
    {
      key: 'priority',
      header: 'Priority',
      sortable: true,
      render: (row: CaseRecord) => <Badge variant="priority" priority={row.priority} />,
    },
    {
      key: 'drugName',
      header: 'Drug',
      sortable: true,
      render: (row: CaseRecord) => <span style={{ fontWeight: 500 }}>{row.drugName}</span>,
    },
    {
      key: 'reportDate',
      header: 'Submitted',
      sortable: true,
      render: (row: CaseRecord) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--ink-secondary)', fontSize: 'var(--text-sm)' }}>
          <Clock size={12} />
          <span title={formatDate(row.reportDate)}>{formatTimeAgo(row.createdAt)}</span>
        </div>
      ),
    },
    {
      key: 'updatedAt',
      header: 'Last Update',
      sortable: true,
      render: (row: CaseRecord) => (
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-secondary)' }} title={formatDate(row.updatedAt)}>
          {formatTimeAgo(row.updatedAt)}
        </span>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>My Submitted Cases</h2>
        <p>Track the current status of the cases you have submitted</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
        <StatCard label="Total Submissions" value={caseStats.total} icon={<FileText size={18} />} accentColor="var(--teal)" />
        <StatCard label="In Progress" value={caseStats.active} icon={<Activity size={18} />} accentColor="var(--severity-probable)" />
        <StatCard label="Reviewed / Exported" value={caseStats.reviewed} icon={<CheckCircle2 size={18} />} accentColor="var(--confirmed-green)" />
        <StatCard
          label="Last Updated"
          value={caseStats.lastUpdated ? formatTimeAgo(caseStats.lastUpdated) : 'N/A'}
          icon={<RefreshCw size={18} />}
          subtitle={caseStats.lastUpdated ? formatDate(caseStats.lastUpdated) : 'No submissions yet'}
          accentColor="var(--indigo)"
        />
      </div>

      <FilterBar
        onFilterChange={setFilters}
        searchPlaceholder="Search your cases by ID or drug..."
        showPriorityFilter
        showStatusFilter
        showDateFilter
        showSearch
      />

      <DataTable<CaseRecord>
        columns={columns}
        data={filteredCases}
        rowKey={r => r.id}
        onRowClick={row => setSelectedCaseId(row.id)}
        highlightedRow={selectedCaseId || undefined}
        loading={loading}
        emptyMessage="No submitted cases found"
        emptyDescription="Cases you submit will appear here with their current status and latest update."
      />

      <div className={`detail-panel-overlay ${selectedCase ? 'open' : ''}`} onClick={() => setSelectedCaseId(null)} />
      <div className={`detail-panel ${selectedCase ? 'open' : ''}`}>
        {selectedCase && (
          <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--teal)' }}>{selectedCase.caseNumber}</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-secondary)' }}>Submitted case details</div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setSelectedCaseId(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-body" style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Badge variant="status" status={selectedCase.status} />
                  <Badge variant="priority" priority={selectedCase.priority} />
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>Drug</div>
                  <div style={{ fontWeight: 600 }}>{selectedCase.drugName}</div>
                  <div style={{ color: 'var(--ink-secondary)', fontSize: 'var(--text-sm)' }}>{selectedCase.drugDosage}</div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>Narrative Preview</div>
                  <div style={{ color: 'var(--ink)', lineHeight: 1.6 }}>{selectedCase.adverseEvent}</div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>Timeline</div>
                  <div style={{ color: 'var(--ink-secondary)', fontSize: 'var(--text-sm)' }}>Submitted: {formatDate(selectedCase.reportDate)}</div>
                  <div style={{ color: 'var(--ink-secondary)', fontSize: 'var(--text-sm)' }}>Updated: {formatDate(selectedCase.updatedAt)}</div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-tertiary)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>What this means</div>
                <div style={{ color: 'var(--ink-secondary)', lineHeight: 1.6, fontSize: 'var(--text-sm)' }}>
                  This view shows the cases you submitted and their current processing state. As reviewers update a case, the status here will change from intake to processing, triaged, reviewed, exported, or rejected.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}