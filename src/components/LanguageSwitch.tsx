import { useLang } from '../i18n';

/** Both languages visible at once, the current one marked. */
export function LanguageSwitch() {
  const { lang, setLang, t } = useLang();
  const option = (code: 'en' | 'hi', label: string) => (
    <button
      type="button"
      key={code}
      aria-pressed={lang === code}
      lang={code}
      onClick={() => setLang(code)}
      className={`px-2.5 py-1 text-xs font-semibold transition-colors ${lang === code ? 'bg-brand text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
    >
      {label}
    </button>
  );
  return (
    <div role="group" aria-label={t('Change language')} className="inline-flex shrink-0 overflow-hidden rounded-lg border border-line">
      {option('en', 'English')}
      {option('hi', 'हिंदी')}
    </div>
  );
}
