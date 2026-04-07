'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { getStoredLang, onLangChange, setStoredLang, type Lang } from '../lib/i18n';

const DICT = {
  es: {
    brand: 'HAPAX VEIL',
    home: 'Inicio',
    about: 'Acerca de',
    how: 'Cómo funciona',
    security: 'Seguridad',
    faq: 'FAQ',
    menu: 'Menú',
    toggle: 'EN'
  },
  en: {
    brand: 'HAPAX VEIL',
    home: 'Home',
    about: 'About',
    how: 'How it works',
    security: 'Security',
    faq: 'FAQ',
    menu: 'Menu',
    toggle: 'ES'
  }
} as const;

export default function Topbar() {
  const [lang, setLang] = useState<Lang>('en');
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLang(getStoredLang());
    return onLangChange(setLang);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const t = DICT[lang];

  function toggleLang() {
    setStoredLang(lang === 'en' ? 'es' : 'en');
  }

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="brand-logo-main-link" aria-label={t.home}>
          <img
            src="/branding/logo_hapax_veil_2.png"
            alt={t.brand}
            className="brand-logo-main-img"
          />
        </Link>

        <div className="topbar-actions">
          <div className="brand-menu-wrap" ref={dropdownRef}>
            <button
              type="button"
              className={`brand-menu-logo-button ${menuOpen ? 'is-open' : ''}`}
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label={t.menu}
              aria-expanded={menuOpen}
            >
              <img
                src="/branding/logo_hapax_veil.png"
                alt={`${t.brand} menu`}
                className="brand-menu-logo-img"
              />
            </button>

            <div className={`brand-dropdown ${menuOpen ? 'is-open' : ''}`}>
              <Link href="/" onClick={() => setMenuOpen(false)}>{t.home}</Link>
              <Link href="/about" onClick={() => setMenuOpen(false)}>{t.about}</Link>
              <Link href="/how-it-works" onClick={() => setMenuOpen(false)}>{t.how}</Link>
              <Link href="/security" onClick={() => setMenuOpen(false)}>{t.security}</Link>
              <Link href="/faq" onClick={() => setMenuOpen(false)}>{t.faq}</Link>
            </div>
          </div>

          <button type="button" className="lang-toggle" onClick={toggleLang}>
            {t.toggle}
          </button>
        </div>
      </div>
    </header>
  );
}