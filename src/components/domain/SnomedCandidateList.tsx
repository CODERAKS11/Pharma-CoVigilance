import { useState } from 'react';
import { Search, Check } from 'lucide-react';
import { SourceTag } from '../ui/SourceTag';
import type { SnomedCandidate } from '../../api/types';

interface SnomedCandidateListProps {
  candidates: SnomedCandidate[];
  onSelect?: (candidate: SnomedCandidate) => void;
}

export function SnomedCandidateList({ candidates, onSelect }: SnomedCandidateListProps) {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
      }}>
        <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink)' }}>
          SNOMED CT Candidates
        </h4>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setShowSearch(!showSearch)}
        >
          <Search size={13} /> Override
        </button>
      </div>

      {showSearch && (
        <div style={{ marginBottom: 10 }}>
          <input
            className="form-input"
            style={{ fontSize: 'var(--text-sm)' }}
            placeholder="Search SNOMED CT codes..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            autoFocus
          />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {candidates.map(c => (
          <div
            key={c.code}
            onClick={() => onSelect?.(c)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${c.selected ? 'var(--teal)' : 'var(--border)'}`,
              background: c.selected ? 'var(--teal-muted)' : 'var(--bg-surface)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            <div style={{
              width: 20,
              height: 20,
              borderRadius: 'var(--radius-full)',
              border: `2px solid ${c.selected ? 'var(--teal)' : 'var(--border-strong)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              background: c.selected ? 'var(--teal)' : 'transparent',
            }}>
              {c.selected && <Check size={12} color="#fff" />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--ink-secondary)',
                }}>
                  {c.code}
                </span>
                <SourceTag source={c.source} />
              </div>
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--ink)' }}>
                {c.term}
              </p>
            </div>
            <div style={{ flexShrink: 0, width: 80 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 3,
              }}>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  color: c.confidence >= 0.8 ? 'var(--confirmed-green)' : c.confidence >= 0.5 ? 'var(--severity-possible)' : 'var(--ink-tertiary)',
                }}>
                  {Math.round(c.confidence * 100)}%
                </span>
              </div>
              <div style={{
                height: 4,
                borderRadius: 'var(--radius-full)',
                background: 'var(--border)',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${c.confidence * 100}%`,
                  borderRadius: 'var(--radius-full)',
                  background: c.confidence >= 0.8 ? 'var(--confirmed-green)' : c.confidence >= 0.5 ? 'var(--severity-possible)' : 'var(--ink-tertiary)',
                  transition: 'width var(--transition-base)',
                }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
