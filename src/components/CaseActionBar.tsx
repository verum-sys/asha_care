import { useLang } from '../i18n';
import { MoreMenu, type BarAction } from './MoreMenu';

export type { BarAction } from './MoreMenu';

/** One big button for the next step; everything else in a "More" menu. Stays at the bottom of the screen, above the tab bar. */
export function CaseActionBar({ primary, more }: { primary: BarAction; more: BarAction[] }) {
  const { t } = useLang();
  return (
    <div className="sticky bottom-[calc(76px+env(safe-area-inset-bottom,0px))] z-20 sm:bottom-3" data-testid="case-action-bar">
      <div className="rounded-2xl border border-line bg-white/95 p-2 shadow-lg backdrop-blur">
        <div className="flex gap-2">
          <button type="button" className="btn btn-primary flex-1 !min-h-[48px] text-base font-bold" disabled={!!primary.disabledReason} onClick={primary.onClick}>{primary.label}</button>
          <MoreMenu actions={more} />
        </div>
        {primary.disabledReason && <p className="px-1 pt-1 text-xs text-muted" data-testid="action-locked">{t(primary.disabledReason)}</p>}
      </div>
    </div>
  );
}
