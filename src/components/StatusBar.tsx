import { useLang } from '../i18n';
import { useConnectivity } from '../sync/connectivity';
import { Icon } from './Icon';

/** Persistent connectivity / offline-readiness / sync indicator shown on every screen. */
export function StatusBar({ showSync = true }: { showSync?: boolean }) {
  const { t } = useLang();
  const { online, pending, syncing, syncFailed, sync, needRefresh, reloadApp } = useConnectivity();

  // Nothing to show while online and idle.
  if (online && !needRefresh && !syncing && !syncFailed) return null;

  return (
    <div
      className={`sticky top-0 z-20 border-b ${online ? 'bg-white border-line' : 'bg-slate-800 border-slate-700 text-white'}`}
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-1.5 px-3 py-1.5 sm:gap-2 sm:px-4 sm:py-2 text-[0.8rem] sm:text-[0.85rem]">
        <div className="flex flex-wrap items-center gap-1.5">
          {needRefresh && (
            <button
              type="button"
              onClick={() => void reloadApp()}
              className="chip cursor-pointer bg-brand text-white font-semibold shadow-sm hover:opacity-90"
              title={t('A new version of CareLink is ready. Tap to reload.')}
            >
              <Icon name="spark" size={13} className="text-accent" />
              {t('status.updateReady')}
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Sync status is only relevant offline; online, changes are sent automatically. */}
          {!online && (
            <span className="text-[0.78rem] sm:text-[0.85rem] text-slate-200">
              {pending > 0 ? t('status.pending', { n: pending }) : t('status.allSynced')}
            </span>
          )}
          {online && syncing && <span className="text-[0.78rem] sm:text-[0.85rem] text-muted">{t('status.syncing')}</span>}
          {showSync && online && syncFailed && (
            <button
              type="button"
              onClick={() => void sync()}
              disabled={syncing}
              className={`btn !min-h-[34px] sm:!min-h-[40px] !px-2.5 sm:!px-3 !py-0.5 sm:!py-1 text-[0.78rem] sm:text-[0.85rem] ${pending > 0 ? 'btn-accent' : 'btn-secondary'}`}
            >
              <Icon name="sync" size={15} className={syncing ? 'animate-spin' : ''} />
              {syncing ? t('status.syncing') : t('Retry sync')}
            </button>
          )}
        </div>
      </div>
      {!online && (
        <div className="mx-auto max-w-2xl px-3 pb-1.5 sm:px-4 sm:pb-2 text-[0.78rem] sm:text-[0.85rem] text-slate-200">{t('status.offlineNote')}</div>
      )}
    </div>
  );
}
