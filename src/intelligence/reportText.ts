import type { ReportAttachment } from '../db/types';
import { reportFileBlob } from './reportFile';
import { openPdf } from './pdf';

export interface ReportText { text: string; source: 'text' | 'ocr'; pages: number }
export type ReadProgress = (step: 'opening' | 'reading' | 'ocr', detail?: { page?: number; pages?: number; percent?: number }) => void;

const MAX_PAGES = 6;
/** A page with less text than this is treated as a scanned image and read with OCR. */
const MIN_TEXT_PER_PAGE = 40;

async function ocrSources(sources: (HTMLCanvasElement | Blob)[], onProgress?: ReadProgress): Promise<string[]> {
  const { createWorker } = await import('tesseract.js');
  let page = 0;
  // Served from CareLink's own site (see vite.config.ts), so OCR does not depend on a public CDN.
  const base = new URL(`${import.meta.env.BASE_URL}ocr/`, location.origin).href;
  const worker = await createWorker('eng', 1, { workerPath: `${base}worker.min.js`, corePath: `${base}tesseract-core-lstm.wasm.js`, langPath: base.replace(/\/$/, ''), workerBlobURL: false, logger: m => { if (m.status === 'recognizing text') onProgress?.('ocr', { page: page + 1, pages: sources.length, percent: Math.round(m.progress * 100) }); } });
  try {
    const out: string[] = [];
    for (; page < sources.length; page++) out.push((await worker.recognize(sources[page])).data.text);
    return out;
  } finally { await worker.terminate(); }
}

/**
 * Reads the text of an uploaded report on this device. A digital PDF gives its text directly; a scanned PDF or a photo
 * is read with OCR. The file itself never leaves the device.
 */
export async function readReportText(report: Pick<ReportAttachment, 'dataUrl' | 'fileUrl' | 'fileType'>, onProgress?: ReadProgress): Promise<ReportText> {
  onProgress?.('opening');
  const blob = await reportFileBlob(report);
  if (!blob) throw new Error('No file is stored for this report, so there is nothing to read.');
  if (blob.type.startsWith('image/')) {
    const [text] = await ocrSources([blob], onProgress);
    return { text: text.trim(), source: 'ocr', pages: 1 };
  }

  const { task, doc } = await openPdf(new Uint8Array(await blob.arrayBuffer()));
  try {
    const pages = Math.min(doc.numPages, MAX_PAGES);
    const texts: string[] = [];
    const scanned: number[] = [];
    for (let n = 1; n <= pages; n++) {
      onProgress?.('reading', { page: n, pages });
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const text = content.items.map(item => ('str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '')).join('').replace(/[ \t]+/g, ' ').trim();
      texts.push(text);
      if (text.replace(/\s/g, '').length < MIN_TEXT_PER_PAGE) scanned.push(n);
    }
    if (!scanned.length) return { text: texts.join('\n\n'), source: 'text', pages };

    // Scanned pages: draw each one and read it with OCR.
    const canvases: HTMLCanvasElement[] = [];
    for (const n of scanned) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, viewport }).promise;
      canvases.push(canvas);
    }
    const ocr = await ocrSources(canvases, onProgress);
    scanned.forEach((n, i) => { texts[n - 1] = ocr[i].trim(); });
    return { text: texts.join('\n\n').trim(), source: 'ocr', pages };
  } finally { await task.destroy(); }
}

/** Takes the patient's name, phone and ID out of the text before it goes to the AI service. */
export function redactPatient(text: string, patient: { name?: string; phone?: string; id?: string }): string {
  let out = text;
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const name = (patient.name ?? '').replace(/\(demo\)/i, '').trim();
  // Whole words only (works for Devanagari too), so a short name never cuts into other words.
  const word = (w: string) => new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])${escape(w)}(?![\\p{L}\\p{M}\\p{N}])`, 'giu');
  if (name) {
    out = out.replace(word(name), '[patient]');
    for (const part of name.split(/\s+/).filter(p => p.length >= 3)) out = out.replace(word(part), '[patient]');
  }
  const phone = (patient.phone ?? '').replace(/\D/g, '').slice(-10);
  if (phone.length === 10) out = out.replace(new RegExp(phone.split('').join('[\\s-]?'), 'g'), '[phone]');
  if (patient.id) out = out.replace(new RegExp(escape(patient.id), 'gi'), '[id]');
  return out.replace(/\(demo\)/gi, '');
}
