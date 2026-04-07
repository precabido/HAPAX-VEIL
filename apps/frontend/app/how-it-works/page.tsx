'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getStoredLang, onLangChange, type Lang } from '../../lib/i18n';

const DICT = {
  es: {
    eyebrow: 'Cómo funciona',
    title: 'Flujo real del secreto',
    intro:
      'Resumen operativo de lo que ocurre desde que creas el enlace hasta que se consume o desaparece.',
    navHome: 'Inicio',
    navAbout: 'Acerca de',
    navSecurity: 'Seguridad',
    navFaq: 'FAQ',
    steps: [
      {
        title: '1. Creación en navegador',
        body: 'El mensaje y los adjuntos se empaquetan en tu navegador. Si conviene por tamaño o por cantidad de archivos, se puede activar ZIP cifrado antes del envío.'
      },
      {
        title: '2. Cifrado del contenido',
        body: 'El contenido principal se cifra en cliente. Si activas passphrase, la clave de contenido queda envuelta con una clave derivada de esa passphrase.'
      },
      {
        title: '3. Construcción del enlace',
        body: 'La URL final contiene un fragmento # con lo necesario para abrir o gestionar el secreto: clave raw o modo locked, manage token y datos mínimos de preview como el título visible antes de abrir.'
      },
      {
        title: '4. Persistencia del backend',
        body: 'El backend guarda ciphertext, IV, lifecycle y solo la metadata mínima para validar apertura, intentos, duress y revocación. El título ya no se expone desde la API de status.'
      },
      {
        title: '5. Preview segura',
        body: 'La pantalla /s/:id consulta si el enlace sigue vivo, pero el título y el hidden mode vienen del fragmento local, no del servidor.'
      },
      {
        title: '6. Apertura',
        body: 'Si el secreto requiere passphrase, el usuario la introduce y el backend valida intentos. Si es correcta, el frontend descifra localmente. Si no, se consume un intento.'
      },
      {
        title: '7. Duress',
        body: 'Si se usa la duress password, el backend destruye el secreto real y solo entrega el decoy de texto si existe. Los archivos reales nunca se muestran en duress.'
      },
      {
        title: '8. Limpieza',
        body: 'Cuando un secreto se consume, expira, se revoca o agota intentos, el registro se elimina. Además existe cleanup periódico para barrer cualquier residuo pendiente.'
      }
    ]
  },
  en: {
    eyebrow: 'How it works',
    title: 'Real secret lifecycle',
    intro:
      'Operational summary of what happens from link creation to consumption or removal.',
    navHome: 'Home',
    navAbout: 'About',
    navSecurity: 'Security',
    navFaq: 'FAQ',
    steps: [
      {
        title: '1. Browser-side creation',
        body: 'Message and attachments are packaged in your browser. When useful because of size or multiple files, encrypted ZIP can be enabled before sending.'
      },
      {
        title: '2. Content encryption',
        body: 'Main content is encrypted client-side. If you enable a passphrase, the content key is wrapped using a key derived from that passphrase.'
      },
      {
        title: '3. Link construction',
        body: 'The final URL carries a # fragment with what is needed to open or manage the secret: raw key or locked mode, manage token, and minimal preview data such as the title shown before opening.'
      },
      {
        title: '4. Backend persistence',
        body: 'The backend stores ciphertext, IV, lifecycle state, and only the minimum metadata required for opening, attempts, duress, and revocation. The title is no longer exposed by the status API.'
      },
      {
        title: '5. Safe preview',
        body: 'The /s/:id screen only checks whether the link is still alive. The title and hidden mode come from the local fragment, not from the server.'
      },
      {
        title: '6. Opening',
        body: 'If the secret requires a passphrase, the user enters it and the backend enforces attempt limits. If valid, the frontend decrypts locally. If invalid, an attempt is consumed.'
      },
      {
        title: '7. Duress',
        body: 'If the duress password is used, the backend destroys the real secret and only returns the text decoy if one exists. Real files are never shown in duress mode.'
      },
      {
        title: '8. Cleanup',
        body: 'When a secret is consumed, expires, is revoked, or exhausts attempts, the record is removed. A periodic cleanup loop also removes any pending residue.'
      }
    ]
  }
} as const;

export default function HowItWorksPage() {
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
            <Link href="/security" className="pill interactive-pill">{t.navSecurity}</Link>
            <Link href="/faq" className="pill interactive-pill">{t.navFaq}</Link>
          </div>
        </section>

        {t.steps.map((step) => (
          <section key={step.title} className="panel interactive-panel doc-card">
            <h2>{step.title}</h2>
            <p>{step.body}</p>
          </section>
        ))}
      </div>
    </main>
  );
}

