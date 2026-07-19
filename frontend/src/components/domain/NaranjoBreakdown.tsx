import { useState } from 'react';
import { Info } from 'lucide-react';
import { SourceTag } from '../ui/SourceTag';
import type { NaranjoAnswer } from '../../api/types';

interface NaranjoBreakdownProps {
  answers: NaranjoAnswer[];
  totalScore: number;
  onChange?: (answers: NaranjoAnswer[]) => void;
  editable?: boolean;
}

function getQuestionScore(qId: number, answer: 'yes' | 'no' | 'unknown'): number {
  if (answer === 'unknown') return 0;
  if (answer === 'yes') {
    if (qId === 2 || qId === 4) return 2;
    if (qId === 5) return -1;
    if (qId === 6) return -1;
    return 1;
  }
  if (answer === 'no') {
    if (qId === 2 || qId === 4) return -1;
    if (qId === 5) return 2;
    if (qId === 6) return 1;
    return 0;
  }
  return 0;
}

export function NaranjoBreakdown({ answers, totalScore, onChange, editable = false }: NaranjoBreakdownProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const answerColor = (a: string) => {
    if (a === 'yes') return 'var(--confirmed-green)';
    if (a === 'no') return 'var(--error)';
    return 'var(--ink-tertiary)';
  };

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        padding: '0 2px',
      }}>
        <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink)' }}>
          Naranjo Assessment
        </h4>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-md)',
          fontWeight: 700,
          color: 'var(--ink)',
        }}>
          Score: {totalScore}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {answers.map((a, i) => (
          <div
            key={a.questionId}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '8px 10px',
              borderRadius: 'var(--radius-sm)',
              background: i % 2 === 0 ? 'var(--bg-surface)' : 'transparent',
              position: 'relative',
            }}
          >
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              color: 'var(--ink-tertiary)',
              minWidth: 18,
              paddingTop: 1,
            }}>
              Q{a.questionId}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink)', lineHeight: 1.4 }}>
                {a.question}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {editable ? (
                <select
                  value={a.answer}
                  onChange={(e) => {
                    const newAns = e.target.value as 'yes' | 'no' | 'unknown';
                    const newScore = getQuestionScore(a.questionId, newAns);
                    const updated = [...answers];
                    updated[i] = { ...a, answer: newAns, score: newScore };
                    if (onChange) onChange(updated);
                  }}
                  style={{
                    fontSize: 'var(--text-xs)',
                    padding: '2px 4px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-surface)',
                    color: 'var(--ink)',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="yes">YES</option>
                  <option value="no">NO</option>
                  <option value="unknown">UNKNOWN</option>
                </select>
              ) : (
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  color: answerColor(a.answer),
                  textTransform: 'uppercase',
                  minWidth: 48,
                  textAlign: 'center',
                }}>
                  {a.answer}
                </span>
              )}
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                color: 'var(--ink-tertiary)',
                minWidth: 20,
                textAlign: 'right',
              }}>
                {a.score > 0 ? `+${a.score}` : a.score}
              </span>
              <SourceTag source={a.source} />
              {a.source === 'llm_inferred' && a.supportingQuote && (
                <div
                  style={{ position: 'relative', cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                >
                  <Info size={13} style={{ color: 'var(--indigo)' }} />
                  {hoveredIdx === i && (
                    <div style={{
                      position: 'absolute',
                      right: 0,
                      top: '100%',
                      marginTop: 4,
                      width: 280,
                      padding: '10px 12px',
                      background: 'var(--ink)',
                      color: '#fff',
                      fontSize: 'var(--text-xs)',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: 'var(--shadow-lg)',
                      zIndex: 10,
                      lineHeight: 1.5,
                    }}>
                      <p style={{ fontWeight: 600, marginBottom: 4, color: 'var(--indigo-light)' }}>
                        Supporting Evidence ({Math.round((a.confidence || 0) * 100)}% confidence)
                      </p>
                      <p style={{ fontStyle: 'italic' }}>{a.supportingQuote}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
