/** Loads PDF.js on demand (only DH and TCC open reports), with its worker served from CareLink's own site. */
export async function openPdf(data: Uint8Array) {
  const pdfjs = await import('pdfjs-dist');
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const task = pdfjs.getDocument({ data });
  return { task, doc: await task.promise };
}
