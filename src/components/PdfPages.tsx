import { useEffect, useRef, useState } from 'react';
import { useLang } from '../i18n';
import { openPdf } from '../intelligence/pdf';

const MAX_PAGES = 20;

/**
 * Draws a PDF's pages as images, so a report shows the same on a phone (where browsers cannot show a PDF inside a
 * page) as on a computer.
 */
export function PdfPages({ blob, title }: { blob: Blob; title: string }) {
  const { t } = useLang();
  const holder = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; pages: number; shown: number }>({ status: 'loading', pages: 0, shown: 0 });

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => Promise<void>) | undefined;
    (async () => {
      try {
        const { task, doc } = await openPdf(new Uint8Array(await blob.arrayBuffer()));
        destroy = () => task.destroy();
        const shown = Math.min(doc.numPages, MAX_PAGES);
        const width = Math.max(320, Math.min(900, holder.current?.clientWidth ?? 800));
        for (let n = 1; n <= shown; n++) {
          if (cancelled) return;
          const page = await doc.getPage(n);
          const base = page.getViewport({ scale: 1 });
          const scale = (width / base.width) * Math.min(2, window.devicePixelRatio || 1);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
          canvas.style.width = '100%'; canvas.style.height = 'auto';
          canvas.className = 'mx-auto mb-3 max-w-[900px] bg-white shadow-sm';
          canvas.setAttribute('role', 'img');
          canvas.setAttribute('aria-label', `${title}, page ${n}`);
          await page.render({ canvas, viewport }).promise;
          if (cancelled) return;
          holder.current?.appendChild(canvas);
        }
        if (!cancelled) setState({ status: 'ready', pages: doc.numPages, shown });
      } catch {
        if (!cancelled) setState({ status: 'error', pages: 0, shown: 0 });
      }
    })();
    const node = holder.current;
    return () => { cancelled = true; void destroy?.(); if (node) node.innerHTML = ''; };
  }, [blob, title]);

  return <div className="p-3">
    {state.status === 'loading' && <p role="status" className="text-center text-sm text-muted py-6">{t('Opening the report…')}</p>}
    {state.status === 'error' && <p role="alert" className="text-center text-sm text-rose-800 py-6">{t('This PDF could not be shown here. Use Download to open it.')}</p>}
    <div ref={holder} data-testid="pdf-pages" />
    {state.status === 'ready' && state.pages > state.shown && <p className="text-center text-xs text-muted">{t('Showing the first {n} pages. Download the file to see all {total}.', { n: state.shown, total: state.pages })}</p>}
  </div>;
}
