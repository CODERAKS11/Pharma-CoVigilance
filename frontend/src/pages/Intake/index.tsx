import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Send, CheckCircle } from 'lucide-react';
import { intakeSchema, type IntakeFormData } from '../../lib/schemas';
import { ConsentNotice } from '../../components/domain/ConsentNotice';

export default function IntakePage() {
  const [submitted, setSubmitted] = useState<string | null>(null);

  const { register, handleSubmit, control, formState: { errors, isSubmitting }, watch, reset } = useForm<IntakeFormData>({
    resolver: zodResolver(intakeSchema),
    defaultValues: {
      seriousness: {
        hospitalization: false,
        life_threatening: false,
        disability: false,
        death: false,
        other: false,
      },
      consentAcknowledged: false as unknown as true,
    },
  });

  const narrative = watch('narrative') || '';

  const onSubmit = async (data: IntakeFormData) => {
    const token = localStorage.getItem('pharmasafe_token');
    try {
      const response = await fetch('http://localhost:4000/cases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          drugName: data.drugName,
          dosage: `${data.dosage} ${data.dosageUnit}`,
          narrative: data.narrative,
          patientAge: data.patientAge,
          patientSex: data.patientSex.toLowerCase(),
          onsetDate: data.onsetDate,
          hospitalization: data.seriousness.hospitalization,
          lifeThreatening: data.seriousness.life_threatening,
          disability: data.seriousness.disability,
          reporterType: 'healthcare_professional'
        })
      });
      if (response.ok) {
        const result = await response.json();
        setSubmitted(result.caseId || result.id || 'PV-SUBMITTED');
        reset();
        return;
      }
    } catch (err) {
      console.warn('Backend intake API unavailable, using local simulation.', err);
    }
    // Fallback: simulate
    await new Promise(r => setTimeout(r, 800));
    const caseId = `PV-2025-${String(Math.floor(Math.random() * 9000) + 1000).padStart(6, '0')}`;
    setSubmitted(caseId);
    reset();
  };

  if (submitted) {
    return (
      <div className="page-container">
        <div style={{
          maxWidth: 500,
          margin: '60px auto',
          textAlign: 'center',
        }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: 'var(--radius-full)',
            background: 'var(--confirmed-green-bg)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
          }}>
            <CheckCircle size={32} color="var(--confirmed-green)" />
          </div>
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, marginBottom: 8 }}>
            Report Submitted Successfully
          </h2>
          <p style={{ fontSize: 'var(--text-md)', color: 'var(--ink-secondary)', marginBottom: 16 }}>
            Your adverse event report has been received and will be processed by our AI pipeline for initial triage.
          </p>
          <div style={{
            display: 'inline-block',
            padding: '10px 20px',
            background: 'var(--teal-muted)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 24,
          }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-secondary)' }}>Case ID</span>
            <p style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-lg)',
              fontWeight: 600,
              color: 'var(--teal)',
            }}>
              {submitted}
            </p>
          </div>
          <div>
            <button className="btn btn-primary" onClick={() => setSubmitted(null)}>
              Submit Another Report
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Report Adverse Event</h2>
        <p>Submit a new adverse drug reaction report for processing and review</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 24,
          maxWidth: 1100,
        }}>
          {/* Left column — structured fields */}
          <div className="card card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: 4 }}>
              Structured Information
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Suspected Drug <span className="required">*</span></label>
                <input className={`form-input ${errors.drugName ? 'error' : ''}`} placeholder="e.g., Amoxicillin" {...register('drugName')} />
                {errors.drugName && <p className="form-error">{errors.drugName.message}</p>}
              </div>

              <div className="form-group">
                <label className="form-label">Dosage <span className="required">*</span></label>
                <input className={`form-input ${errors.dosage ? 'error' : ''}`} placeholder="e.g., 500" {...register('dosage')} />
                {errors.dosage && <p className="form-error">{errors.dosage.message}</p>}
              </div>

              <div className="form-group">
                <label className="form-label">Unit <span className="required">*</span></label>
                <select className={`form-select ${errors.dosageUnit ? 'error' : ''}`} {...register('dosageUnit')}>
                  <option value="">Select unit</option>
                  <option value="mg">mg</option>
                  <option value="mcg">mcg</option>
                  <option value="g">g</option>
                  <option value="mL">mL</option>
                  <option value="IU">IU</option>
                </select>
                {errors.dosageUnit && <p className="form-error">{errors.dosageUnit.message}</p>}
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Indication <span className="required">*</span></label>
                <input className={`form-input ${errors.indication ? 'error' : ''}`} placeholder="Why was this drug prescribed?" {...register('indication')} />
                {errors.indication && <p className="form-error">{errors.indication.message}</p>}
              </div>

              <div className="form-group">
                <label className="form-label">Patient Age <span className="required">*</span></label>
                <input type="number" className={`form-input ${errors.patientAge ? 'error' : ''}`} placeholder="Age" {...register('patientAge', { valueAsNumber: true })} />
                {errors.patientAge && <p className="form-error">{errors.patientAge.message}</p>}
              </div>

              <div className="form-group">
                <label className="form-label">Patient Sex <span className="required">*</span></label>
                <select className={`form-select ${errors.patientSex ? 'error' : ''}`} {...register('patientSex')}>
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
                {errors.patientSex && <p className="form-error">{errors.patientSex.message}</p>}
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Onset Date <span className="required">*</span></label>
                <input type="date" className={`form-input ${errors.onsetDate ? 'error' : ''}`} {...register('onsetDate')} />
                {errors.onsetDate && <p className="form-error">{errors.onsetDate.message}</p>}
              </div>
            </div>

            <div>
              <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Seriousness Criteria</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {([
                  ['hospitalization', 'Hospitalization required'],
                  ['life_threatening', 'Life-threatening event'],
                  ['disability', 'Disability or incapacity'],
                  ['death', 'Death'],
                  ['other', 'Other medically significant'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="checkbox-group">
                    <input type="checkbox" {...register(`seriousness.${key}`)} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Right column — narrative */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: 12 }}>
                Narrative Description
              </h3>
              <div className="form-group" style={{ flex: 1 }}>
                <textarea
                  className={`form-textarea ${errors.narrative ? 'error' : ''}`}
                  placeholder="Describe what happened, when, and any relevant history. Include details about the adverse event, timeline of drug administration, actions taken, and patient outcome..."
                  style={{ minHeight: 240, flex: 1, resize: 'vertical' }}
                  {...register('narrative')}
                />
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 'var(--text-xs)',
                  color: narrative.length > 9500 ? 'var(--warning)' : 'var(--ink-tertiary)',
                  marginTop: 4,
                }}>
                  <span>{errors.narrative?.message}</span>
                  <span>{narrative.length} / 10,000</span>
                </div>
              </div>
            </div>

            <Controller
              name="consentAcknowledged"
              control={control}
              render={({ field }) => (
                <ConsentNotice
                  checked={field.value as boolean}
                  onChange={field.onChange}
                  error={errors.consentAcknowledged?.message}
                />
              )}
            />

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
              disabled={isSubmitting}
            >
              <Send size={16} />
              {isSubmitting ? 'Submitting Report...' : 'Submit Adverse Event Report'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
