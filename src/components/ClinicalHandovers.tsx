import type { ClinicalHandover } from '../db/types';
import { RecordedVitals } from './RecordedVitals';
export function ClinicalHandovers({ handovers }: { handovers?: ClinicalHandover[] }) {
  if (!handovers?.length) return null;
  return <section className="rounded-xl border border-sky-200 bg-sky-50/50 p-3 space-y-3">
    <h3 className="text-sm font-bold text-sky-900">Notes from previous care teams</h3>
    {handovers.map((handover, index) => <details key={`${handover.at}-${index}`} open className="rounded-lg bg-white border border-sky-100 p-3 text-xs space-y-2">
      <summary className="font-semibold text-sky-900 cursor-pointer">{handover.fromTier.toUpperCase()} → {handover.toTier.toUpperCase()} · {new Date(handover.at).toLocaleDateString()}</summary>
      <RecordedVitals exam={handover.physicalExam} />
      {([
        ['Clinical notes', handover.notes],
        ['General examination', handover.physicalExam?.generalFindings],
        ['Systemic examination', handover.physicalExam?.systemicExam],
        ['Oral examination', handover.physicalExam?.oralCavityFindings],
        ['Breast examination', handover.physicalExam?.breastExamFindings],
        ['Cervical examination', handover.physicalExam?.cervicalExamFindings],
        ['DH notes', handover.dhNotes],
        ['Saved AI summary', handover.aiSummary],
      ] as const).filter(([, value]) => value?.trim()).map(([label, value]) => <div key={label}><strong>{label}</strong><p className="whitespace-pre-wrap text-slate-700 mt-1">{value}</p></div>)}
    </details>)}
  </section>;
}
