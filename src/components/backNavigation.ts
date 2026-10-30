/** HashRouter tracks same-tab entries with an index; never navigate outside the app. */
export function backDestination(historyState: unknown): -1 | '/' {
  const index = historyIndex(historyState);
  return index !== undefined && index > 0 ? -1 : '/';
}

function historyIndex(historyState: unknown): number | undefined {
  const index = historyState && typeof historyState === 'object' ? (historyState as { idx?: unknown }).idx : undefined;
  return typeof index === 'number' && Number.isInteger(index) && index >= 0 ? index : undefined;
}

/**
 * Pages that only exist to fill a form. Back never lands on one, so a saved CBAC is not reopened at its first step.
 * A guided CBAC step (/cbac?…step=…) is not skipped: its answers are restored from the tab's draft.
 */
export function isFormPage(path: string): boolean {
  const [pathname, search = ''] = path.split('?');
  if (pathname === '/cbac') return !new URLSearchParams(search).has('step');
  return pathname === '/new' || /^\/case\/[^/]+\/(cbac|edit|follow-up)$/.test(pathname);
}

const KEY = 'carelink.backTrail';

/** The page recorded one history entry back, if any. */
export function previousPath(historyState: unknown): string | undefined {
  const index = historyIndex(historyState);
  return index ? readTrail()[index - 1] : undefined;
}

function readTrail(): Record<number, string> {
  try { return JSON.parse(sessionStorage.getItem(KEY) || '{}') as Record<number, string>; } catch { return {}; }
}

/** Remember which page sits at each history index of this tab. */
export function recordVisit(historyState: unknown, path: string) {
  const index = historyIndex(historyState);
  if (index === undefined) return;
  const trail = readTrail();
  trail[index] = path;
  for (const key of Object.keys(trail)) if (Number(key) > index) delete trail[Number(key)];
  try { sessionStorage.setItem(KEY, JSON.stringify(trail)); } catch { /* private mode: plain history back still works */ }
}

/**
 * How far to go back: the nearest earlier page that is neither a form nor the current page.
 * Returns a negative step count for navigate(), or '/' when nothing suitable is in this tab's history.
 */
export function backSteps(historyState: unknown, currentPath: string, trail: Record<number, string> = readTrail()): number | '/' {
  const index = historyIndex(historyState);
  if (index === undefined || index === 0) return '/';
  for (let i = index - 1; i >= 0; i--) {
    const path = trail[i];
    if (path === undefined) return i - index; // unknown entry (e.g. before this trail existed): trust plain history
    if (!isFormPage(path) && path !== currentPath) return i - index;
  }
  return '/';
}
