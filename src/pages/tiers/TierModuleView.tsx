import { useLang, useTermTier } from '../../i18n';
import { CareJourneySummary } from '../../components/CareJourneySummary';
import { BackLink } from '../../components/Layout';
import { ATTENDANCE_LABELS, VisitStatusModal } from '../../components/VisitStatusModal';
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
import { MoreMenu, type BarAction } from '../../components/MoreMenu';
import { NEXT_TIER, primaryCaseAction } from '../../intelligence/caseActions';
import { ashaAppointment, ashaNoteLines } from '../../intelligence/ashaNote';
import { TierReferralModal } from '../../components/TierReferralModal';
import { AiSummaryModal } from '../../components/AiSummaryModal';

/** ASHA follows the date TCC sent back; other tiers use the appointment at their own stage. */
const appointmentFor = (c: CaseRecord, tier: CareTier) => (tier === 'asha' ? ashaAppointment(c.referral) : c.referral.worker.appointmentDate ?? c.referral.facility.appointmentDate);

const URGENCY_RANK: Record<string, number> = { urgent: 0, soon: 1, routine: 2 };

/** Nearest upcoming appointment first, then past appointments (most recent first), then none; ties go to the more urgent referral. */
function byAppointmentThenUrgency(tier: CareTier) {
  const today = new Date().toISOString().slice(0, 10);
  const rank = (c: CaseRecord) => {
    const date = (appointmentFor(c, tier) ?? '').slice(0, 10);
    if (!date) return { group: 2, key: 0 };
    const time = Date.parse(date);
    return date >= today ? { group: 0, key: time } : { group: 1, key: -time };
  };
  return (a: CaseRecord, b: CaseRecord) => {
    const x = rank(a), y = rank(b);
    return x.group - y.group || x.key - y.key || (URGENCY_RANK[a.referral.urgency] ?? 3) - (URGENCY_RANK[b.referral.urgency] ?? 3);
  };
}

export function TierModuleView() {
  const { t, formatDate } = useLang();
  const { tier: tierParam } = useParams<{ tier: CareTier }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const activeTier: CareTier = (tierParam as CareTier) || 'asha';
  useTermTier(activeTier);

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
    // A tier keeps the cases it referred onward, so it can still record follow-ups and see the appointment.
    if (t !== activeTier && !c.referral.clinicalHandovers?.some(h => h.fromTier === activeTier)) return false;
    if (user.role !== 'super_admin' && u !== user.unit) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const name = (c.patient.name || '').toLowerCase();
      const id = (c.patient.id || '').toLowerCase();
      return name.includes(q) || id.includes(q);
    }
    return true;
  }).sort(byAppointmentThenUrgency(activeTier));

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

  /** One main action per card, picked from the case state; everything else goes in More. */
  function cardActionsFor(c: CaseRecord): { primary: BarAction; more: BarAction[] } {
    const holder = c.referral.tier || 'asha';
    const canAct = holder === activeTier;
    const hasCbac = !!c.referral.screening?.cbac;
    const openCase: BarAction = {
      key: 'open',
      label: activeTier === 'asha' ? (hasCbac ? t('CBAC View / Edit') : t('Conduct CBAC')) : t('CBAC Form'),
      onClick: () => navigate(hasCbac || activeTier !== 'asha' ? `/case/${c.referral.id}?tier=${activeTier}` : `/case/${c.referral.id}/cbac?tier=asha&unit=${c.referral.unit || 'a'}`, { state: { returnTo: `/tier/${activeTier}` } }),
    };
    const followUp: BarAction = { key: 'followUp', label: t('Record follow-up'), onClick: () => navigate(`/case/${c.referral.id}/follow-up`, { state: { returnTo: `/tier/${activeTier}` } }) };
    const attendance: BarAction | undefined = activeTier !== 'asha' && canAct ? { key: 'attendance', label: t('Record attendance'), onClick: () => setVisitCase(c) } : undefined;
    const refer: BarAction | undefined = activeTier !== 'asha' && NEXT_TIER[activeTier] && canAct ? { key: 'refer', label: activeTier === 'phc' ? t('Refer to DH') : t('Refer to TCC'), onClick: () => setActiveCaseForReferral({ caseRecord: c }) } : undefined;
    let primary: BarAction;
    if (activeTier === 'asha') primary = hasCbac && !canAct ? followUp : openCase;
    else {
      const wanted = primaryCaseAction({ viewTier: activeTier, holderTier: holder, attendance: c.referral.worker.attendance ?? c.referral.facility.attendance });
      primary = (wanted === 'refer' ? refer : wanted === 'attendance' ? attendance : followUp) ?? openCase;
    }
    const extras: BarAction[] = activeTier === 'asha' ? [followUp] : [
      { key: 'exam', label: t('Add Notes'), onClick: () => setActiveCaseForExam({ caseRecord: c }) },
      { key: 'lab', label: t('+ Reports (PDF)'), onClick: () => setActiveCaseForAttachment({ id: c.referral.id, category: 'general' }) },
      ...(activeTier === 'dh' || activeTier === 'tcc' ? [
        { key: 'biopsy', label: t('+ Biopsy Report (PDF)'), onClick: () => setActiveCaseForAttachment({ id: c.referral.id, category: 'biopsy' }) },
        { key: 'radiology', label: t('+ Radiology Report (PDF)'), onClick: () => setActiveCaseForAttachment({ id: c.referral.id, category: 'radiology' }) },
      ] : []),
      followUp,
      ...(attendance ? [attendance] : []),
      ...(refer ? [refer] : []),
      openCase,
    ];
    const more = extras.filter(action => action.key !== primary.key);
    if (activeTier === 'asha' && primary.key !== 'open') more.unshift(openCase);
    return { primary, more };
  }

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
            <div className="relative mt-2 w-full min-w-0 sm:w-[360px]">
              <input
                type="text"
                placeholder={t('Search patients...')}
                aria-label={t('Search patients...')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border-0 bg-white/95 py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-white"
              />
              <div className="absolute left-3 top-3 text-slate-400"><Icon name="spark" size={14} /></div>
            </div>
          </div>

          {/* Prominent "+ Add New CBAC Form" button */}
          <button
            type="button"
            onClick={() => navigate(`/cbac?tier=${activeTier}`)}
            className="btn !min-h-[44px] px-4 rounded-xl text-xs sm:text-sm font-bold bg-white text-slate-900 hover:bg-slate-100 shadow-md flex items-center gap-2 active:scale-95 transition-all"
          >
            <Icon name="spark" size={16} className="text-teal-600" />
            <span>{t('New CBAC Registration')}</span>
          </button>
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

        </div>

        {tierCases.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <p className="text-slate-400 text-sm">{t('No patient cases currently in')} {t(currentMeta.name)}.</p>
            <button
              type="button"
              onClick={() => navigate(`/cbac?tier=${activeTier}`)}
              className="btn btn-primary !min-h-[40px] text-xs font-bold"
            >
              {t('New CBAC Registration')}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {tierCases.map((c) => {
              const cbac = c.referral.screening?.cbac;
              const reportsCount = (c.referral.reports?.length || 0) + (c.referral.biopsyReports?.length || 0) + (c.referral.radiologyReports?.length || 0);
              const cardActions = cardActionsFor(c);

              return (
                <div
                  key={c.referral.id}
                  className="rounded-xl border border-slate-200 p-4 bg-slate-50/40 hover:bg-white transition-all space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center text-xs">
                        {(c.patient.name?.trim() || 'C').charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Link to={`/case/${c.referral.id}?tier=${activeTier}`} className="font-bold text-sm text-slate-900 hover:underline">
                            {c.patient.name?.trim() || t('Community member')}
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

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {(c.referral.tier || 'asha') !== activeTier && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-sky-100 text-sky-800">{t('Referred to')} {(c.referral.tier || '').toUpperCase()}</span>
                      )}
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
                  <CareJourneySummary record={c} />
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
                              patientName: c.patient.name?.trim() || t('Community member'),
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

                  {activeTier === 'asha' && <p className="line-clamp-2 text-xs text-slate-600">{ashaNoteLines(c, t, formatDate).join(' ')}</p>}
                  {reportsCount > 0 && <div className="flex flex-wrap gap-2">{[...(c.referral.reports || []), ...(c.referral.biopsyReports || []), ...(c.referral.radiologyReports || [])].map(attachment => <button type="button" key={attachment.id} className="btn btn-secondary !min-h-[34px] px-3 text-xs font-semibold" onClick={() => setEditReport({ id: c.referral.id, attachment })}>{t('✎ Edit')} {attachment.title}</button>)}</div>}
                  <div className="flex flex-wrap items-center gap-3 text-xs"><span>{t('Appointment:')} {appointmentFor(c, activeTier) ?? t('Not set')}</span>{activeTier !== 'asha' && <span>{t('Attendance')}: {t(ATTENDANCE_LABELS[c.referral.worker.attendance ?? c.referral.facility.attendance])}</span>}</div>
                  {/* One main action for this case; the rest behind More. */}
                  <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
                    <button type="button" className="btn btn-primary flex-1 !min-h-[48px] text-sm font-bold" onClick={cardActions.primary.onClick}>{cardActions.primary.label}</button>
                    <MoreMenu actions={cardActions.more} placement="bottom" />
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
          patientName={activeCaseForReferral.caseRecord.patient.name?.trim() || t('Community member')}
          currentTier={activeTier}
          savedSummary={freshCase(activeCaseForReferral.caseRecord).referral.aiSummaryOverride}
          physicalExam={freshCase(activeCaseForReferral.caseRecord).referral.physicalExam}
          reports={[...(freshCase(activeCaseForReferral.caseRecord).referral.reports || []), ...(freshCase(activeCaseForReferral.caseRecord).referral.biopsyReports || []), ...(freshCase(activeCaseForReferral.caseRecord).referral.radiologyReports || [])]}
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
