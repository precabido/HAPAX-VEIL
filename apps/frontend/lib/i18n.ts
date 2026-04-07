'use client';

export type Lang = 'es' | 'en';

export function getStoredLang(): Lang {
  if (typeof window === 'undefined') return 'en';
  const stored = window.localStorage.getItem('hapax-lang');
  return stored === 'es' || stored === 'en' ? stored : 'en';
}

export function setStoredLang(lang: Lang) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('hapax-lang', lang);
  window.dispatchEvent(new CustomEvent('hapax-lang-change', { detail: lang }));
}

export function onLangChange(callback: (lang: Lang) => void) {
  const handler = (event: Event) => {
    const custom = event as CustomEvent<Lang>;
    if (custom.detail === 'es' || custom.detail === 'en') {
      callback(custom.detail);
    }
  };

  window.addEventListener('hapax-lang-change', handler as EventListener);
  return () => window.removeEventListener('hapax-lang-change', handler as EventListener);
}