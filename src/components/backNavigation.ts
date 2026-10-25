/** HashRouter tracks same-tab entries with an index; never navigate outside the app. */
export function backDestination(historyState: unknown): -1 | '/' {
  const index = historyState && typeof historyState === 'object' ? (historyState as { idx?: unknown }).idx : undefined;
  return typeof index === 'number' && Number.isInteger(index) && index > 0 ? -1 : '/';
}
