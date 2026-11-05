import { useLang, useTermTier } from '../../i18n';
import { CareJourneySummary } from '../../components/CareJourneySummary';
import { BackLink } from '../../components/Layout';
import { ATTENDANCE_LABELS, VisitStatusModal } from '../../components/VisitStatusModal';
import { ClinicalHandovers } from '../../components/ClinicalHandovers';
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
import { today } from '../../intelligence/dates';
import { NEXT_TIER, actionLocks, primaryCaseAction, referralBlockers } from '../../intelligence/caseActions';
import { analyze } from '../../intelligence/engine';
import { needsToday } from '../../intelligence/today';
import { CallButton } from '../../components/TodayList';
import { getCaseCategory, type CaseCategory } from '../frontline/CategoryCases';
import { ashaAppointment, ashaNoteLines } from '../../intelligence/ashaNote';
import { TierReferralModal } from '../../components/TierReferralModal';
import { AiSummaryModal } from '../../components/AiSummaryModal';
import { WalkInModal } from '../../components/WalkInModal';
import { BackToAshaModal } from '../../components/BackToAshaModal';
import { handedTo, isDirectAt, reportsVisibleTo } from '../../intelligence/pathway';
import { exportReport } from '../../export/caseReport';
import { DEMO_NAMES, DEMO_VERSION, setUpDemoCases } from '../../db/demoCases';

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
  const [tab, setTab] = useState<'all' | 'today' | CaseCategory>('all');
  /** PHC, DH and TCC can show referred patients and direct patients (came in themselves) separately. */
  const [entry, setEntry] = useState<'all' | 'referred' | 'direct'>('all');

  // Modals state
  const [activeCaseForAttachment, setActiveCaseForAttachment] = useState<{ id: string; category: 'general' | 'biopsy' | 'radiology' } | null>(null);
  const [activePdfPreview, setActivePdfPreview] = useState<{ attachment: ReportAttachment; patientName: string; patientId: string } | null>(null);
  const [activeCaseForExam, setActiveCaseForExam] = useState<{ caseRecord: CaseRecord } | null>(null);
  const [activeCaseForReferral, setActiveCaseForReferral] = useState<{ caseRecord: CaseRecord } | null>(null);
  const [visitCase, setVisitCase] = useState<CaseRecord | null>(null);
  const [editReport, setEditReport] = useState<{ id: string; attachment: ReportAttachment } | null>(null);
  const [activeCaseForAi, setActiveCaseForAi] = useState<{ caseRecord: CaseRecord } | null>(null);
  const [walkIn, setWalkIn] = useState(false);
  const [backCase, setBackCase] = useState<CaseRecord | null>(null);
  const [demo, setDemo] = useState<'idle' | 'confirm' | 'adding' | 'done'>('idle');
  const [demoAdded, setDemoAdded] = useState(0);

  const { data: allCases = [] } = useLive(listCases, []);
  /** Modals hold a snapshot; read the live record so saved summaries show immediately. */
  const freshCase = (record: CaseRecord) => allCases.find(c => c.referral.id === record.referral.id) ?? record;

  // Super admins see every unit in the module; staff retain their assigned access.
  const moduleCases = allCases.filter((c) => {
    const t = c.referral.tier || 'asha';
    const u = c.referral.unit || 'a';
    // A tier keeps the cases it referred onward, so it can still record follow-ups and see the appointment.
    // A counter referral (DH or TCC sent the patient back) reaches both the patient's PHC and its ASHA, even when the
    // patient came to DH or TCC directly; ASHA also sees any case where something went wrong (missed visit).
    const sentBack = (activeTier === 'asha' || activeTier === 'phc') && !!c.referral.ashaFollowUpDate;
    const needsAsha = activeTier === 'asha' && !!c.referral.ashaAlert;
    if (t !== activeTier && !sentBack && !needsAsha && !c.referral.clinicalHandovers?.some(h => h.fromTier === activeTier)) return false;
    if (user.role !== 'super_admin' && u !== user.unit) return false;
    return true;
  });
  const tierCases = moduleCases.filter((c) => {
    if (entry === 'direct' && !isDirectAt(c.referral, activeTier)) return false;
    if (entry === 'referred' && isDirectAt(c.referral, activeTier)) return false;
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
  // ASHA screens with CBAC and PHC reviews it; DH and TCC work without the CBAC form.
  const withCbac = activeTier === 'asha' || activeTier === 'phc';
  const startRegistration = () => (withCbac ? navigate(`/cbac?tier=${activeTier}`) : setWalkIn(true));
  const currentMeta = tierMeta[activeTier];

  // Status tabs: Today first, then the same three groups as the ASHA home.
  const intelById = new Map(tierCases.map(c => [c.referral.id, analyze(c.patient, c.referral, c.followUps)]));
  const summaryOf = (c: CaseRecord) => ({ patient: c.patient, referral: c.referral, followUps: c.followUps, intel: intelById.get(c.referral.id)! });
  const inTab = (c: CaseRecord, which: typeof tab) => which === 'all' || (which === 'today' ? needsToday(summaryOf(c)) : getCaseCategory(summaryOf(c)) === which && summaryOf(c).intel.open);
  const tabs: { key: typeof tab; label: string }[] = [
    { key: 'all', label: t('today.tab.all') },
    { key: 'today', label: t('today.tab.today') },
    { key: 'critical', label: t('home.cardCritical') },
    { key: 'pending', label: t('home.cardPending') },
    { key: 'on_track', label: t('home.cardOnTrack') },
  ];
  const shownCases = tierCases.filter(c => inTab(c, tab));

  /** One main action per card, picked from the case state; everything else goes in More. */
  function cardActionsFor(c: CaseRecord): { primary: BarAction; more: BarAction[] } {
    const holder = c.referral.tier || 'asha';
    const canAct = holder === activeTier;
    const hasCbac = !!c.referral.screening?.cbac;
    const openCase: BarAction = {
      key: 'open',
      label: activeTier === 'asha' ? (hasCbac ? t('CBAC View / Edit') : t('Conduct CBAC')) : activeTier === 'phc' ? t('CBAC Form') : t('Open case'),
      onClick: () => navigate(hasCbac || activeTier !== 'asha' ? `/case/${c.referral.id}?tier=${activeTier}` : `/case/${c.referral.id}/cbac?tier=asha&unit=${c.referral.unit || 'a'}`, { state: { returnTo: `/tier/${activeTier}` } }),
    };
    const locks = actionLocks({ viewTier: activeTier, holderTier: holder, appointmentDate: c.referral.worker.appointmentDate ?? c.referral.facility.appointmentDate, today: today(), referred: !!c.referral.clinicalHandovers?.length || !!c.referral.ashaFollowUpDate });
    const followUp: BarAction = { key: 'followUp', label: t('Record follow-up'), onClick: () => navigate(`/case/${c.referral.id}/follow-up`, { state: { returnTo: `/tier/${activeTier}` } }), disabledReason: locks.followUp };
    // A direct patient came in themselves: no attendance step.
    const direct = isDirectAt(c.referral, holder);
    const attendedHere = (c.referral.worker.attendance ?? c.referral.facility.attendance) === 'attended';
    const attendance: BarAction | undefined = activeTier !== 'asha' && canAct && !direct ? { key: 'attendance', label: t('Record attendance'), onClick: () => setVisitCase(c), disabledReason: locks.attendance } : undefined;
    // PHC and DH record attendance (referred patients) and the physical examination before they can refer on.
    const hasExam = !!c.referral.physicalExam;
    const blockers = referralBlockers({ tier: holder, attendance: c.referral.worker.attendance ?? c.referral.facility.attendance, hasExam, direct });
    // DH and TCC close their part with a next appointment, sending the patient back to their PHC and ASHA.
    const sendBack: BarAction | undefined = (activeTier === 'dh' || activeTier === 'tcc') && canAct ? { key: 'sendBack', label: c.referral.ashaFollowUpDate ? t('Change next appointment') : t('Next appointment (back to ASHA)'), onClick: () => setBackCase(c), disabledReason: !direct && !attendedHere ? 'Record attendance first' : undefined } : undefined;
    const exam: BarAction = { key: 'exam', label: hasExam ? t('Edit Physical Exam') : t('+ Record Physical Exam'), onClick: () => setActiveCaseForExam({ caseRecord: c }), disabledReason: locks.attendance };
    const refer: BarAction | undefined = activeTier !== 'asha' && NEXT_TIER[activeTier] && canAct && blockers.length === 0 ? { key: 'refer', label: activeTier === 'phc' ? t('Refer to DH') : t('Refer to TCC'), onClick: () => setActiveCaseForReferral({ caseRecord: c }) } : undefined;
    let primary: BarAction;
    if (activeTier === 'asha') primary = !canAct ? followUp : openCase; // a case held by another tier (also one TCC sent back) is ASHA's follow-up
    else {
      const wanted = primaryCaseAction({ viewTier: activeTier, holderTier: holder, attendance: c.referral.worker.attendance ?? c.referral.facility.attendance, hasExam, direct, sentBack: !!c.referral.ashaFollowUpDate });
      primary = (wanted === 'refer' ? refer : wanted === 'sendBack' ? sendBack : wanted === 'attendance' ? attendance : wanted === 'exam' && canAct ? exam : followUp) ?? openCase;
    }
    const extras: BarAction[] = activeTier === 'asha' ? [followUp] : [
      ...(canAct ? [{ key: 'exam', label: t('Add Notes'), onClick: () => setActiveCaseForExam({ caseRecord: c }), disabledReason: locks.attendance }] : []),
      { key: 'lab', label: t('+ Reports (PDF)'), onClick: () => setActiveCaseForAttachment({ id: c.referral.id, category: 'general' }) },
      ...(activeTier === 'dh' || activeTier === 'tcc' ? [
        { key: 'biopsy', label: t('+ Biopsy Report (PDF)'), onClick: () => setActiveCaseForAttachment({ id: c.referral.id, category: 'biopsy' }) },
        { key: 'radiology', label: t('+ Radiology Report (PDF)'), onClick: () => setActiveCaseForAttachment({ id: c.referral.id, category: 'radiology' }) },
      ] : []),
      followUp,
      ...(attendance ? [attendance] : []),
      ...(refer ? [refer] : []),
      ...(sendBack ? [sendBack] : []),
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

      {/* Compact header: stays on screen with search and the new-registration button. */}
      <div className="sticky top-[calc(54px+env(safe-area-inset-top,0px))] z-20 -mx-1 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white/95 p-2 shadow-sm backdrop-blur sm:top-0">
        <span className="chip bg-brand font-bold text-white" aria-label={`${activeTier.toUpperCase()} ${t('OPERATIONAL MODULE')}`}>{activeTier.toUpperCase()}</span>
        <input
          type="text"
          placeholder={t('Search patients...')}
          aria-label={t('Search patients...')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[9rem] flex-1 rounded-xl border border-line bg-white py-2.5 px-3 text-sm outline-none focus:ring-2 focus:ring-brand/40"
        />
        <button type="button" onClick={() => exportReport(moduleCases, activeTier)} className="btn btn-secondary !min-h-[44px] shrink-0 text-sm font-bold" title={t('Download this module\'s cases as an Excel file')}>
          <Icon name="download" size={16} />
          <span>{t('Export report')}</span>
        </button>
        <button type="button" onClick={startRegistration} className="btn btn-primary !min-h-[44px] shrink-0 text-sm font-bold">
          <Icon name="plus" size={16} />
          <span>{withCbac ? t('New CBAC Registration') : t('Register walk-in patient')}</span>
        </button>
      </div>

      {/* Demo cases for TCC (super admin): one referral on the ideal path, one direct walk-in. */}
      {activeTier === 'tcc' && user.role === 'super_admin' && (
        <div className="flex flex-wrap items-center justify-end gap-2 text-xs" data-testid="demo-scenarios">
          {demo === 'idle' && allCases.filter(c => c.referral.demo === DEMO_VERSION).length < DEMO_NAMES.length && <button type="button" className="btn btn-secondary !min-h-[36px] text-xs font-semibold" onClick={() => setDemo('confirm')}>{t('Set up demo cases')}</button>}
          {demo === 'confirm' && <>
            <span className="text-muted">{t('Add 2 demo patients to TCC (one referral, one direct walk-in)? Any earlier demo patients are removed from the lists.')}</span>
            <button type="button" className="btn btn-primary !min-h-[36px] text-xs font-semibold" onClick={async () => { setDemo('adding'); setDemoAdded(await setUpDemoCases(today(), user.unit)); setDemo('done'); }}>{t('Add')}</button>
            <button type="button" className="btn btn-secondary !min-h-[36px] text-xs font-semibold" onClick={() => setDemo('idle')}>{t('Cancel')}</button>
          </>}
          {demo === 'adding' && <span className="text-muted">{t('Saving…')}</span>}
          {demo === 'done' && <span role="status" className="text-emerald-700 font-semibold">{t('{n} demo patients added.', { n: demoAdded })}</span>}
        </div>
      )}

      {/* Patient List in this Module */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="font-bold text-slate-900 text-base flex items-center gap-2 font-display">
            <span>{t('Patients at')} {t(currentMeta.name)}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {tierCases.length} {tierCases.length === 1 ? t('case') : t('cases')}
            </span>
          </h2>

        </div>

        {activeTier !== 'asha' && <div role="radiogroup" aria-label={t('Referred or direct patients')} className="flex flex-wrap items-center gap-1.5" data-testid="entry-filter">
          <span className="text-xs font-semibold text-muted mr-1">{t('Show')}</span>
          {([['all', t('All patients')], ['referred', t('Referred')], ['direct', t('Direct (walk-in)')]] as const).map(([key, label]) => (
            <button key={key} type="button" role="radio" aria-checked={entry === key} onClick={() => setEntry(key)} className={`btn !min-h-[36px] text-xs font-semibold ${entry === key ? 'btn-primary' : 'btn-secondary'}`}>
              {label} <span className="opacity-80">{moduleCases.filter(c => key === 'all' || (key === 'direct') === isDirectAt(c.referral, activeTier)).length}</span>
            </button>
          ))}
        </div>}

        <div role="tablist" aria-label={t('Patients at')} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {tabs.map(({ key, label }) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`btn !min-h-[44px] shrink-0 whitespace-nowrap text-sm font-semibold ${tab === key ? 'btn-primary' : 'btn-secondary'}`}>
              {label} <span className="opacity-80">{tierCases.filter(c => inTab(c, key)).length}</span>
            </button>
          ))}
        </div>

        {tierCases.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <p className="text-slate-400 text-sm">{t('No patient cases currently in')} {t(currentMeta.name)}.</p>
            <button
              type="button"
              onClick={startRegistration}
              className="btn btn-primary !min-h-[40px] text-xs font-bold"
            >
              {withCbac ? t('New CBAC Registration') : t('Register walk-in patient')}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {shownCases.length === 0 && <p className="py-6 text-center text-sm text-muted">{t('today.emptyTab')}</p>}
            {shownCases.map((c) => {
              const cbac = c.referral.screening?.cbac;
              // Each team sees the reports attached at its level or earlier (ASHA sees none).
              const visibleReports = reportsVisibleTo(c.referral, activeTier);
              const reportsCount = visibleReports.length;
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
                          {activeTier !== 'asha' && isDirectAt(c.referral, activeTier) && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-800">{t('DIRECT')}</span>}
                        </div>
                        <div className="text-xs text-slate-500">
                          {c.patient.age ? `${c.patient.age}y` : ''} · {c.patient.locality || t('Locality unrecorded')}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {(c.referral.tier || 'asha') !== activeTier && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-sky-100 text-sky-800">{c.referral.ashaFollowUpDate && activeTier !== 'tcc' && activeTier !== 'dh' ? `${t('Back from')} ${(c.referral.backReferredFrom || c.referral.tier || '').toUpperCase()}` : `${t('Referred to')} ${(c.referral.tier || '').toUpperCase()}`}</span>
                      )}
                      {!withCbac ? null : cbac ? (
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

                  {/* Vitals are not shown on the list card; the latest check (with date and time) is on the case page and in the notes. */}
                  {c.referral.ashaFollowUpDate && <p className="text-xs rounded-lg bg-emerald-50 border border-emerald-200 px-2 py-1.5 text-emerald-900">{t('Next appointment')}: <strong>{c.referral.ashaFollowUpDate}</strong>{c.referral.ashaFollowUpNote ? ` · ${c.referral.ashaFollowUpNote}` : ''}</p>}
                  {activeTier === 'asha' && c.referral.ashaAlert && <p role="status" className="text-xs rounded-lg bg-amber-50 border border-amber-300 px-2 py-1.5 font-semibold text-amber-900">⚠ {t('ASHA action needed')}: {c.referral.ashaAlert}</p>}
                  <CareJourneySummary record={c} />
                  <ClinicalHandovers handovers={handedTo(c.referral.clinicalHandovers, activeTier)} onOpenReport={reportId => { const found = [...(c.referral.reports || []), ...(c.referral.biopsyReports || []), ...(c.referral.radiologyReports || [])].find(r => r.id === reportId); if (found) setActivePdfPreview({ attachment: found, patientName: c.patient.name, patientId: c.patient.id }); }} />

                  {/* Attached Reports previews */}
                  {reportsCount > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-bold text-slate-400">{t('Reports:')}</span>
                      {visibleReports.map((att) => (
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
                  {reportsCount > 0 && <div className="flex flex-wrap gap-2">{visibleReports.map(attachment => <button type="button" key={attachment.id} className="btn btn-secondary !min-h-[34px] px-3 text-xs font-semibold" onClick={() => setEditReport({ id: c.referral.id, attachment })}>{t('✎ Edit')} {attachment.title}</button>)}</div>}
                  <div className="flex flex-wrap items-center gap-3 text-xs"><span>{t('Appointment:')} {appointmentFor(c, activeTier) ?? t('Not set')}</span>{activeTier !== 'asha' && !isDirectAt(c.referral, activeTier) && <span>{t('Attendance')}: {t(ATTENDANCE_LABELS[c.referral.worker.attendance ?? c.referral.facility.attendance])}</span>}{activeTier !== 'asha' && isDirectAt(c.referral, activeTier) && <span>{t('Came directly, no attendance to record')}</span>}</div>
                  {/* One main action for this case; the rest behind More. */}
                  <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
                    <button type="button" className="btn btn-primary min-w-0 flex-1 !min-h-[48px] text-sm font-bold" disabled={!!cardActions.primary.disabledReason} onClick={cardActions.primary.onClick}>{cardActions.primary.label}</button>
                    <CallButton phone={c.patient.phone} compact className="!min-h-[48px]" />
                    <MoreMenu actions={cardActions.more} placement="bottom" />
                  </div>
                  {cardActions.primary.disabledReason && <p className="text-xs text-muted">{t(cardActions.primary.disabledReason)}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODALS */}
      {backCase && <BackToAshaModal referral={freshCase(backCase).referral} onClose={() => setBackCase(null)} />}
      {visitCase && <VisitStatusModal referral={visitCase.referral} onClose={() => setVisitCase(null)} />}
      {walkIn && <WalkInModal tier={activeTier} unit={user.unit} onClose={() => setWalkIn(false)} onSaved={id => navigate(`/case/${id}?tier=${activeTier}`, { state: { returnTo: `/tier/${activeTier}` } })} />}
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
