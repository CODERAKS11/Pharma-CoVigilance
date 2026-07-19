import { useState, useMemo, useEffect } from 'react';
import { Clock } from 'lucide-react';
import '../../styles/queue.css';
import { DataTable } from '../../components/ui/DataTable';
import { Badge } from '../../components/ui/Badge';
import { FilterBar, type FilterState } from '../../components/ui/FilterBar';
import { formatDate, formatTimeAgo } from '../../lib/formatters';
import type { CaseRecord } from '../../api/types';
import CaseDetail from '../CaseDetail';
import { API_BASE_URL } from '../../config';

export default function QueuePage() {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [filters, setFilters] = useState<FilterState>({ search: '', status: '', priority: '', dateFrom: '', dateTo: '' });
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  async function loadCases() {
    const token = localStorage.getItem('pharmasafe_token');
    try {
      const response = await fetch(`${API_BASE_URL}/cases`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const raw = await response.json();
        // Extract the cases array from backend wrapper response { cases, page, pageSize }
        const rawList = Array.isArray(raw) ? raw : (raw.cases || []);

        const mapped: CaseRecord[] = rawList.map((c: any) => {
          return {
            id: c.id,
            caseNumber: c.id.substring(0, 8).toUpperCase(),
            status: c.status || 'new',
            priority: c.priority || 'low',
            patientAge: c.patient?.age || 35,
            patientSex: c.patient?.sex === 'male' ? 'Male' : (c.patient?.sex === 'female' ? 'Female' : 'Other'),
            drugName: c.drug?.name || 'METFORMIN',
            drugDosage: c.dosage || '10mg',
            indication: 'Adverse Drug Reaction Triage',
            adverseEvent: c.narrative ? c.narrative.substring(0, 50) + '...' : 'Adverse event',
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
            createdAt: c.created_at,
            updatedAt: c.updated_at
          };
        });
        setCases(mapped);
      }
    } catch (err) {
      console.error('Failed to load cases from API:', err);
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
      render: (row: CaseRecord) => (
        <span style={{ fontWeight: 500 }}>{row.drugName}</span>
      ),
    },
    {
      key: 'adverseEvent',
      header: 'Adverse Event',
      render: (row: CaseRecord) => (
        <span style={{ color: 'var(--ink-secondary)' }}>{row.adverseEvent}</span>
      ),
    },
    {
      key: 'naranjoScore',
      header: 'Naranjo',
      sortable: true,
      width: '100px',
      render: (row: CaseRecord) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{row.naranjoScore}</span>
          <Badge variant="severity" severity={row.naranjoCategory} />
        </div>
      ),
    },
    {
      key: 'patientAge',
      header: 'Patient',
      render: (row: CaseRecord) => (
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-secondary)' }}>
          {row.patientAge}{row.patientSex.charAt(0)} 
        </span>
      ),
    },
    {
      key: 'reportDate',
      header: 'Reported',
      sortable: true,
      render: (row: CaseRecord) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--ink-secondary)', fontSize: 'var(--text-sm)' }}>
          <Clock size={12} />
          <span title={formatDate(row.reportDate)}>{formatTimeAgo(row.createdAt)}</span>
        </div>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Case Queue</h2>
        <p>{filteredCases.length} case{filteredCases.length !== 1 ? 's' : ''} in queue</p>
      </div>

      <FilterBar
        onFilterChange={setFilters}
        searchPlaceholder="Search by case ID, drug, or event..."
      />

      <DataTable<CaseRecord>
        columns={columns}
        data={filteredCases}
        rowKey={r => r.id}
        onRowClick={row => setSelectedCaseId(row.id)}
        highlightedRow={selectedCaseId || undefined}
        emptyMessage="No cases match these filters"
        emptyDescription="Try adjusting your search or filter criteria to find cases"
      />

      {/* Detail panel overlay */}
      <div
        className={`detail-panel-overlay ${selectedCase ? 'open' : ''}`}
        onClick={() => setSelectedCaseId(null)}
      />
      <div className={`detail-panel ${selectedCase ? 'open' : ''}`}>
        {selectedCase && (
          <CaseDetail
            caseData={selectedCase}
            onClose={() => setSelectedCaseId(null)}
            onActionComplete={loadCases}
          />
        )}
      </div>
    </div>
  );
}
