'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getStoredLang, onLangChange, type Lang } from '../../lib/i18n';

const DICT = {
  es: {
    eyebrow: 'Acerca de',
    title: 'Qué es HAPAX VEIL hoy',
    intro:
      'HAPAX VEIL es una plataforma self-hosted para compartir mensajes y adjuntos cifrados mediante enlaces autodestructivos, con foco en privacidad operativa, lifecycle corto y UX simple.',
    navHome: 'Inicio',
    navHow: 'Cómo funciona',
    navSecurity: 'Seguridad',
    navFaq: 'FAQ',
    sections: [
      {
        title: 'Qué hace realmente',
        body: [
          'HAPAX VEIL no es un chat persistente, no es un drive compartido y no está pensado para histórico. Sirve para entregar contenido sensible de forma temporal y con caducidad real.',
          'El usuario crea un enlace, cifra en cliente, comparte la URL y decide expiración, lecturas máximas, contraseña opcional, duress password y revocación.'
        ]
      },
      {
        title: 'Cómo está construido ahora',
        body: [
          'El frontend usa Next.js App Router. El backend usa Fastify. PostgreSQL almacena ciphertext y estado de lifecycle. Nginx actúa como reverse proxy interno. Todo se despliega con Docker Compose en VPS.',
          'El runtime actual ya no depende del QR externo. El enlace puede incluir clave o datos de preview en el fragmento #, que el servidor no recibe en una petición HTTP normal.'
        ]
      },
      {
        title: 'Qué protege y qué no',
        body: [
          'Protege frente a almacenamiento del secreto en claro en el backend y reduce persistencia mediante expiración, consumo y revocación.',
          'No evita capturas, malware local, keyloggers ni exfiltración una vez el destinatario abre el contenido.'
        ]
      },
      {
        title: 'Estado funcional actual',
        body: [
          'La plataforma ya soporta mensajes, adjuntos, QR local, passphrase, duress password con decoy de texto, hidden mode, revocación con manage token y limpieza automática de secretos consumidos, expirados o revocados.',
          'El título del secreto puede verse antes de abrir, pero ya no sale desde la API de preview.'
        ]
      },
      {
        title: 'Límite práctico actual',
        body: [
          'El runtime sigue usando una subida HTTP única al origen. Por eso el límite práctico de adjuntos depende del tamaño final cifrado y del edge delante del servicio.',
          'Mientras no exista chunking real, la plataforma auto-activa ZIP cifrado cuando conviene y avisa con errores visibles si el paquete final sigue siendo demasiado grande.'
        ]
      }
    ]
  },
  en: {
    eyebrow: 'About',
    title: 'What HAPAX VEIL is today',
    intro:
      'HAPAX VEIL is a self-hosted platform for sharing encrypted messages and attachments through self-destructing links, focused on operational privacy, short lifecycle, and simple UX.',
    navHome: 'Home',
    navHow: 'How it works',
    navSecurity: 'Security',
    navFaq: 'FAQ',
    sections: [
      {
        title: 'What it actually does',
        body: [
          'HAPAX VEIL is not a persistent chat, not a shared drive, and not intended for long-term history. It is built for short-lived delivery of sensitive content.',
          'A user creates a link, encrypts in the browser, shares the URL, and chooses expiration, max reads, optional passphrase, duress password, and revocation.'
        ]
      },
      {
        title: 'How it is built now',
        body: [
          'The frontend runs on Next.js App Router. The backend runs on Fastify. PostgreSQL stores ciphertext and lifecycle state. Nginx acts as the internal reverse proxy. Everything is deployed with Docker Compose on a VPS.',
          'The current runtime no longer depends on an external QR provider. The link can carry key material or preview data inside the # fragment, which the server does not receive in a normal HTTP request.'
        ]
      },
      {
        title: 'What it protects and what it does not',
        body: [
          'It protects against backend plaintext storage and reduces persistence through expiration, consumption, and revocation.',
          'It does not prevent screenshots, local malware, keyloggers, or exfiltration after the recipient opens the content.'
        ]
      },
      {
        title: 'Current functional state',
        body: [
          'The platform already supports messages, attachments, local QR, passphrase, duress password with text-only decoy, hidden mode, manage-token revocation, and automatic cleanup of consumed, expired, or revoked secrets.',
          'The secret title can be shown before opening, but it is no longer exposed by the preview API.'
        ]
      },
      {
        title: 'Current practical limit',
        body: [
          'The runtime still uses a single HTTP upload to the origin. Because of that, the practical attachment limit depends on the final encrypted payload size and the edge in front of the service.',
          'Until real chunking exists, the platform auto-enables encrypted ZIP when useful and shows explicit errors if the final package is still too large.'
        ]
      }
    ]
  }
} as const;

export default function AboutPage() {
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
            <Link href="/how-it-works" className="pill interactive-pill">{t.navHow}</Link>
            <Link href="/security" className="pill interactive-pill">{t.navSecurity}</Link>
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

