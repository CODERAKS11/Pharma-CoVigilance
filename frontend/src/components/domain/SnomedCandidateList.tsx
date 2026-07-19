import { useState, useEffect } from 'react';
import { Search, Check, Plus } from 'lucide-react';
import { SourceTag } from '../ui/SourceTag';
import type { SnomedCandidate } from '../../api/types';
import { API_BASE_URL } from '../../config';

interface SnomedCandidateListProps {
  candidates: SnomedCandidate[];
  onSelect?: (code: string) => void;
  onAddCandidate?: (candidate: SnomedCandidate) => void;
  editable?: boolean;
}

export function SnomedCandidateList({ candidates, onSelect, onAddCandidate, editable = false }: SnomedCandidateListProps) {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SnomedCandidate[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('pharmasafe_token');
        const res = await fetch(`${API_BASE_URL}/cases/snomed/search?q=${encodeURIComponent(searchQuery)}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      } catch (err) {
        console.error('Failed to search SNOMED:', err);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

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
        {editable && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowSearch(!showSearch)}
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <Search size={13} /> Add Candidate
          </button>
        )}
      </div>

      {showSearch && (
        <div style={{ marginBottom: 10, position: 'relative' }}>
          <input
            className="form-input"
            style={{ fontSize: 'var(--text-sm)' }}
            placeholder="Search SNOMED CT codes..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            autoFocus
          />
          {loading && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-secondary)', marginTop: 4 }}>Searching...</div>}
          
          {searchResults.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-md)',
              zIndex: 50,
              maxHeight: 200,
              overflowY: 'auto',
              marginTop: 4
            }}>
              {searchResults.map(result => (
                <div
                  key={result.code}
                  onClick={() => {
                    if (onAddCandidate) {
                      onAddCandidate({ ...result, selected: true, source: 'reviewer_confirmed' });
                    }
                    setSearchQuery('');
                    setSearchResults([]);
                    setShowSearch(false);
                  }}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid var(--border-light)'
                  }}
                >
                  <div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-tertiary)', fontFamily: 'var(--font-mono)' }}>{result.code}</div>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{result.term}</div>
                  </div>
                  <Plus size={14} style={{ color: 'var(--teal)' }} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {candidates.map(c => (
          <div
            key={c.code}
            onClick={() => {
              if (editable && onSelect) {
                onSelect(c.code);
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${c.selected ? 'var(--teal)' : 'var(--border)'}`,
              background: c.selected ? 'var(--teal-muted)' : 'var(--bg-surface)',
              cursor: editable ? 'pointer' : 'default',
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
