import { useState } from 'react';
import { useLang } from '../../i18n';
import { BackLink } from '../../components/Layout';
import { Icon } from '../../components/Icon';
import { listCases } from '../../db/repo';
import { useLive } from '../../db/useLive';
import type { CareUnit } from '../../db/types';
import { computeAnalytics, TIER_ORDER } from '../../export/analytics';
import { exportReport } from '../../export/caseReport';

const TIER_LABEL = { asha: 'ASHA', phc: 'PHC', dh: 'DH', tcc: 'TCC' } as const;

function Tile({ label, value, tone = 'text-ink' }: { label: string; value: number; tone?: string }) {
  return <div className="rounded-xl border border-line bg-white p-3"><div className={`text-2xl font-bold ${tone}`}>{value}</div><div className="text-xs text-muted">{label}</div></div>;
}

/** Horizontal bars, one per row, scaled to the largest value. */
function Bars({ rows, color }: { rows: { label: string; value: number }[]; color: string }) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return <div className="space-y-2">{rows.map(r => (
    <div key={r.label} className="grid grid-cols-[4.5rem_1fr_2.5rem] items-center gap-2 text-sm">
      <span className="font-semibold text-slate-700">{r.label}</span>
      <div className="h-4 rounded bg-slate-100"><div className={`h-4 rounded ${color}`} style={{ width: `${(r.value / max) * 100}%` }} /></div>
      <span className="text-right tabular-nums">{r.value}</span>
    </div>
  ))}</div>;
}

function Card({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return <section className="card space-y-3"><div><h2 className="text-base font-bold">{title}</h2>{note && <p className="text-xs text-muted">{note}</p>}</div>{children}</section>;
}

export function AnalyticsDashboard() {
  const { t, formatDate } = useLang();
  const { data: cases = [] } = useLive(listCases, []);
  const [unit, setUnit] = useState<CareUnit | 'all'>('all');
  const a = computeAnalytics(cases, unit);
  const shown = unit === 'all' ? cases : cases.filter(c => (c.referral.unit || 'a') === unit);
  const weekMax = Math.max(1, ...a.weekly.map(w => w.count));
  const scoreMax = Math.max(1, ...a.riskScores);

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-12">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BackLink />
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm font-semibold flex items-center gap-2">{t('Unit')}
            <select value={unit} onChange={e => setUnit(e.target.value as CareUnit | 'all')} className="!min-h-[40px] !py-1">
              <option value="all">{t('All units')}</option><option value="a">A</option><option value="b">B</option><option value="c">C</option>
            </select>
          </label>
          <button type="button" className="btn btn-primary !min-h-[40px] text-sm font-bold" onClick={() => exportReport(shown, 'all')}>
            <Icon name="download" size={16} /><span>{t('Export full report')}</span>
          </button>
        </div>
      </div>
      <header><h1 className="text-[1.4rem] font-bold">{t('Program dashboard')}</h1><p className="text-sm text-muted">{t('Live view of every case in the care network.')}</p></header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <Tile label={t('Patients')} value={a.total} />
        <Tile label={t('Screened with CBAC')} value={a.screened} />
        <Tile label={t('High NCD risk')} value={a.highRisk} tone="text-rose-700" />
        <Tile label={t('Reached a facility')} value={a.reachedFacility} />
        <Tile label={t('Missed appointments')} value={a.missed} tone="text-amber-700" />
        <Tile label={t('Walk-ins at DH / TCC')} value={a.walkIns} />
        <Tile label={t('Care loops closed')} value={a.loopsClosed} tone="text-emerald-700" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t('How far patients got')} note={t('Cases that reached each level at any time.')}>
          <Bars color="bg-teal-600" rows={TIER_ORDER.map(tier => ({ label: TIER_LABEL[tier], value: a.reached[tier] }))} />
        </Card>
        <Card title={t('Where patients are now')} note={t('Cases each level holds today.')}>
          <Bars color="bg-sky-600" rows={TIER_ORDER.map(tier => ({ label: TIER_LABEL[tier], value: a.current[tier] }))} />
        </Card>
        <Card title={t('Attendance at each level')}>
          <div className="space-y-3">{(['phc', 'dh', 'tcc'] as const).map(tier => {
            const v = a.attendance[tier];
            const sum = Math.max(1, v.attended + v.missed + v.pending);
            return <div key={tier} className="space-y-1">
              <div className="flex justify-between text-sm"><span className="font-semibold">{TIER_LABEL[tier]}</span><span className="text-xs text-muted">{v.attended} {t('attended')} · {v.missed} {t('missed')} · {v.pending} {t('not yet recorded')}</span></div>
              <div className="flex h-4 overflow-hidden rounded bg-slate-100" role="img" aria-label={`${TIER_LABEL[tier]}: ${v.attended} ${t('attended')}, ${v.missed} ${t('missed')}, ${v.pending} ${t('not yet recorded')}`}>
                <div className="bg-emerald-600" style={{ width: `${(v.attended / sum) * 100}%` }} />
                <div className="bg-rose-500" style={{ width: `${(v.missed / sum) * 100}%` }} />
                <div className="bg-slate-300" style={{ width: `${(v.pending / sum) * 100}%` }} />
              </div>
            </div>;
          })}
          <p className="flex gap-3 text-xs text-muted"><span><span className="inline-block h-2 w-2 rounded-sm bg-emerald-600" /> {t('Attended')}</span><span><span className="inline-block h-2 w-2 rounded-sm bg-rose-500" /> {t('Missed')}</span><span><span className="inline-block h-2 w-2 rounded-sm bg-slate-300" /> {t('Not yet recorded')}</span></p>
          </div>
        </Card>
        <Card title={t('Urgency')}>
          <Bars color="bg-amber-500" rows={[{ label: t('Urgent'), value: a.urgency.urgent }, { label: t('Soon'), value: a.urgency.soon }, { label: t('Routine'), value: a.urgency.routine }]} />
        </Card>
        <Card title={t('CBAC risk scores')} note={t('Part A score out of 12. Above 4 is high NCD risk.')}>
          <div className="flex h-40 items-end gap-1" role="img" aria-label={t('CBAC risk scores')}>{a.riskScores.map((n, score) => (
            <div key={score} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] tabular-nums text-muted">{n || ''}</span>
              <div className={`w-full rounded-t ${score > 4 ? 'bg-rose-500' : 'bg-teal-600'}`} style={{ height: `${(n / scoreMax) * 120}px` }} />
              <span className="text-[10px] text-muted">{score}</span>
            </div>
          ))}</div>
        </Card>
        <Card title={t('New cases per week')} note={t('Last 8 weeks.')}>
          <div className="flex h-40 items-end gap-2" role="img" aria-label={t('New cases per week')}>{a.weekly.map(w => (
            <div key={w.start} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] tabular-nums text-muted">{w.count || ''}</span>
              <div className="w-full rounded-t bg-sky-600" style={{ height: `${(w.count / weekMax) * 120}px` }} />
              <span className="text-[10px] text-muted whitespace-nowrap">{formatDate(w.start).replace(/\s?\d{4}$/, '')}</span>
            </div>
          ))}</div>
        </Card>
      </div>
    </div>
  );
}
