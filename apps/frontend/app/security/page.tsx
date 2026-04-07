'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getStoredLang, onLangChange, type Lang } from '../../lib/i18n';

const DICT = {
  es: {
    eyebrow: 'Seguridad',
    title: 'Modelo de seguridad actual',
    intro:
      'Qué protege hoy la plataforma, qué tradeoffs tiene y qué límites reales siguen existiendo.',
    navHome: 'Inicio',
    navAbout: 'Acerca de',
    navHow: 'Cómo funciona',
    navFaq: 'FAQ',
    sections: [
      {
        title: '1. Cifrado en cliente',
        body: [
          'El contenido principal se cifra en el navegador antes de enviarse. El backend recibe ciphertext, IV y estado del lifecycle.',
          'Esto reduce exposición del secreto en el servidor y evita depender del backend para procesar el plaintext.'
        ]
      },
      {
        title: '2. Fragmento #',
        body: [
          'La clave raw o el modo locked viven en el fragmento # del enlace. Ese fragmento no viaja al servidor en una petición HTTP normal.',
          'El título visible antes de abrir también puede viajar en el fragmento para evitar que la API de preview lo exponga.'
        ]
      },
      {
        title: '3. Preview mínima',
        body: [
          'La ruta de preview solo confirma si el secreto sigue activo y, si aplica, cuántos intentos quedan. No devuelve título, mensaje, adjuntos ni verificadores offline.',
          'Con ello se reduce la superficie para enumeración contextual y cracking offline.'
        ]
      },
      {
        title: '4. Passphrase y verificadores',
        body: [
          'La passphrase envuelve la content key en cliente. Para limitar intentos online, el backend mantiene un verificador endurecido y compatibilidad con secretos legacy.',
          'Si los intentos se agotan, el registro se elimina.'
        ]
      },
      {
        title: '5. Duress password',
        body: [
          'La duress password invalida el secreto real y solo puede devolver un decoy de texto. No revela los archivos reales del bundle.',
          'Es una respuesta operativa útil bajo presión, no una garantía absoluta frente a endpoint comprometido.'
        ]
      },
      {
        title: '6. Revocación y cleanup',
        body: [
          'La revocación ya no depende solo del UUID. Usa manage token. Cuando un secreto se consume, expira, se revoca o agota intentos, se elimina.',
          'El cleanup periódico sirve como red de seguridad adicional.'
        ]
      },
      {
        title: '7. Qué no promete',
        body: [
          'No evita screenshots, malware local, keyloggers, shoulder surfing ni copia del contenido una vez descifrado.',
          'Tampoco resuelve grandes ficheros de forma ilimitada mientras la plataforma siga usando subida HTTP única sin chunking real.'
        ]
      }
    ]
  },
  en: {
    eyebrow: 'Security',
    title: 'Current security model',
    intro:
      'What the platform protects today, which tradeoffs exist, and which real limits still remain.',
    navHome: 'Home',
    navAbout: 'About',
    navHow: 'How it works',
    navFaq: 'FAQ',
    sections: [
      {
        title: '1. Client-side encryption',
        body: [
          'Main content is encrypted in the browser before upload. The backend receives ciphertext, IV, and lifecycle state.',
          'This reduces server-side exposure and avoids relying on the backend to handle plaintext.'
        ]
      },
      {
        title: '2. URL fragment #',
        body: [
          'The raw key or locked mode lives in the # fragment of the link. That fragment is not sent to the server in a normal HTTP request.',
          'The title shown before opening can also live in the fragment so the preview API does not expose it.'
        ]
      },
      {
        title: '3. Minimal preview',
        body: [
          'The preview route only confirms whether the secret is still active and, when relevant, how many attempts remain. It does not return title, message, attachments, or offline verifiers.',
          'This reduces contextual enumeration and offline cracking surface.'
        ]
      },
      {
        title: '4. Passphrase and verifiers',
        body: [
          'The passphrase wraps the content key client-side. To enforce online attempt limits, the backend stores a hardened verifier and keeps compatibility with legacy secrets.',
          'When attempts are exhausted, the record is removed.'
        ]
      },
      {
        title: '5. Duress password',
        body: [
          'The duress password invalidates the real secret and can only return a text decoy. Real bundle files are never shown through duress.',
          'It is an operational response under pressure, not an absolute guarantee against a compromised endpoint.'
        ]
      },
      {
        title: '6. Revocation and cleanup',
        body: [
          'Revocation no longer depends only on the UUID. It uses a manage token. When a secret is consumed, expires, is revoked, or exhausts attempts, it is deleted.',
          'Periodic cleanup acts as an additional safety net.'
        ]
      },
      {
        title: '7. What it does not promise',
        body: [
          'It does not prevent screenshots, local malware, keyloggers, shoulder surfing, or copying once content is decrypted.',
          'It also does not solve unlimited large-file handling while the platform still relies on a single HTTP upload without real chunking.'
        ]
      }
    ]
  }
} as const;

export default function SecurityPage() {
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
            <Link href="/faq" className="pill interactive-pill">{t.navFaq}</Link>
          </div>
        </section>

        {t.sections.map((section) => (
          <section key={section.title} className="panel interactive-panel doc-card">
            <h2>{section.title}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}

