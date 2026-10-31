import { useLang } from '../i18n';

/** Shown once, on first launch: pick English or हिंदी before anything else. Never shown again after a choice. */
export function LanguageChoice() {
  const { langChosen, setLang } = useLang();
  if (langChosen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4" role="dialog" aria-modal="true" aria-labelledby="lang-choice-title">
      <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 shadow-2xl">
        <h2 id="lang-choice-title" className="text-center text-xl font-bold">
          Choose your language
          <span className="block text-lg">भाषा चुनें</span>
        </h2>
        <div className="grid gap-3">
          <button type="button" lang="en" className="btn btn-primary !min-h-[56px] text-lg font-bold" onClick={() => setLang('en')}>English</button>
          <button type="button" lang="hi" className="btn btn-primary !min-h-[56px] text-lg font-bold" onClick={() => setLang('hi')}>हिंदी</button>
        </div>
      </div>
    </div>
  );
}
