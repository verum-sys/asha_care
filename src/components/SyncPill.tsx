import { Link } from 'react-router-dom';
import { useLang } from '../i18n';
import { syncPillState, type SyncPillState } from '../sync/syncState';
import { useOptionalConnectivity } from '../sync/connectivity';
import { Icon } from './Icon';

const TONE: Record<SyncPillState, string> = {
  saved: 'bg-ok-soft text-ok',
  waiting: 'bg-warn-soft text-warn',
  sending: 'bg-info-soft text-brand',
  offline: 'bg-slate-800 text-white',
  signin: 'bg-danger-soft text-danger',
  failed: 'bg-danger-soft text-danger',
};
const ICON: Record<SyncPillState, string> = {
  saved: 'check', waiting: 'sync', sending: 'sync', offline: 'offline', signin: 'info', failed: 'info',
};

/** Always-visible save status in the header. Tapping it opens the Sync page. */
export function SyncPill() {
  const { t } = useLang();
  const c = useOptionalConnectivity();
  if (!c) return null;
  const state = syncPillState(c);
  const label = {
    saved: t('pill.saved'),
    waiting: t('pill.waiting', { n: c.pending }),
    sending: t('pill.sending'),
    offline: c.pending > 0 ? t('pill.offlineSaved', { n: c.pending }) : t('pill.offline'),
    signin: t('pill.signin', { n: c.pending }),
    failed: t('pill.failed'),
  }[state];
  return (
    <Link to="/sync" className={`chip shrink-0 font-semibold ${TONE[state]}`} data-testid="sync-pill" data-state={state} aria-label={label}>
      <Icon name={ICON[state]} size={14} className={state === 'sending' ? 'animate-spin' : ''} />
      <span className="max-w-[7.5rem] sm:max-w-[14rem] truncate">{label}</span>
    </Link>
  );
}
