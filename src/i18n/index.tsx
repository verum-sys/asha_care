import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CareTier } from '../db/types';
import { applyTerms } from './terms';
import { en, type MessageKey } from './en';
import { hi } from './hi';
import { hiExtra } from './hiExtra';

export type Lang = 'en' | 'hi';
const DICTS: Record<Lang, Partial<Record<string, string>>> = { en, hi: { ...hiExtra, ...hi } };
const STORAGE_KEY = 'carelink.lang';

type Params = Record<string, string | number | undefined>;
export type T = (key: string, params?: Params) => string;

function readLang(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'hi' ? 'hi' : 'en';
  } catch {
    return 'en';
  }
}

export function translate(lang: Lang, key: string, params?: Params, tier?: CareTier): string {
  return applyTerms(lookup(lang, key, params), lang, tier);
}

function lookup(lang: Lang, key: string, params?: Params): string {
  const dict = DICTS[lang];
  const raw = (dict[key as MessageKey] ?? en[key as MessageKey] ?? key) as string;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, name: string) => {
    const v = params[name];
    if (v === undefined) return '';
    // Params may themselves be message keys (e.g. "attendance.attended").
    if (typeof v === 'string' && v in en) return lookup(lang, v);
    return String(v);
  });
}

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Care tier the screen belongs to; decides "community member" (ASHA, PHC) vs "patient" (DH, TCC). */
  setTermTier: (tier: CareTier | undefined) => void;
  t: T;
  formatDate: (iso?: string) => string;
  formatDateTime: (iso: string) => string;
}

const Ctx = createContext<LangCtx | null>(null);
const FALLBACK: LangCtx = {
  lang: 'en', setLang: () => undefined, setTermTier: () => undefined, t: (key, params) => translate('en', key, params, 'dh'), // 'dh' = leave the word "patient" as written outside the provider
  formatDate: iso => (iso ? iso.slice(0, 10) : '—'), formatDateTime: iso => iso,
};

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readLang);
  const [tier, setTermTier] = useState<CareTier | undefined>(undefined);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* private mode: language just won't persist */
    }
    document.documentElement.lang = l;
  }, []);

  const value = useMemo<LangCtx>(() => {
    const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
    return {
      lang,
      setLang,
      setTermTier,
      t: (key, params) => translate(lang, key, params, tier),
      formatDate: (iso) => {
        if (!iso) return '—';
        const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
        return new Date(y, m - 1, d).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
      },
      formatDateTime: (iso) =>
        new Date(iso).toLocaleString(locale, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }),
    };
  }, [lang, setLang, tier]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang(): LangCtx {
  // Outside a provider (isolated renders) fall back to English rather than crashing.
  return useContext(Ctx) ?? FALLBACK;
}

/** Declare which care tier a screen belongs to so wording follows it (resets to the ASHA default when the screen closes). */
export function useTermTier(tier: CareTier | undefined) {
  const { setTermTier } = useLang();
  useEffect(() => {
    setTermTier(tier);
    return () => setTermTier(undefined);
  }, [tier, setTermTier]);
}
