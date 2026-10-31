import type { ReactNode } from 'react';
import { useLang } from '../i18n';
import { journeyProgress, type JourneyNode, type JourneyStep } from '../intelligence/journeyProgress';
import type { Referral } from '../db/types';
import { Icon } from './Icon';

/**
 * The whole path in one line, on every case page: where it has been, where it is, what is next.
 * `onSelect` makes finished steps tappable, for pages that have that step's handover note to open.
 */
export function JourneyStepper({ referral, onSelect }: { referral: Referral; onSelect?: (step: JourneyStep) => void }) {
  const { t, formatDate } = useLang();
  const nodes = journeyProgress(referral);
  const label = (step: JourneyStep) => (step === 'back' ? t('journey.back') : step.toUpperCase());
  const caption = (node: JourneyNode) => {
    if (!node.date) return node.state === 'current' ? t('journey.here') : '';
    return t(node.dateKind === 'appointment' ? 'journey.appt' : 'journey.referred', { date: formatDate(node.date) });
  };
  return (
    <nav aria-label={t('journey.title')} className="card !p-3">
      <ol className="grid grid-cols-5 gap-1 text-center">
        {nodes.map((node, index) => {
          const body: ReactNode = (
            <>
              <span
                className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 text-[0.7rem] font-bold ${
                  node.state === 'done' ? 'border-emerald-500 bg-emerald-500 text-white' : node.state === 'current' ? 'border-brand bg-white text-brand ring-4 ring-sky-100' : 'border-slate-300 bg-white text-slate-400'
                }`}
              >
                {node.state === 'done' ? <Icon name="check" size={14} /> : index + 1}
              </span>
              <span className={`text-[0.7rem] leading-tight sm:text-xs ${node.state === 'current' ? 'font-bold text-ink' : node.state === 'done' ? 'font-semibold text-slate-700' : 'text-slate-400'}`}>{label(node.step)}</span>
              <span className="min-h-[1rem] text-[0.65rem] leading-tight text-muted sm:text-[0.7rem]">{caption(node)}</span>
            </>
          );
          const column = 'flex w-full flex-col items-center gap-1';
          const tappable = !!onSelect && node.state === 'done' && node.step !== 'back';
          return (
            <li key={node.step} aria-current={node.state === 'current' ? 'step' : undefined} data-state={node.state} className="relative px-0.5">
              {index > 0 && <span aria-hidden className={`absolute right-1/2 top-3.5 h-0.5 w-full ${node.state === 'upcoming' ? 'bg-slate-200' : 'bg-emerald-500'}`} />}
              {tappable ? (
                <button type="button" onClick={() => onSelect(node.step)} aria-label={`${label(node.step)}: ${t('journey.openNote')}`} className={`${column} !min-h-[44px] !rounded-lg !border-0 !bg-transparent !p-0 hover:!bg-slate-50`}>
                  {body}
                </button>
              ) : (
                <div className={column}>{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
