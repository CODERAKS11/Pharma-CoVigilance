import { useState } from 'react';
import { Search, X, Filter } from 'lucide-react';
import type { CaseStatus, Priority } from '../../api/types';

interface FilterBarProps {
  onFilterChange: (filters: FilterState) => void;
  showDrugFilter?: boolean;
  showStatusFilter?: boolean;
  showPriorityFilter?: boolean;
  showDateFilter?: boolean;
  showSearch?: boolean;
  searchPlaceholder?: string;
}

export interface FilterState {
  search: string;
  status: CaseStatus | '';
  priority: Priority | '';
  dateFrom: string;
  dateTo: string;
}

const STATUS_OPTIONS: { value: CaseStatus | ''; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'new', label: 'New' },
  { value: 'intake', label: 'Intake' },
  { value: 'processing', label: 'Processing' },
  { value: 'triaged', label: 'Triaged' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'needs_review', label: 'Needs Review' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'closed', label: 'Closed' },
  { value: 'exported', label: 'Exported' },
  { value: 'rejected', label: 'Rejected' },
];

const PRIORITY_OPTIONS: { value: Priority | ''; label: string }[] = [
  { value: '', label: 'All Priorities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export function FilterBar({
  onFilterChange,
  showStatusFilter = true,
  showPriorityFilter = true,
  showDateFilter = true,
  showSearch = true,
  searchPlaceholder = 'Search cases...',
}: FilterBarProps) {
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    status: '',
    priority: '',
    dateFrom: '',
    dateTo: '',
  });

  const updateFilter = (key: keyof FilterState, value: string) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    onFilterChange(next);
  };

  const clearFilters = () => {
    const empty: FilterState = { search: '', status: '', priority: '', dateFrom: '', dateTo: '' };
    setFilters(empty);
    onFilterChange(empty);
  };

  const hasActiveFilters = filters.search || filters.status || filters.priority || filters.dateFrom || filters.dateTo;

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8,
      alignItems: 'center',
      marginBottom: 16,
    }}>
      <Filter size={15} style={{ color: 'var(--ink-tertiary)' }} />
      {showSearch && (
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 280 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-tertiary)' }} />
          <input
            className="form-input"
            style={{ paddingLeft: 32, fontSize: 'var(--text-sm)' }}
            placeholder={searchPlaceholder}
            value={filters.search}
            onChange={e => updateFilter('search', e.target.value)}
          />
        </div>
      )}
      {showStatusFilter && (
        <select
          className="form-select"
          style={{ width: 'auto', minWidth: 130, fontSize: 'var(--text-sm)' }}
          value={filters.status}
          onChange={e => updateFilter('status', e.target.value)}
        >
          {STATUS_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
      {showPriorityFilter && (
        <select
          className="form-select"
          style={{ width: 'auto', minWidth: 130, fontSize: 'var(--text-sm)' }}
          value={filters.priority}
          onChange={e => updateFilter('priority', e.target.value)}
        >
          {PRIORITY_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
      {showDateFilter && (
        <>
          <input
            type="date"
            className="form-input"
            style={{ width: 'auto', fontSize: 'var(--text-sm)' }}
            value={filters.dateFrom}
            onChange={e => updateFilter('dateFrom', e.target.value)}
            placeholder="From"
          />
          <input
            type="date"
            className="form-input"
            style={{ width: 'auto', fontSize: 'var(--text-sm)' }}
            value={filters.dateTo}
            onChange={e => updateFilter('dateTo', e.target.value)}
            placeholder="To"
          />
        </>
      )}
      {hasActiveFilters && (
        <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
          <X size={14} /> Clear
        </button>
      )}
    </div>
  );
}
