import { useLang } from '../../i18n';
import { CareJourneySummary } from '../../components/CareJourneySummary';
import { BackLink } from '../../components/Layout';
import { VisitStatusModal } from '../../components/VisitStatusModal';
import { ClinicalHandovers } from '../../components/ClinicalHandovers';
import { RecordedVitals } from '../../components/RecordedVitals';
import { useState } from 'react';
import { Link, useNavigate, useParams, Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { Icon } from '../../components/Icon';
import { listCases, type CaseRecord } from '../../db/repo';
import { useLive } from '../../db/useLive';
import type { CareTier, ReportAttachment } from '../../db/types';
import { ReportAttachmentModal } from '../../components/ReportAttachmentModal';
import { PdfViewerModal } from '../../components/PdfViewerModal';
import { PhysicalExamNotesModal } from '../../components/PhysicalExamNotesModal';
import { TierReferralModal } from '../../components/TierReferralModal';
import { AiSummaryModal } from '../../components/AiSummaryModal';

export function TierModuleView() {
  const { t } = useLang();
  const { tier: tierParam } = useParams<{ tier: CareTier }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const activeTier: CareTier = (tierParam as CareTier) || 'asha';

  const [search, setSearch] = useState('');

  // Modals state
  const [activeCaseForAttachment, setActiveCaseForAttachment] = useState<{ id: string; category: 'general' | 'biopsy' | 'radiology' } | null>(null);
  const [activePdfPreview, setActivePdfPreview] = useState<{ attachment: ReportAttachment; patientName: string; patientId: string } | null>(null);
  const [activeCaseForExam, setActiveCaseForExam] = useState<{ caseRecord: CaseRecord } | null>(null);
  const [activeCaseForReferral, setActiveCaseForReferral] = useState<{ caseRecord: CaseRecord } | null>(null);
  const [visitCase, setVisitCase] = useState<CaseRecord | null>(null);
  const [editReport, setEditReport] = useState<{ id: string; attachment: ReportAttachment } | null>(null);
  const [activeCaseForAi, setActiveCaseForAi] = useState<{ caseRecord: CaseRecord } | null>(null);

  const { data: allCases = [] } = useLive(listCases, []);
  /** Modals hold a snapshot; read the live record so saved summaries show immediately. */
  const freshCase = (record: CaseRecord) => allCases.find(c => c.referral.id === record.referral.id) ?? record;

  // Super admins see every unit in the module; staff retain their assigned access.
  const tierCases = allCases.filter((c) => {
    const t = c.referral.tier || 'asha';
    const u = c.referral.unit || 'a';
    if (t !== activeTier) return false;
    if (user.role !== 'super_admin' && u !== user.unit) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const name = (c.patient.name || '').toLowerCase();
      const id = (c.patient.id || '').toLowerCase();
      return name.includes(q) || id.includes(q);
    }
    return true;
  });

  const tierMeta: Record<CareTier, {
    name: string;
    level: string;
    gradient: string;
    nextTierName?: string;
  }> = {
    asha: {
      name: 'ASHA Grassroots Healthcare',
      level: 'Tier 1 · Community Screening',
      gradient: 'from-teal-500 via-teal-600 to-emerald-600',
      nextTierName: 'PHC',
    },
    phc: {
      name: 'Primary Health Centre (PHC)',
      level: 'Tier 2 · Primary Medical Triage',
      gradient: 'from-sky-500 via-sky-600 to-blue-600',
      nextTierName: 'DH',
    },
    dh: {
      name: 'District Hospital (DH)',
      level: 'Tier 3 · Secondary Diagnostic & Staging',
      gradient: 'from-cyan-600 via-teal-600 to-emerald-600',
      nextTierName: 'TCC',
    },
    tcc: {
      name: 'Tertiary Care Centre (TCC)',
      level: 'Tier 4 · Advanced Oncology & MDT Protocols',
      gradient: 'from-emerald-600 via-teal-700 to-sky-700',
    },
  };

  if (!tierMeta[activeTier]) return <Navigate to="/" replace />;
  const currentMeta = tierMeta[activeTier];

  return (
    <div key={activeTier} className="tier-module space-y-5 max-w-6xl mx-auto pb-12">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <BackLink />
        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
          {t(currentMeta.level)}
        </span>
      </div>

      {/* Module Hero Banner */}
      <div className={`rounded-2xl bg-gradient-to-r ${currentMeta.gradient} text-white p-6 shadow-lg border border-white/10 space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-white/80 block">
              {activeTier.toUpperCase()} {t('OPERATIONAL MODULE')}
            </span>
            <h1 className="text-2xl font-black font-display tracking-tight text-white mt-1">
              {t(currentMeta.name)}
            </h1>
          </div>

          {/* Prominent "+ Add New CBAC Form" button */}
          <button
            type="button"
            onClick={() => navigate(`/cbac?tier=${activeTier}`)}
            className="btn !min-h-[44px] px-4 rounded-xl text-xs sm:text-sm font-bold bg-white text-slate-900 hover:bg-slate-100 shadow-md flex items-center gap-2 active:scale-95 transition-all"
          >
            <Icon name="spark" size={16} className="text-teal-600" />
            <span>{t('+ Add New CBAC Form')}</span>
          </button>
        </div>


      </div>

      <div className="flex justify-end bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        {/* Search */}
        <div className="relative min-w-[220px]">
          <input
            type="text"
            placeholder={t('Search patients...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs rounded-xl border border-slate-200 pl-8 pr-3 py-2 outline-none focus:border-sky-500"
          />
          <div className="absolute left-2.5 top-2.5 text-slate-400">
            <Icon name="spark" size={13} />
          </div>
        </div>
      </div>

      {/* Patient List in this Module */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="font-bold text-slate-900 text-base flex items-center gap-2 font-display">
            <span>{t('Patients at')} {t(currentMeta.name)}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {tierCases.length} {tierCases.length === 1 ? 'case' : 'cases'}
            </span>
          </h2>

          <button
            type="button"
            onClick={() => navigate(`/cbac?tier=${activeTier}`)}
            className="btn btn-primary !min-h-[40px] px-4 text-sm font-bold flex items-center gap-1.5 shadow-xs"
          >
            <Icon name="spark" size={14} />
            <span>{t('+ Add New CBAC Form to this Unit')}</span>
          </button>
        </div>

        {tierCases.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <p className="text-slate-400 text-sm">{t('No patient cases currently in')} {t(currentMeta.name)}.</p>
            <button
              type="button"
              onClick={() => navigate(`/cbac?tier=${activeTier}`)}
              className="btn btn-primary !min-h-[40px] text-xs font-bold"
            >
              {t('+ Create First CBAC Screening for this Unit')}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {tierCases.map((c) => {
              const cbac = c.referral.screening?.cbac;
              const reportsCount = (c.referral.reports?.length || 0) + (c.referral.biopsyReports?.length || 0) + (c.referral.radiologyReports?.length || 0);

              return (
                <div
                  key={c.referral.id}
                  className="rounded-xl border border-slate-200 p-4 bg-slate-50/40 hover:bg-white transition-all space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center text-xs">
                        {c.patient.name ? c.patient.name.charAt(0) : 'P'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Link to={`/case/${c.referral.id}`} className="font-bold text-sm text-slate-900 hover:underline">
                            {c.patient.name}
                          </Link>
                          <span className="text-xs font-mono text-slate-400">({c.patient.id})</span>
                          {c.referral.urgency === 'urgent' && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                              {t('URGENT')}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">
                          {c.patient.age ? `${c.patient.age}y` : ''} · {c.patient.locality || 'Locality unrecorded'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {cbac ? (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${cbac.highRiskNcd ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                          {t('CBAC Score:')} {cbac.partA.totalScore}/12
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                          {t('CBAC Pending')}
                        </span>
                      )}
                      {reportsCount > 0 && (
                        <span className="text-xs font-bold text-sky-800 bg-sky-100 px-2 py-0.5 rounded-md">
                          {reportsCount} {t('PDF Reports')}
                        </span>
                      )}
                    </div>
                  </div>

                  <RecordedVitals exam={c.referral.physicalExam} />
                  <CareJourneySummary record={c} onEditSummary={() => setActiveCaseForAi({ caseRecord: c })} />
                  <ClinicalHandovers handovers={c.referral.clinicalHandovers} />

                  {/* Attached Reports previews */}
                  {reportsCount > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-bold text-slate-400">{t('Reports:')}</span>
                      {[
                        ...(c.referral.reports || []),
                        ...(c.referral.biopsyReports || []),
                        ...(c.referral.radiologyReports || []),
                      ].map((att) => (
                        <button
                          key={att.id}
                          type="button"
                          onClick={() =>
                            setActivePdfPreview({
                              attachment: att,
                              patientName: c.patient.name,
                              patientId: c.patient.id,
                            })
                          }
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100 flex items-center gap-1"
                        >
                          <span className="uppercase text-[9px] font-bold px-1 bg-sky-200 rounded">
                            {att.category}
                          </span>
                          <span className="max-w-[120px] truncate">{att.title}</span>
                          <Icon name="info" size={11} />
                        </button>
                      ))}
                    </div>
                  )}

                  {reportsCount > 0 && <div className="flex flex-wrap gap-2">{[...(c.referral.reports || []), ...(c.referral.biopsyReports || []), ...(c.referral.radiologyReports || [])].map(attachment => <button type="button" key={attachment.id} className="btn btn-secondary !min-h-[34px] px-3 text-xs font-semibold" onClick={() => setEditReport({ id: c.referral.id, attachment })}>{t('✎ Edit')} {attachment.title}</button>)}</div>}
                  <div className="flex flex-wrap items-center gap-3 text-xs"><span>{t('Acceptance:')} {c.referral.worker.facilityResponse ?? c.referral.facility.response}</span><span>{t('Appointment:')} {c.referral.worker.appointmentDate ?? c.referral.facility.appointmentDate ?? 'Not set'}</span><button type="button" className="btn btn-secondary text-xs" onClick={() => setVisitCase(c)}>{t('Acceptance & appointment')}</button><Link className="btn btn-secondary !min-h-[34px] px-3 text-xs font-semibold" to={`/case/${c.referral.id}/edit`}>{t('✎ Edit patient / referral')}</Link></div>
                  {/* Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* CBAC Form */}
                      <Link
                        to={`/case/${c.referral.id}/cbac?tier=${activeTier}&unit=${c.referral.unit || 'a'}`}
                        state={{ returnTo: `/tier/${activeTier}` }}
                        className="btn !min-h-[34px] px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center gap-1"
                      >
                        <Icon name="spark" size={13} className="text-teal-600" />
                        <span>{activeTier === 'asha' ? (cbac ? 'View/Edit CBAC' : 'Conduct CBAC') : 'CBAC Form (editable)'}</span>
                      </Link>

                      {/* Physical Exam Notes */}
                      {activeTier !== 'asha' && (
                        <button
                          type="button"
                          onClick={() => setActiveCaseForExam({ caseRecord: c })}
                          className="btn !min-h-[34px] px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center gap-1"
                        >
                          <Icon name="user" size={13} className="text-sky-600" />
                          <span>{t('Notes (Physical Examination)')}</span>
                        </button>
                      )}

                      {(activeTier === 'dh' || activeTier === 'tcc') && <button type="button" onClick={() => setActiveCaseForExam({ caseRecord: c })} className="btn btn-secondary text-xs !min-h-[34px]">{activeTier.toUpperCase()} {t('Notes')}</button>}
                      {/* PDF Reports Attachments */}
                      {activeTier !== 'asha' && (
                        <div className="flex flex-wrap items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setActiveCaseForAttachment({ id: c.referral.id, category: 'general' })}
                            className="btn !min-h-[34px] px-2 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                          >
                            {t('+ Reports (PDF)')}
                          </button>
                          {(activeTier === 'dh' || activeTier === 'tcc') && (
                            <>
                              <button
                                type="button"
                                onClick={() => setActiveCaseForAttachment({ id: c.referral.id, category: 'biopsy' })}
                                className="btn !min-h-[34px] px-2 py-1 text-[11px] font-semibold rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200"
                              >
                                {t('+ Biopsy Report (PDF)')}
                              </button>
                              <button
                                type="button"
                                onClick={() => setActiveCaseForAttachment({ id: c.referral.id, category: 'radiology' })}
                                className="btn !min-h-[34px] px-2 py-1 text-[11px] font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200"
                              >
                                {t('+ Radiology Report (PDF)')}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* AI Summary */}
                      <button
                        type="button"
                        onClick={() => setActiveCaseForAi({ caseRecord: c })}
                        className="btn !min-h-[34px] px-3 py-1 text-xs font-bold rounded-lg bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-xs flex items-center gap-1"
                      >
                        <Icon name="spark" size={13} />
                        <span>{t('AI Summary')}</span>
                      </button>

                      {/* Refer to Next Tier */}
                      {activeTier !== 'tcc' && (
                        <button
                          type="button"
                          onClick={() => setActiveCaseForReferral({ caseRecord: c })}
                          className="btn !min-h-[34px] px-3 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-1"
                        >
                          <span>
                            {activeTier === 'asha'
                              ? 'Refer to next PHC'
                              : activeTier === 'phc'
                              ? 'Refer to DH'
                              : 'Refer to TCC'}
                          </span>
                          <Icon name="back" size={13} className="rotate-180" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODALS */}
      {visitCase && <VisitStatusModal referral={visitCase.referral} onClose={() => setVisitCase(null)} />}
      {editReport && <ReportAttachmentModal referralId={editReport.id} category={editReport.attachment.category} initialAttachment={editReport.attachment} isOpen onClose={() => setEditReport(null)} />}

      {activeCaseForAttachment && (
        <ReportAttachmentModal
          referralId={activeCaseForAttachment.id}
          category={activeCaseForAttachment.category}
          isOpen={true}
          onClose={() => setActiveCaseForAttachment(null)}
        />
      )}

      {activePdfPreview && (
        <PdfViewerModal
          attachment={activePdfPreview.attachment}
          patientName={activePdfPreview.patientName}
          patientId={activePdfPreview.patientId}
          isOpen={true}
          onClose={() => setActivePdfPreview(null)}
        />
      )}

      {activeCaseForExam && (
        <PhysicalExamNotesModal
          referralId={activeCaseForExam.caseRecord.referral.id}
          tier={activeTier}
          initialExam={activeCaseForExam.caseRecord.referral.physicalExam}
          initialDhNotes={activeCaseForExam.caseRecord.referral.dhNotes}
          initialTccNotes={activeCaseForExam.caseRecord.referral.tccNotes}
          isOpen={true}
          onClose={() => setActiveCaseForExam(null)}
        />
      )}

      {activeCaseForReferral && (
        <TierReferralModal
          referralId={activeCaseForReferral.caseRecord.referral.id}
          patientName={activeCaseForReferral.caseRecord.patient.name}
          currentTier={activeTier}
          savedSummary={freshCase(activeCaseForReferral.caseRecord).referral.aiSummaryOverride}
          onEditSummary={() => setActiveCaseForAi({ caseRecord: freshCase(activeCaseForReferral.caseRecord) })}
          isOpen={true}
          onClose={() => setActiveCaseForReferral(null)}
        />
      )}

      {activeCaseForAi && (
        <AiSummaryModal
          caseRecord={freshCase(activeCaseForAi.caseRecord)}
          viewerTier={activeTier}
          isOpen={true}
          onClose={() => setActiveCaseForAi(null)}
        />
      )}
    </div>
  );
}
