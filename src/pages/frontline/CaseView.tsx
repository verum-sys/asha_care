import { CareJourneySummary } from '../../components/CareJourneySummary';
import { ATTENDANCE_LABELS, VisitStatusModal } from '../../components/VisitStatusModal';
import { ClinicalHandovers } from '../../components/ClinicalHandovers';
import { RecordedVitals } from '../../components/RecordedVitals';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CbacScreening } from './CbacScreening';
import { BackLink } from '../../components/Layout';
import { Icon } from '../../components/Icon';
import { Timeline } from '../../components/Timeline';
import { getCase, listSyncEvents } from '../../db/repo';
import { ashaNoteLines } from '../../intelligence/ashaNote';
import { useLive } from '../../db/useLive';
import { useLang, useTermTier } from '../../i18n';
import type { CareTier, ReportAttachment } from '../../db/types';
import { ReportAttachmentModal } from '../../components/ReportAttachmentModal';
import { PdfViewerModal } from '../../components/PdfViewerModal';
import { PhysicalExamNotesModal } from '../../components/PhysicalExamNotesModal';
import { TierReferralModal } from '../../components/TierReferralModal';
import { AiSummaryModal, buildSummary } from '../../components/AiSummaryModal';

export function CaseView() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // The tier looking at the case (from the list it was opened in); defaults to the tier that holds it now.
  const viewParam = params.get('tier');
  const viewTier = (['asha', 'phc', 'dh', 'tcc'] as const).find(tier => tier === viewParam);
  const { t, formatDate } = useLang();

  // Modals
  const [attachmentCat, setAttachmentCat] = useState<'general' | 'biopsy' | 'radiology' | null>(null);
  const [previewPdf, setPreviewPdf] = useState<ReportAttachment | null>(null);
  const [showExamModal, setShowExamModal] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [editReport, setEditReport] = useState<ReportAttachment | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);

  const { data, loading } = useLive(async () => {
    const [c, syncEvents] = await Promise.all([getCase(id), listSyncEvents()]);
    return c ? { ...c, syncEvents } : null;
  }, [id]);

  useTermTier(viewTier || data?.referral.tier || 'asha');
  if (loading) return <p className="text-muted">…</p>;
  if (!data)
    return (
      <div>
        <BackLink />
        <p className="card">{t('case.notFound')}</p>
      </div>
    );

  const { patient, referral, followUps, facilityEvents, syncEvents } = data;

  const currentTier: CareTier = viewTier || referral.tier || 'asha';
  // Already handed to the next tier: the referring team only records follow-ups now.
  const alreadyReferred = (referral.tier || 'asha') !== currentTier;
  const currentUnit = referral.unit || 'a';
  // Once referred, the case belongs to the next tier; the referring team goes back to its own list (replacing this page).
  const backToTierList = () => navigate(`/tier/${currentTier}`, { replace: true, state: { toast: 'status.savedLocally' } });
  const reportsCount = (referral.reports?.length || 0) + (referral.biopsyReports?.length || 0) + (referral.radiologyReports?.length || 0);


  // At ASHA the case page is the CBAC form itself: sections A-D and referral, editable in place.
  if (currentTier === 'asha') {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <BackLink />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              to={`/case/${referral.id}/follow-up`}
              className="btn !min-h-[36px] px-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-1.5"
            >
              <span>{t('Record follow-up')}</span>
            </Link>
            {!alreadyReferred && (
              <button
                type="button"
                onClick={() => setShowReferralModal(true)}
                className="btn !min-h-[36px] px-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-1.5"
              >
                <span>{t('Refer to PHC')}</span>
                <Icon name="back" size={14} className="rotate-180" />
              </button>
            )}
          </div>
        </div>
        <CbacScreening embedded />
        <section className="card space-y-2">
          <h2 className="text-lg font-bold flex items-center gap-2"><Icon name="user" size={20} className="text-sky-600" /><span>{t('Notes (ASHA Worker)')}</span></h2>
          <p className="text-sm text-slate-700">{ashaNoteLines(data, t, formatDate).join(' ')}</p>
        </section>
        <section className="card">
          <h2 className="mb-3 text-lg font-bold">{t('case.timeline')}</h2>
          <Timeline referral={referral} followUps={followUps} facilityEvents={facilityEvents} syncEvents={syncEvents} />
        </section>
        {!alreadyReferred && <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowReferralModal(true)}
            className="btn !min-h-[36px] px-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-1.5"
          >
            <span>{t('Refer to PHC')}</span>
            <Icon name="back" size={14} className="rotate-180" />
          </button>
        </div>}
        {showReferralModal && (
          <TierReferralModal referralId={referral.id} patientName={patient.name?.trim() || t('Community member')} currentTier={currentTier} savedSummary={referral.aiSummaryOverride} aiSummary={buildSummary(data).text} physicalExam={referral.physicalExam} onEditSummary={() => setShowAiModal(true)} isOpen onClose={() => setShowReferralModal(false)} onReferred={backToTierList} />
        )}
        {showAiModal && <AiSummaryModal caseRecord={data} isOpen onClose={() => setShowAiModal(false)} />}
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BackLink />
        {/* AI Summary and Referral Buttons in top bar */}
        <div className="flex items-center gap-2">
          {currentTier !== 'tcc' && !alreadyReferred && (
            <button
              type="button"
              onClick={() => setShowReferralModal(true)}
              className="btn !min-h-[36px] px-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-1.5"
            >
              <span>
                {currentTier === 'phc' ? 'Refer to DH' : 'Refer to TCC'}
              </span>
              <Icon name="back" size={14} className="rotate-180" />
            </button>
          )}
        </div>
      </div>

      {/* One form layout for every tier: sections A-D and referral, editable in place. */}
      <CbacScreening embedded tier={currentTier} />

      <CareJourneySummary record={data} />
      <ClinicalHandovers handovers={referral.clinicalHandovers} />

      <div className="card flex flex-wrap items-center justify-between gap-2 text-sm"><span>{t('Appointment:')} <strong>{referral.worker.appointmentDate ?? referral.facility.appointmentDate ?? t('Not set')}</strong> <span className="text-muted">· {t('Attendance')}:</span> <strong>{t(ATTENDANCE_LABELS[referral.worker.attendance ?? referral.facility.attendance])}</strong></span><button type="button" className="btn btn-secondary text-xs" onClick={() => setShowVisitModal(true)}>{t('Record attendance')}</button></div>
      {/* Notes (Physical Examination) Section */}
      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Icon name="user" size={20} className="text-sky-600" />
            <span>{t('Notes (Physical Examination)')}</span>
          </h2>
          <button
            type="button"
            onClick={() => setShowExamModal(true)}
            className="btn btn-secondary !min-h-[36px] !px-3 text-xs sm:text-sm font-semibold flex items-center gap-1"
          >
            <span>{referral.physicalExam ? 'Edit Physical Exam' : '+ Record Physical Exam'}</span>
          </button>
        </div>

        {referral.physicalExam ? (
          <div className="space-y-3 text-xs sm:text-sm">
            <RecordedVitals exam={referral.physicalExam} />

            {/* Findings list */}
            <div className="space-y-1.5 text-xs text-slate-700">
              {referral.physicalExam.generalFindings && (
                <p><strong>{t('General Examination:')}</strong> {referral.physicalExam.generalFindings}</p>
              )}
              {referral.physicalExam.systemicExam && (
                <p><strong>{t('Systemic Examination:')}</strong> {referral.physicalExam.systemicExam}</p>
              )}
              {referral.physicalExam.oralCavityFindings && (
                <p><strong>{t('Oral Cavity:')}</strong> {referral.physicalExam.oralCavityFindings}</p>
              )}
              {referral.physicalExam.breastExamFindings && (
                <p><strong>{t('Breast / Cervical:')}</strong> {referral.physicalExam.breastExamFindings}</p>
              )}
              {referral.physicalExam.recordedBy && (
                <p className="text-[11px] text-slate-400 pt-1">{t('Recorded by:')} {referral.physicalExam.recordedBy}</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs sm:text-sm text-muted">
            {t('No physical examination recorded yet. Click above to log vitals, systemic, and local examination findings.')}
          </p>
        )}
      </section>

      {/* Reports (PDF File Attachments) Section */}
      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Icon name="info" size={20} className="text-indigo-600" />
              <span>{t('Diagnostic Reports (PDF Attachments)')}</span>
            </h2>
            <p className="text-xs text-slate-500">{t('General lab, Biopsy (histopathology), and Radiology imaging reports')}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setAttachmentCat('general')}
              className="btn btn-secondary !min-h-[34px] !px-2.5 text-xs font-semibold"
            >
              {t('+ Lab PDF')}
            </button>
            <button
              type="button"
              onClick={() => setAttachmentCat('biopsy')}
              className="btn btn-secondary !min-h-[34px] !px-2.5 text-xs font-semibold text-amber-800 bg-amber-50"
            >
              {t('+ Biopsy PDF')}
            </button>
            <button
              type="button"
              onClick={() => setAttachmentCat('radiology')}
              className="btn btn-secondary !min-h-[34px] !px-2.5 text-xs font-semibold text-indigo-800 bg-indigo-50"
            >
              {t('+ Radiology PDF')}
            </button>
          </div>
        </div>

        {reportsCount > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {[
              ...(referral.reports || []),
              ...(referral.biopsyReports || []),
              ...(referral.radiologyReports || []),
            ].map((att) => (
              <div
                key={att.id}
                onClick={() => setPreviewPdf(att)}
                className="p-3 rounded-xl border border-slate-200 hover:border-sky-400 hover:bg-sky-50/40 cursor-pointer transition-all flex items-start justify-between gap-2"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                      att.category === 'biopsy' ? 'bg-amber-100 text-amber-800' :
                      att.category === 'radiology' ? 'bg-indigo-100 text-indigo-800' :
                      'bg-sky-100 text-sky-800'
                    }`}>
                      {att.category}
                    </span>
                    <span className="text-xs text-slate-400">{att.fileSize}</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{att.title}</h4>
                  <p className="text-[11px] text-slate-500 line-clamp-2">{att.findings || att.fileName}</p>
                </div>
                <div className="text-sky-600 text-xs font-bold shrink-0 mt-1">
                  <button type="button" className="btn btn-secondary !min-h-[30px] px-3 text-xs font-semibold mr-3" onClick={event => { event.stopPropagation(); setEditReport(att); }}>{t('✎ Edit report')}</button>{t('View PDF →')}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs sm:text-sm text-muted">
            {t('No diagnostic PDF reports attached yet. Use the buttons above to attach General Lab, Biopsy, or Radiology reports.')}
          </p>
        )}
      </section>

      {/* Tier Specific Notes (DH Notes / TCC Notes) */}
      {(referral.dhNotes || referral.tccNotes) && (
        <section className="card space-y-3">
          <h2 className="text-lg font-bold">{t('Specialist Tier Notes')}</h2>
          {referral.dhNotes && (
            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 space-y-1">
              <span className="text-xs font-bold text-amber-900 uppercase">{t('District Hospital (DH) Notes')}</span>
              <p className="text-xs text-amber-950 whitespace-pre-wrap">{referral.dhNotes}</p>
            </div>
          )}
          {referral.tccNotes && (
            <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200 space-y-1">
              <span className="text-xs font-bold text-rose-900 uppercase">{t('Tertiary Care Centre (TCC) Notes')}</span>
              <p className="text-xs text-rose-950 whitespace-pre-wrap">{referral.tccNotes}</p>
            </div>
          )}
        </section>
      )}

      {/* Follow-up Action Link */}
      <Link to={`/case/${referral.id}/follow-up`} className="btn btn-primary btn-block !min-h-[52px] text-base font-bold shadow-md" role="button">
        {t('case.recordFollowUp')}
      </Link>

      {/* Timeline */}
      <section className="card">
        <h2 className="mb-3 text-lg font-bold">{t('case.timeline')}</h2>
        <Timeline referral={referral} followUps={followUps} facilityEvents={facilityEvents} syncEvents={syncEvents} />
      </section>

      {/* MODALS */}
      {showVisitModal && <VisitStatusModal referral={referral} onClose={() => setShowVisitModal(false)} />}
      {editReport && <ReportAttachmentModal referralId={referral.id} category={editReport.category} initialAttachment={editReport} isOpen onClose={() => setEditReport(null)} />}

      {attachmentCat && (
        <ReportAttachmentModal
          referralId={referral.id}
          category={attachmentCat}
          isOpen={true}
          onClose={() => setAttachmentCat(null)}
        />
      )}

      {previewPdf && (
        <PdfViewerModal
          attachment={previewPdf}
          patientName={patient.name?.trim() || t('Community member')}
          patientId={patient.id}
          isOpen={true}
          onClose={() => setPreviewPdf(null)}
        />
      )}

      {showExamModal && (
        <PhysicalExamNotesModal
          referralId={referral.id}
          tier={currentTier}
          initialExam={referral.physicalExam}
          initialDhNotes={referral.dhNotes}
          initialTccNotes={referral.tccNotes}
          isOpen={true}
          onClose={() => setShowExamModal(false)}
        />
      )}

      {showReferralModal && (
        <TierReferralModal
          referralId={referral.id}
          patientName={patient.name?.trim() || t('Community member')}
          currentTier={currentTier}
          savedSummary={referral.aiSummaryOverride}
          physicalExam={referral.physicalExam}
          onEditSummary={() => setShowAiModal(true)}
          isOpen={true}
          onClose={() => setShowReferralModal(false)}
          onReferred={backToTierList}
        />
      )}

      {showAiModal && (
        <AiSummaryModal
          caseRecord={data}
          viewerTier={currentTier}
          isOpen={true}
          onClose={() => setShowAiModal(false)}
        />
      )}
    </div>
  );
}
