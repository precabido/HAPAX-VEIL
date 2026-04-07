'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getStoredLang, onLangChange, type Lang } from '../../lib/i18n';

const DICT = {
  es: {
    eyebrow: 'FAQ',
    title: 'Preguntas frecuentes',
    intro:
      'Respuestas directas sobre funcionamiento, límites y uso correcto de la plataforma en su estado actual.',
    navHome: 'Inicio',
    navAbout: 'Acerca de',
    navHow: 'Cómo funciona',
    navSecurity: 'Seguridad',
    items: [
      {
        q: '¿El servidor puede leer mis secretos?',
        a: 'No debería necesitar leerlos para operar. El flujo principal cifra en cliente y el backend trabaja con ciphertext y lifecycle.'
      },
      {
        q: '¿Por qué sigo viendo el título antes de abrir?',
        a: 'Porque el título ya no sale desde la API de preview. Se transporta en el fragmento del enlace para seguir siendo visible sin exponerlo desde el backend.'
      },
      {
        q: '¿Qué devuelve la preview API ahora?',
        a: 'Solo confirma si el enlace sigue vivo y, si existe passphrase, cuántos intentos quedan. No devuelve mensaje, adjuntos ni título.'
      },
      {
        q: '¿Qué hace la duress password?',
        a: 'Destruye el secreto real y solo puede devolver un decoy de texto si lo configuraste. No mostrará los archivos reales del enlace.'
      },
      {
        q: '¿Qué pasa al consumir, expirar o revocar un enlace?',
        a: 'El registro se elimina y además hay cleanup periódico para barrer cualquier resto pendiente.'
      },
      {
        q: '¿Cuál es el límite de adjuntos?',
        a: 'El límite práctico depende del tamaño final cifrado que termina viajando en una sola petición HTTP. Si varios archivos superan ese umbral, la web activa ZIP cifrado automáticamente e informa si aún así no cabe.'
      },
      {
        q: '¿Entonces ya soporta archivos grandes ilimitados?',
        a: 'No. Para eso hace falta chunking real, almacenamiento por partes y reensamblado, que pertenece a la siguiente fase.'
      },
      {
        q: '¿Puedo publicar ya el proyecto?',
        a: 'Todavía falta una pasada final de repo sanitation, documentación open source y revisión de secretos/artefactos antes de subirlo a GitHub.'
      }
    ]
  },
  en: {
    eyebrow: 'FAQ',
    title: 'Frequently asked questions',
    intro:
      'Direct answers about behavior, limits, and correct usage of the platform in its current state.',
    navHome: 'Home',
    navAbout: 'About',
    navHow: 'How it works',
    navSecurity: 'Security',
    items: [
      {
        q: 'Can the server read my secrets?',
        a: 'It should not need to. The main flow encrypts client-side and the backend operates on ciphertext and lifecycle state.'
      },
      {
        q: 'Why do I still see the title before opening?',
        a: 'Because the title no longer comes from the preview API. It travels inside the link fragment so it remains visible without exposing it from the backend.'
      },
      {
        q: 'What does the preview API return now?',
        a: 'It only confirms whether the link is still alive and, if a passphrase exists, how many attempts remain. It does not return message, attachments, or title.'
      },
      {
        q: 'What does the duress password do?',
        a: 'It destroys the real secret and can only return a text decoy if you configured one. It will not show the real files behind the link.'
      },
      {
        q: 'What happens when a link is consumed, expired, or revoked?',
        a: 'The record is deleted, and a periodic cleanup loop also removes any pending residue.'
      },
      {
        q: 'What is the attachment limit?',
        a: 'The practical limit depends on the final encrypted payload size that still travels in a single HTTP request. If multiple files cross that threshold, the web auto-enables encrypted ZIP and reports clearly if the final package is still too large.'
      },
      {
        q: 'So does it already support unlimited large files?',
        a: 'No. Real large-file support requires chunking, segmented storage, and reassembly, which belongs to the next phase.'
      },
      {
        q: 'Can I publish the project already?',
        a: 'Not yet. One final repo sanitation pass, open-source documentation set, and secrets/artifacts review should happen before pushing to GitHub.'
      }
    ]
  }
} as const;

export default function FaqPage() {
  const [lang, setLang] = useState<Lang>('en');

  useEffect(() => {
    setLang(getStoredLang());
    return onLangChange(setLang);
  }, []);

  const t = DICT[lang];

  return (
    <main>
      <div className="shell doc-page">
        <section className="panel doc-hero interactive-panel">
          <div className="eyebrow">{t.eyebrow}</div>
          <h1>{t.title}</h1>
          <p>{t.intro}</p>
          <div className="meta-inline">
            <Link href="/" className="pill interactive-pill">{t.navHome}</Link>
            <Link href="/about" className="pill interactive-pill">{t.navAbout}</Link>
            <Link href="/how-it-works" className="pill interactive-pill">{t.navHow}</Link>
            <Link href="/security" className="pill interactive-pill">{t.navSecurity}</Link>
          </div>
        </section>

        {t.items.map((item) => (
          <section key={item.q} className="panel interactive-panel doc-card">
            <h2>{item.q}</h2>
            <p>{item.a}</p>
          </section>
        ))}
      </div>
    </main>
  );
}

