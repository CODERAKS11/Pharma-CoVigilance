import { useState } from 'react';
import { Download, FileText, CheckCircle } from 'lucide-react';
import { DataTable } from '../../components/ui/DataTable';
import { Badge } from '../../components/ui/Badge';
import { mockExports } from '../../api/mockData';
import { formatDate } from '../../lib/formatters';
import type { ExportRecord } from '../../api/types';

export default function ExportsPage() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === mockExports.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(mockExports.map(e => e.caseId)));
    }
  };

  const handleExport = (format: string, id?: string) => {
    // Simulated download
    alert(`Downloading ${format} export for ${id || `${selectedIds.size} cases`}`);
  };

  const columns = [
    {
      key: 'select',
      header: '',
      width: '40px',
      render: (row: ExportRecord) => (
        <input
          type="checkbox"
          checked={selectedIds.has(row.caseId)}
          onChange={() => toggleSelect(row.caseId)}
          onClick={e => e.stopPropagation()}
          style={{ accentColor: 'var(--teal)' }}
        />
      ),
    },
    {
      key: 'caseNumber',
      header: 'Case ID',
      sortable: true,
      render: (row: ExportRecord) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--teal)' }}>
          {row.caseNumber}
        </span>
      ),
    },
    {
      key: 'drugName',
      header: 'Drug',
      sortable: true,
      render: (row: ExportRecord) => <span style={{ fontWeight: 500 }}>{row.drugName}</span>,
    },
    {
      key: 'adverseEvent',
      header: 'Adverse Event',
      render: (row: ExportRecord) => <span style={{ color: 'var(--ink-secondary)' }}>{row.adverseEvent}</span>,
    },
    {
      key: 'naranjoCategory',
      header: 'Causality',
      render: (row: ExportRecord) => <Badge variant="severity" severity={row.naranjoCategory} />,
    },
    {
      key: 'reviewedAt',
      header: 'Reviewed',
      sortable: true,
      render: (row: ExportRecord) => (
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-secondary)' }}>
          {formatDate(row.reviewedAt)}
        </span>
      ),
    },
    {
      key: 'exportStatus',
      header: 'Export Status',
      render: (row: ExportRecord) => (
        row.exportedAt ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-xs)', color: 'var(--confirmed-green)' }}>
            <CheckCircle size={12} /> Exported {formatDate(row.exportedAt)}
          </span>
        ) : (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-tertiary)' }}>Not exported</span>
        )
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row: ExportRecord) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); handleExport('E2B(R3)', row.caseId); }}>
            <Download size={12} /> E2B
          </button>
          <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); handleExport('PvPI', row.caseId); }}>
            <FileText size={12} /> PvPI
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Export Cases</h2>
          <p>Download reviewed cases in E2B(R3) or PvPI format</p>
        </div>
        {selectedIds.size > 0 && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-primary btn-sm" onClick={() => handleExport('E2B(R3)')}>
              <Download size={14} /> Export {selectedIds.size} as E2B(R3)
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => handleExport('PvPI')}>
              <FileText size={14} /> Export {selectedIds.size} as PvPI
            </button>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 8 }}>
        <label className="checkbox-group" style={{ cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={selectedIds.size === mockExports.length}
            onChange={toggleAll}
          />
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-secondary)' }}>
            Select all ({mockExports.length} cases)
          </span>
        </label>
      </div>

      <DataTable<ExportRecord>
        columns={columns}
        data={mockExports}
        rowKey={r => r.caseId}
        emptyMessage="No reviewed cases available for export"
        emptyDescription="Cases must be reviewed before they can be exported"
      />
    </div>
  );
}
