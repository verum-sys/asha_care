/**
 * A plain one-page PDF of text lines (Helvetica, A4), as a base64 data URL. Used for the demo reports so they are real,
 * readable PDFs. ASCII text only.
 */
export function textPdfDataUrl(title: string, lines: string[]): string {
  const esc = (s: string) => s.replace(/[^\x20-\x7e]/g, '-').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  // Wrap long lines at about 90 characters so they stay on the page.
  const wrapped = lines.flatMap(line => {
    if (line.length <= 90) return [line];
    const out: string[] = []; let current = '';
    for (const word of line.split(' ')) { if ((current + ' ' + word).trim().length > 90) { out.push(current); current = word; } else current = (current + ' ' + word).trim(); }
    return current ? [...out, current] : out;
  }).slice(0, 60);
  const body = [`BT /F1 15 Tf 50 790 Td (${esc(title)}) Tj ET`, ...wrapped.map((line, i) => `BT /F1 10 Tf 50 ${760 - i * 14} Td (${esc(line)}) Tj ET`)].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    `<< /Length ${body.length} >>\nstream\n${body}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((obj, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return `data:application/pdf;base64,${btoa(pdf)}`;
}
