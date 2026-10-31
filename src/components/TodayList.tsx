import { Link } from 'react-router-dom';
import { useLang } from '../i18n';
import { todayReason, telHref, type TodayReason } from '../intelligence/today';
import type { CaseSummary } from '../intelligence/priority';
import { Icon } from './Icon';

export function useReasonText() {
  const { t } = useLang();
  return (reason: TodayReason): string => {
    switch (reason.kind) {
      case 'dueToday': return t('today.dueToday');
      case 'overdue': return t('today.overdue', { n: reason.days });
      case 'urgent': return t('today.urgent');
      case 'state': return t(`careState.${reason.state}`);
    }
  };
}

/** Big, tappable Call button; renders nothing when there is no usable number. */
export function CallButton({ phone, className = '', compact = false }: { phone?: string; className?: string; compact?: boolean }) {
  const { t } = useLang();
  const href = telHref(phone);
  if (!href) return null;
  return (
    <a href={href} className={`btn btn-secondary !min-h-[44px] shrink-0 ${className}`} aria-label={t('today.call')}>
      <Icon name="phone" size={18} />
      <span className={compact ? 'sr-only sm:not-sr-only' : ''}>{t('today.call')}</span>
    </a>
  );
}

/** The two or three cases to deal with first, each with the reason it is here and a Call button. */
export function TodayList({ cases }: { cases: CaseSummary[] }) {
  const { t } = useLang();
  const reasonText = useReasonText();
  return (
    <section className="card space-y-2" data-testid="today-list" aria-label={t('today.title')}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">{t('today.title')}</h2>
        <span className="text-[0.85rem] text-muted">{cases.length > 0 ? t('today.hint') : ''}</span>
      </div>
      {cases.length === 0 ? (
        <p className="text-muted">{t('today.empty')}</p>
      ) : (
        <ul className="space-y-2">
          {cases.map(c => {
            const reason = todayReason(c);
            return (
              <li key={c.referral.id} className="flex items-center gap-2 rounded-xl border border-line p-2">
                <Link to={`/case/${c.referral.id}`} className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{c.patient.name?.trim() || t('Community member')}</div>
                  {reason && <div className="truncate text-[0.85rem] text-danger">{reasonText(reason)}</div>}
                </Link>
                <CallButton phone={c.patient.phone} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
