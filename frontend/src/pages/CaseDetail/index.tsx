import { useState, useEffect } from 'react';
import { X, CheckCircle, Edit3, XCircle, FileText, Calendar, User, Pill, AlertTriangle } from 'lucide-react';
import { CausalityDial } from '../../components/domain/CausalityDial';
import { NaranjoBreakdown } from '../../components/domain/NaranjoBreakdown';
import { SnomedCandidateList } from '../../components/domain/SnomedCandidateList';
import { AuditTimeline } from '../../components/domain/AuditTimeline';
import { Badge } from '../../components/ui/Badge';
import { SourceTag } from '../../components/ui/SourceTag';
import { formatDate } from '../../lib/formatters';
import type { CaseRecord, SnomedCandidate, NaranjoAnswer, SeverityCategory, AuditEntry } from '../../api/types';
import { API_BASE_URL } from '../../config';

interface CaseDetailProps {
  caseData: CaseRecord;
  onClose: () => void;
  onActionComplete?: () => void;
}

export default function CaseDetail({ caseData, onClose, onActionComplete }: CaseDetailProps) {
  const [overrideMode, setOverrideMode] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [actionTaken, setActionTaken] = useState<string | null>(null);
  const [auditTrail, setAuditTrail] = useState<AuditEntry[]>([]);

  // Fetch real-time audit trail for this case
  useEffect(() => {
    async function loadCaseAudit() {
      const token = localStorage.getItem('pharmasafe_token');
      try {
        const response = await fetch(`${API_BASE_URL}/cases/${caseData.id}/audit`, {
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
              details: evt.detail
            };
          });
          setAuditTrail(mapped);
        }
      } catch (err) {
        console.error('Failed to load case audit trail:', err);
      }
    }
    loadCaseAudit();
  }, [caseData.id]);

  const duplicateCheckEvent = auditTrail.find(evt => 
    evt.action === 'Duplicate Checked' && (evt.details as any)?.duplicate_found === true
  );

  // Live interactive state variables
  const [seriousness, setSeriousness] = useState<string[]>(caseData.seriousness || []);
  const [snomedCandidates, setSnomedCandidates] = useState<SnomedCandidate[]>(caseData.snomedCandidates || []);
  const [naranjoAnswers, setNaranjoAnswers] = useState<NaranjoAnswer[]>(caseData.naranjoAnswers || []);
  const [naranjoScore, setNaranjoScore] = useState<number>(caseData.naranjoScore || 0);
  const [naranjoCategory, setNaranjoCategory] = useState<SeverityCategory>(caseData.naranjoCategory || 'Doubtful');

  const handleNaranjoChange = (updatedAnswers: NaranjoAnswer[]) => {
    const newScore = updatedAnswers.reduce((sum, a) => sum + a.score, 0);
    let newCategory: SeverityCategory = 'Doubtful';
    if (newScore >= 9) newCategory = 'Definite';
    else if (newScore >= 5) newCategory = 'Probable';
    else if (newScore >= 1) newCategory = 'Possible';

    setNaranjoAnswers(updatedAnswers);
    setNaranjoScore(newScore);
    setNaranjoCategory(newCategory);
    setOverrideMode(true);
  };

  const handleSnomedSelect = (code: string) => {
    const updated = snomedCandidates.map(c => {
      if (c.code === code) {
        return { ...c, selected: !c.selected };
      }
      return c;
    });
    setSnomedCandidates(updated);
    setOverrideMode(true);
  };

  const handleSnomedAdd = (newCandidate: SnomedCandidate) => {
    if (snomedCandidates.some(c => c.code === newCandidate.code)) return;
    setSnomedCandidates([...snomedCandidates, newCandidate]);
    setOverrideMode(true);
  };

  const handleAction = async (action: 'confirm' | 'override' | 'reject') => {
    const token = localStorage.getItem('pharmasafe_token');
    
    if (action === 'confirm' || action === 'override') {
      try {
        const response = await fetch(`${API_BASE_URL}/cases/${caseData.id}/review/confirm`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            seriousness: seriousness,
            snomedCandidates: snomedCandidates,
            naranjoAnswers: naranjoAnswers,
            overrideReason: action === 'override' ? overrideReason : undefined
          })
        });

        if (response.ok) {
          setActionTaken(action);
          setTimeout(() => {
            setActionTaken(null);
            if (onActionComplete) onActionComplete();
            onClose();
          }, 2000);
        } else {
          const errData = await response.json();
          alert(`Failed to save case review: ${errData.error || 'Server error'}`);
        }
      } catch (err) {
        console.error('Failed to submit case review:', err);
      }
    } else if (action === 'reject') {
      try {
        const response = await fetch(`${API_BASE_URL}/cases/${caseData.id}/review/reject`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          setActionTaken(action);
          setTimeout(() => {
            setActionTaken(null);
            if (onActionComplete) onActionComplete();
            onClose();
          }, 2000);
        } else {
          const errData = await response.json();
          alert(`Failed to reject case: ${errData.error || 'Server error'}`);
        }
      } catch (err) {
        console.error('Failed to reject case:', err);
      }
    }
    
    if (action !== 'override') {
      setOverrideMode(false);
      setOverrideReason('');
    }
  };

  const isEditable = caseData.status !== 'reviewed' && caseData.status !== 'closed' && caseData.status !== 'exported';

  return (
    <div style={{ padding: '0' }}>
      {/* Header */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-md)',
            fontWeight: 700,
            color: 'var(--teal)',
          }}>
            {caseData.caseNumber}
          </span>
          <Badge variant="status" status={caseData.status} />
          <Badge variant="priority" priority={caseData.priority} />
        </div>
        <button className="btn btn-ghost btn-icon" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      {/* Toast notification for actions */}
      {actionTaken && (
        <div style={{
          margin: '12px 24px 0',
          padding: '10px 14px',
          borderRadius: 'var(--radius-md)',
          background: actionTaken === 'reject' ? 'var(--error-bg)' : 'var(--confirmed-green-bg)',
          color: actionTaken === 'reject' ? 'var(--error)' : 'var(--confirmed-green)',
          fontSize: 'var(--text-sm)',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <CheckCircle size={14} />
          {actionTaken === 'confirm' && 'Case confirmed — no changes needed'}
          {actionTaken === 'override' && 'Override submitted successfully'}
          {actionTaken === 'reject' && 'Case rejected — returned to queue'}
        </div>
      )}

      {/* Potential Duplicate Warning */}
      {duplicateCheckEvent && (
        <div style={{
          margin: '12px 24px 0',
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--severity-high-bg)',
          border: '1px solid var(--severity-high)',
          color: 'var(--severity-high)',
          fontSize: 'var(--text-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
            <AlertTriangle size={16} />
            POTENTIAL DUPLICATE DETECTED
          </div>
          <p style={{ margin: 0, color: 'var(--ink)', fontSize: 'var(--text-xs)', lineHeight: 1.5 }}>
            This report is semantically identical (cosine similarity &gt; 85%) to existing Case{' '}
            <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--teal)' }}>
              #{(duplicateCheckEvent.details as any)?.duplicate_case_id?.substring(0, 8).toUpperCase()}
            </strong>.
          </p>
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 320px',
        gap: 0,
      }}>
        {/* Left column */}
        <div style={{ padding: '20px 24px', borderRight: '1px solid var(--border)' }}>
          {/* Narrative */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileText size={15} /> Clinical Narrative
              </h3>
            </div>
            <div className="card-body">
              <p style={{
                fontSize: 'var(--text-sm)',
                lineHeight: 1.7,
                color: 'var(--ink)',
              }}>
                {caseData.narrative}
              </p>
            </div>
          </div>

          {/* Naranjo Breakdown */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-body">
              <NaranjoBreakdown
                answers={naranjoAnswers}
                totalScore={naranjoScore}
                editable={isEditable}
                onChange={handleNaranjoChange}
              />
            </div>
          </div>

          {/* SNOMED Candidates */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-body">
              <SnomedCandidateList
                candidates={snomedCandidates}
                editable={isEditable}
                onSelect={handleSnomedSelect}
                onAddCandidate={handleSnomedAdd}
              />
            </div>
          </div>

          {/* Audit Trail */}
          <div className="card">
            <div className="card-header">
              <h3>Audit Trail</h3>
            </div>
            <div className="card-body">
              <AuditTimeline entries={auditTrail.length > 0 ? auditTrail : caseData.auditTrail} />
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={{ padding: '20px 20px', background: 'var(--bg-surface)' }}>
          {/* Causality Dial */}
          <div style={{ marginBottom: 20 }}>
            <CausalityDial
              score={naranjoScore}
              category={naranjoCategory}
              size={200}
            />
          </div>

          {/* Case Fields */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-body" style={{ padding: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <Pill size={13} style={{ color: 'var(--ink-tertiary)' }} />
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-tertiary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>Drug</span>
                    <SourceTag source="structured_field" />
                  </div>
                  <p style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--ink)' }}>{caseData.drugName}</p>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-secondary)' }}>{caseData.drugDosage}</p>
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <AlertTriangle size={13} style={{ color: 'var(--ink-tertiary)' }} />
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-tertiary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>Adverse Event</span>
                    <SourceTag source="llm_inferred" />
                  </div>
                  <p style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--ink)' }}>{caseData.adverseEvent}</p>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-secondary)' }}>{caseData.indication}</p>
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <User size={13} style={{ color: 'var(--ink-tertiary)' }} />
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-tertiary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>Patient</span>
                    <SourceTag source="structured_field" />
                  </div>
                  <p style={{ fontSize: 'var(--text-md)', fontWeight: 500, color: 'var(--ink)' }}>
                    {caseData.patientAge} years, {caseData.patientSex}
                  </p>
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <Calendar size={13} style={{ color: 'var(--ink-tertiary)' }} />
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-tertiary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>Timeline</span>
                  </div>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink)' }}>
                    Onset: <span style={{ fontWeight: 500 }}>{formatDate(caseData.onsetDate)}</span>
                  </p>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink)' }}>
                    Reported: <span style={{ fontWeight: 500 }}>{formatDate(caseData.reportDate)}</span>
                  </p>
                </div>

                <div>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-tertiary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>Seriousness</span>
                  {isEditable ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                      {(['hospitalization', 'life_threatening', 'disability'] as const).map(flag => (
                        <label key={flag} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={seriousness.includes(flag)}
                            onChange={(e) => {
                              const updated = e.target.checked
                                ? [...seriousness, flag]
                                : seriousness.filter(s => s !== flag);
                              setSeriousness(updated);
                              setOverrideMode(true);
                            }}
                            style={{ accentColor: 'var(--teal)' }}
                          />
                          <span style={{ textTransform: 'capitalize' }}>{flag.replace('_', ' ')}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                      {seriousness.map(s => (
                        <Badge key={s} variant="custom" label={s.replace('_', ' ')} color="var(--severity-definite)" bgColor="var(--severity-definite-bg)" />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Reviewer Actions */}
          {isEditable && (
            <div className="card">
              <div className="card-header">
                <h3 style={{ fontSize: 'var(--text-sm)' }}>Reviewer Actions</h3>
              </div>
              <div className="card-body" style={{ padding: 16 }}>
                {overrideMode ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <p style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>Override Reason <span style={{ color: 'var(--error)' }}>*</span></p>
                    <textarea
                      className="form-textarea"
                      placeholder="Provide a reason for the override (stored in audit trail)..."
                      value={overrideReason}
                      onChange={e => setOverrideReason(e.target.value)}
                      style={{ minHeight: 70 }}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => handleAction('override')} disabled={!overrideReason.trim()}>
                        Submit Override
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setOverrideMode(false); setOverrideReason(''); }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button className="btn btn-success" style={{ width: '100%' }} onClick={() => handleAction('confirm')}>
                      <CheckCircle size={15} /> Confirm Assessment
                    </button>
                    <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setOverrideMode(true)}>
                      <Edit3 size={15} /> Override
                    </button>
                    <button className="btn btn-ghost" style={{ width: '100%', color: 'var(--error)' }} onClick={() => handleAction('reject')}>
                      <XCircle size={15} /> Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {caseData.status === 'reviewed' && caseData.assignedReviewer && (
            <div style={{
              padding: '12px 16px',
              background: 'var(--confirmed-green-bg)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
              color: 'var(--confirmed-green)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <CheckCircle size={14} />
              Reviewed by {caseData.assignedReviewer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
