import { useState, useMemo } from 'react';
import { Clock } from 'lucide-react';
import '../../styles/queue.css';
import { DataTable } from '../../components/ui/DataTable';
import { Badge } from '../../components/ui/Badge';
import { FilterBar, type FilterState } from '../../components/ui/FilterBar';
import { mockCases } from '../../api/mockData';
import { formatDate, formatTimeAgo } from '../../lib/formatters';
import type { CaseRecord } from '../../api/types';
import CaseDetail from '../CaseDetail';

export default function QueuePage() {
  const [filters, setFilters] = useState<FilterState>({ search: '', status: '', priority: '', dateFrom: '', dateTo: '' });
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  const filteredCases = useMemo(() => {
    return mockCases.filter(c => {
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
  }, [filters]);

  const selectedCase = selectedCaseId ? mockCases.find(c => c.id === selectedCaseId) || null : null;

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
          />
        )}
      </div>
    </div>
  );
}
