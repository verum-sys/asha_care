import { BackLink } from '../../components/Layout';
import { Icon } from '../../components/Icon';
import { useAuth } from '../../auth/AuthContext';
import { listSyncEvents, listWaitingChanges } from '../../db/repo';
import { resetDemoData } from '../../db/seed';
import { useLive } from '../../db/useLive';
import { useLang } from '../../i18n';
import { useSettings } from '../../settings';
import { isRemoteEnabled } from '../../sync/config';
import { useConnectivity } from '../../sync/connectivity';

export function SyncPage() {
  const { t, formatDateTime } = useLang();
  const { isSuperAdmin } = useAuth();
  const { workerName, setWorkerName } = useSettings();
  const { online, simulateOffline, setSimulateOffline, offlineReady, pending, syncing, sync, lastResult, reloadApp, needsSignIn, lastSyncedAt } = useConnectivity();
  const { data: history } = useLive(listSyncEvents, []);
  const { data: waiting } = useLive(listWaitingChanges, []);

  return (
    <div className="space-y-4">
      <BackLink />
      <h1 className="text-[1.4rem] font-bold">{t('sync.title')}</h1>

      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold">{t('sync.status')}</span>
          <span className={`chip ${online ? 'bg-ok-soft text-ok' : 'bg-slate-800 text-white'}`}>
            <Icon name={online ? 'online' : 'offline'} size={16} />
            {online ? t('status.online') : simulateOffline ? t('status.offlineSim') : t('status.offline')}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-semibold">{t('sync.pendingRecords')}</span>
          <span className="text-xl font-bold" data-testid="pending-count">
            {pending}
          </span>
        </div>
        <button type="button" className="btn btn-accent btn-block !min-h-[56px] text-lg" disabled={!online || syncing} onClick={() => void sync()} data-testid="sync-now">
          <Icon name="sync" size={20} className={syncing ? 'animate-spin' : ''} />
          {syncing ? t('status.syncing') : t('sync.now')}
        </button>
        {!online && <p className="text-muted">{t('sync.offlineCannot')}</p>}
        <p className="text-[0.85rem] text-muted" data-testid="last-synced">
          {lastSyncedAt ? t('sync.lastSynced', { time: formatDateTime(lastSyncedAt) }) : t('sync.notSyncedYet')}
        </p>
        {needsSignIn && pending > 0 && (
          <p className="rounded-xl bg-danger-soft px-3 py-2 font-semibold text-danger" role="alert">{t('sync.signinNeeded')}</p>
        )}
        {lastResult && (
          <p className="rounded-xl bg-ok-soft px-3 py-2 font-semibold text-ok" role="status">
            {t('sync.result', { sent: lastResult.sent, updates: lastResult.facilityUpdates })}
          </p>
        )}
      </section>

      <section className="card space-y-2">
        <h2 className="text-lg font-bold">{t('sync.updateTitle')}</h2>
        <p className="text-[0.85rem] text-muted">{t('sync.updateHint')}</p>
        <button
          type="button"
          className="btn btn-secondary btn-block !min-h-[44px]"
          onClick={() => void reloadApp()}
        >
          <Icon name="sync" size={18} />
          {t('sync.reloadApp')}
        </button>
      </section>

      <section className="card space-y-2">
        <h2 className="text-lg font-bold">{t('sync.waitingTitle')}</h2>
        {waiting && waiting.length > 0 ? (
          <ul className="space-y-1.5" data-testid="waiting-list">
            {waiting.map((w) => (
              <li key={w.id} className="flex justify-between gap-2 border-b border-line/70 py-1.5 last:border-0">
                <span className="font-semibold">{w.patientName}</span>
                <span className="text-right text-muted">{w.parts.map((part) => t(`sync.part.${part}`)).join(', ')}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">{t('sync.nothingWaiting')}</p>
        )}
      </section>

      <section className="card">
        <div className={`flex items-center gap-2 rounded-xl px-3 py-2 ${offlineReady ? 'bg-info-soft text-brand' : 'bg-warn-soft text-warn'}`}>
          <Icon name={offlineReady ? 'check' : 'download'} size={18} />
          {offlineReady ? t('sync.offlineReady') : t('sync.offlineNotReady')}
        </div>
      </section>

      <section className="card">
        <h2 className="mb-2 text-lg font-bold">{t('sync.history')}</h2>
        {history && history.length > 0 ? (
          <ul className="space-y-1.5">
            {history.slice(0, 8).map((h) => {
              const r = JSON.parse(h.summary) as { sent: number; facilityUpdates: number };
              return (
                <li key={h.id} className="flex justify-between gap-2 border-b border-line/70 py-1.5 last:border-0">
                  <span className="text-muted">{formatDateTime(h.at)}</span>
                  <span className="text-right">{t('sync.result', { sent: r.sent, updates: r.facilityUpdates })}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-muted">{t('sync.never')}</p>
        )}
      </section>

      <section className="card space-y-3">
        <div>
          <label htmlFor="worker" className="mb-1 block font-semibold">
            {t('sync.worker')}
          </label>
          <input id="worker" value={workerName} onChange={(e) => setWorkerName(e.target.value)} />
        </div>
      </section>

      {isSuperAdmin && (
        <section className="card space-y-3" aria-label={t('sync.developer')}>
          <h2 className="text-lg font-bold">{t('sync.developer')}</h2>
          <label className="tap flex cursor-pointer items-center justify-between gap-3">
            <span>
              <span className="block font-semibold">{t('sync.simulate')}</span>
              <span className="block text-[0.85rem] text-muted">{t('sync.simulateHint')}</span>
            </span>
            <input
              type="checkbox"
              checked={simulateOffline}
              onChange={(e) => setSimulateOffline(e.target.checked)}
              className="!min-h-0 !w-7 h-7 accent-[var(--color-brand)]"
              data-testid="simulate-offline"
            />
          </label>
          {/* Demo reset would push sample cases into the shared database, so it is demo mode only. */}
          {!isRemoteEnabled() && (
            <div className="space-y-2">
              <p className="text-[0.85rem] text-muted">{t('sync.demoNote')}</p>
              <button
                type="button"
                className="btn btn-secondary btn-block text-danger"
                onClick={() => {
                  if (confirm(t('sync.resetConfirm'))) void resetDemoData();
                }}
              >
                {t('sync.reset')}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
