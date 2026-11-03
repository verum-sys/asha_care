import { useEffect, useState } from 'react';
import { useLang } from '../i18n';
import type { ReportAttachment } from '../db/types';
import { Icon } from './Icon';
import { reportFileBlob } from '../intelligence/reportFile';
import { PdfPages } from './PdfPages';

interface PdfViewerModalProps {
  attachment: ReportAttachment | null;
  patientName?: string;
  patientId?: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Shows the uploaded report itself and downloads the original file. Older demo records carry no file, only the typed
 * findings; those are shown as text and downloaded as a text file, clearly labelled as such.
 */
export function PdfViewerModal({ attachment, patientName = '', patientId = '', isOpen, onClose }: PdfViewerModalProps) {
  const { t, formatDate } = useLang();
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileBlob, setFileBlob] = useState<Blob | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isOpen || !attachment) return;
    let url: string | null = null;
    let cancelled = false;
    setFileUrl(null); setFileBlob(null); setFailed(false);
    reportFileBlob(attachment)
      .then(blob => { if (!cancelled && blob) { url = URL.createObjectURL(blob); setFileUrl(url); setFileBlob(blob); } })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [isOpen, attachment]);

  if (!isOpen || !attachment) return null;

  const download = () => {
    const link = document.createElement('a');
    if (fileUrl) {
      link.href = fileUrl;
      link.download = attachment.fileName || `${attachment.title}.pdf`;
      link.click();
      return;
    }
    const text = [`${attachment.title}`, `${patientName}${patientId ? ` (${patientId})` : ''}`, `Uploaded ${formatDate(attachment.uploadedAt.slice(0, 10))} by ${attachment.uploadedBy}`, '', 'Findings recorded in CareLink:', attachment.findings || '—'].join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    link.href = url;
    link.download = `${(attachment.fileName || attachment.title).replace(/\.pdf$/i, '')}_findings.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={attachment.title} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[90vh]">
        <div className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-bold truncate">{attachment.title}</div>
            <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2">
              <span className="truncate">{attachment.fileName}</span>
              {attachment.fileSize && <><span>•</span><span>{attachment.fileSize}</span></>}
              <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 font-bold">{attachment.category}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={download} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white flex items-center gap-1.5">
              <Icon name="download" size={14} /><span>{fileUrl ? t('Download') : t('Download findings')}</span>
            </button>
            <button type="button" onClick={onClose} aria-label={t('Close Viewer')} className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white">
              <Icon name="back" size={18} className="rotate-180" />
            </button>
          </div>
        </div>

        <div className="flex-1 bg-slate-100 overflow-y-auto">
          {fileBlob ? (
            fileBlob.type.startsWith('image/')
              ? <img src={fileUrl ?? undefined} alt={attachment.title} className="mx-auto my-3 max-w-full bg-white" />
              : <PdfPages blob={fileBlob} title={attachment.title} />
          ) : (
            <div className="max-w-2xl mx-auto m-6 bg-white rounded-xl border border-slate-200 p-6 space-y-4">
              <p className="text-xs rounded-lg bg-amber-50 border border-amber-200 text-amber-900 p-2.5">
                {failed ? t('The report file could not be opened. Showing the findings recorded in CareLink.') : t('No PDF file is stored for this report. Showing the findings recorded in CareLink.')}
              </p>
              <dl className="grid grid-cols-2 gap-3 text-xs">
                {patientName && <div><dt className="text-slate-400 uppercase font-bold text-[10px]">{t('Patient Name')}</dt><dd className="font-bold text-slate-800 text-sm">{patientName}</dd></div>}
                {patientId && <div><dt className="text-slate-400 uppercase font-bold text-[10px]">{t('Patient ID')}</dt><dd className="font-mono font-bold text-slate-800 text-sm">{patientId}</dd></div>}
                <div><dt className="text-slate-400 uppercase font-bold text-[10px]">{t('Uploaded by')}</dt><dd className="text-slate-700">{attachment.uploadedBy}</dd></div>
                <div><dt className="text-slate-400 uppercase font-bold text-[10px]">{t('Uploaded on')}</dt><dd className="text-slate-700">{formatDate(attachment.uploadedAt.slice(0, 10))}</dd></div>
              </dl>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1 mb-2">{t('Findings')}</h3>
                <p className="rounded-lg bg-slate-50 p-3 border border-slate-200 text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">{attachment.findings || t('No findings were typed for this report.')}</p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white border-t border-slate-200 px-5 py-2.5 flex justify-end">
          <button type="button" onClick={onClose} className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700">{t('Close Viewer')}</button>
        </div>
      </div>
    </div>
  );
}
