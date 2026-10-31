import { useLang } from '../i18n';
import { journeyProgress, type JourneyStep } from '../intelligence/journeyProgress';
import type { Referral } from '../db/types';
import { Icon } from './Icon';

/** The whole path in one line, on every case page: where it has been, where it is, what is next. */
export function JourneyStepper({ referral }: { referral: Referral }) {
  const { t, formatDate } = useLang();
  const nodes = journeyProgress(referral);
  const label = (step: JourneyStep) => (step === 'back' ? t('journey.back') : step.toUpperCase());
  return (
    <nav aria-label={t('journey.title')} className="card !p-3">
      <ol className="grid grid-cols-5 gap-1 text-center">
        {nodes.map((node, index) => (
          <li
            key={node.step}
            aria-current={node.state === 'current' ? 'step' : undefined}
            data-state={node.state}
            className="relative flex flex-col items-center gap-1 px-0.5"
          >
            {index > 0 && <span aria-hidden className={`absolute right-1/2 top-3.5 h-0.5 w-full ${node.state === 'upcoming' ? 'bg-slate-200' : 'bg-emerald-500'}`} />}
            <span
              className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 text-[0.7rem] font-bold ${
                node.state === 'done' ? 'border-emerald-500 bg-emerald-500 text-white' : node.state === 'current' ? 'border-brand bg-white text-brand ring-4 ring-sky-100' : 'border-slate-300 bg-white text-slate-400'
              }`}
            >
              {node.state === 'done' ? <Icon name="check" size={14} /> : index + 1}
            </span>
            <span className={`text-[0.7rem] leading-tight sm:text-xs ${node.state === 'current' ? 'font-bold text-ink' : node.state === 'done' ? 'font-semibold text-slate-700' : 'text-slate-400'}`}>{label(node.step)}</span>
            <span className="min-h-[1rem] text-[0.65rem] leading-tight text-muted sm:text-[0.7rem]">
              {node.date ? (node.dateKind === 'appointment' ? t('journey.appt', { date: formatDate(node.date) }) : t('journey.referred', { date: formatDate(node.date) })) : node.state === 'current' ? t('journey.here') : ''}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
