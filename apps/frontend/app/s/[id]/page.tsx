'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  type BundlePayload,
  type BundleProtectedFile,
  type BundlePlainFile,
  type WrappedKeyEnvelope,
  base64ToBytes,
  bytesToText,
  decodeFragment,
  decryptBytes,
  formatSize,
  importKeyFromBase64Url,
  unwrapContentKeyWithPassphrase
} from '../../../lib/veil';
import { getStoredLang, onLangChange, type Lang } from '../../../lib/i18n';

type StatusResponse = {
  ok: boolean;
  secretId: string;
  status: 'active' | 'burned' | 'expired' | 'revoked';
  expiresAt: string;
  remainingReads: number;
  maxReads: number;
  requiresPassphrase?: boolean;
  auth?: {
    failCount: number;
    maxAttempts: number;
    remainingAttempts: number;
  };
};

type OpenResponse = {
  ok: boolean;
  secretId: string;
  ciphertext: string;
  iv: string;
  algorithm: 'AES-256-GCM';
  mimeType: string;
  remainingReads: number;
  burned: boolean;
  duressTriggered: boolean;
  duressNoContent: boolean;
  selectedEnvelope: WrappedKeyEnvelope | null;
};

type RevealedFile = {
  name: string;
  type: string;
  size: number;
  url: string;
};


function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  const out = new Uint8Array(view.byteLength);
  out.set(view);
  return out.buffer;
}

const DICT = {
  es: {
    title: 'Reveal seguro',
    hiddenTitle: 'Abrir contenido protegido',
    intro:
      'Esta pantalla no consume la lectura hasta que pulses el botón de apertura.',
    invalid:
      'Enlace ya consumido, expirado o no encontrado.',
    hiddenBadge: 'Modo oculto',
    passphrase: 'Contraseña',
    downloadPassphrase: 'Contraseña adicional para desbloquear descargas',
    open: 'Abrir contenido',
    opening: 'Abriendo…',
    toggleReveal: 'Revelar visualmente',
    toggleHide: 'Ocultar contenido',
    countdownPrefix: 'El contenido visible en esta sesión se borrará en',
    countdownSuffix: 'seg',
    message: 'Mensaje',
    files: 'Archivos',
    download: 'Descargar',
    unlockFiles: 'Desbloquear archivos',
    unlocking: 'Desbloqueando…',
    duressNoContent:
      'El enlace ha quedado invalidado. No hay contenido visible para esta apertura.',
    duressNotice:
      'Se ha usado la contraseña duress. El secreto real ha quedado destruido.',
    passRequired: (n?: number) =>
      n !== undefined ? `Contraseña requerida. Intentos restantes: ${n}` : 'Contraseña requerida.',
    passInvalid: (n?: number) =>
      n !== undefined ? `Contraseña inválida. Intentos restantes: ${n}` : 'Contraseña inválida.',
    attemptsExceeded: 'Se agotaron los intentos. El secreto ha sido destruido.',
    missingFragment: 'Falta la clave de descifrado en el enlace.',
    missingEnvelope: 'No se encontró el envoltorio de clave.',
    enterPassphrase: 'Introduce la contraseña.',
    downloadPassRequired: 'Introduce la contraseña adicional de descarga.',
    downloadPassInvalid: 'Contraseña de descarga inválida.'
  },
  en: {
    title: 'Safe reveal',
    hiddenTitle: 'Open protected content',
    intro:
      'This screen does not consume a read until you press the open button.',
    invalid:
      'Link already consumed, expired, or not found.',
    hiddenBadge: 'Hidden mode',
    passphrase: 'Password',
    downloadPassphrase: 'Extra password to unlock file downloads',
    open: 'Open content',
    opening: 'Opening…',
    toggleReveal: 'Reveal visually',
    toggleHide: 'Hide content',
    countdownPrefix: 'Visible content in this session will be cleared in',
    countdownSuffix: 'sec',
    message: 'Message',
    files: 'Files',
    download: 'Download',
    unlockFiles: 'Unlock files',
    unlocking: 'Unlocking…',
    duressNoContent:
      'The link has been invalidated. No visible content is available for this opening.',
    duressNotice:
      'The duress password was used. The real secret has been destroyed.',
    passRequired: (n?: number) =>
      n !== undefined ? `Password required. Attempts remaining: ${n}` : 'Password required.',
    passInvalid: (n?: number) =>
      n !== undefined ? `Invalid password. Attempts remaining: ${n}` : 'Invalid password.',
    attemptsExceeded: 'Attempts exhausted. The secret has been destroyed.',
    missingFragment: 'Missing decryption key in URL fragment.',
    missingEnvelope: 'Missing wrapped key envelope.',
    enterPassphrase: 'Enter the password.',
    downloadPassRequired: 'Enter the extra file download password.',
    downloadPassInvalid: 'Invalid file download password.'
  }
} as const;

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function RevealPage() {
  const params = useParams<{ id: string }>();
  const secretId = typeof params?.id === 'string' ? params.id : '';

  const [lang, setLang] = useState<Lang>('en');
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [secretText, setSecretText] = useState('');
  const [files, setFiles] = useState<RevealedFile[]>([]);
  const [lockedFiles, setLockedFiles] = useState<BundleProtectedFile[]>([]);
  const [passphrase, setPassphrase] = useState('');
  const [downloadPassphrase, setDownloadPassphrase] = useState('');
  const [error, setError] = useState('');
  const [opening, setOpening] = useState(false);
  const [unlockingFiles, setUnlockingFiles] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [fragment, setFragment] = useState('');
  const [flashOpen, setFlashOpen] = useState(false);
  const [contentVisibleUntil, setContentVisibleUntil] = useState<number | null>(null);
  const [hiddenRevealed, setHiddenRevealed] = useState(false);
  const [duressNotice, setDuressNotice] = useState('');
  const [tickNow, setTickNow] = useState(Date.now());
  const [openedSuccessfully, setOpenedSuccessfully] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  useEffect(() => {
    setLang(getStoredLang());
    return onLangChange(setLang);
  }, []);

  const t = DICT[lang];

  useEffect(() => {
    setFragment(window.location.hash.replace(/^#/, ''));
  }, []);

  useEffect(() => {
    return () => {
      for (const file of files) {
        URL.revokeObjectURL(file.url);
      }
    };
  }, [files]);

  useEffect(() => {
    if (!contentVisibleUntil) return;

    const interval = window.setInterval(() => {
      setTickNow(Date.now());

      if (Date.now() >= contentVisibleUntil) {
        setSecretText('');
        for (const file of files) {
          URL.revokeObjectURL(file.url);
        }
        setFiles([]);
        setLockedFiles([]);
        setDuressNotice('');
        setContentVisibleUntil(null);
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [contentVisibleUntil, files]);

  useEffect(() => {
    if (!secretId) return;

    async function loadStatus() {
      setLoadingStatus(true);
      setError('');
      setInvalidLink(false);
      setRemainingAttempts(null);

      try {
        const res = await fetch(`/api/v1/secrets/${secretId}/status`, {
          cache: 'no-store'
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setInvalidLink(true);
          return;
        }

        const next = data as StatusResponse;

        if (next.status === 'burned' || next.status === 'expired' || next.status === 'revoked') {
          setInvalidLink(true);
          setStatus(next);
          return;
        }

        setStatus(next);
      } catch {
        setInvalidLink(true);
      } finally {
        setLoadingStatus(false);
      }
    }

    loadStatus();
  }, [secretId]);

  const decodedFragment = useMemo(() => decodeFragment(fragment), [fragment]);

  const requiresPassphrase = useMemo(() => {
    if (typeof status?.requiresPassphrase === 'boolean') {
      return status.requiresPassphrase;
    }
    return decodedFragment?.mode === 'locked';
  }, [status, decodedFragment]);

  const fragmentPreview =
    decodedFragment && 'preview' in decodedFragment ? decodedFragment.preview : undefined;
  const hiddenMode = Boolean(fragmentPreview?.hiddenMode);
  const previewTitle = fragmentPreview?.title?.trim() || '';

  async function handleOpen() {
    setFlashOpen(true);
    window.setTimeout(() => setFlashOpen(false), 320);

    setOpening(true);
    setError('');
    setSecretText('');
    setDuressNotice('');
    setHiddenRevealed(false);
    setOpenedSuccessfully(false);

    for (const file of files) {
      URL.revokeObjectURL(file.url);
    }
    setFiles([]);
    setLockedFiles([]);

    try {
      const res = await fetch(`/api/v1/secrets/${secretId}/open`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          passphrase
        })
      });

      const raw = await res.text();
      let data: OpenResponse | { code?: string; remainingAttempts?: number } = {};

      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(res.ok ? t.invalid : `HTTP ${res.status}`);
      }

      if (!res.ok) {
        const code = (data as { code?: string }).code;
        const remaining = (data as { remainingAttempts?: number }).remainingAttempts;

        if (code === 'PASSPHRASE_REQUIRED') {
          setRemainingAttempts(typeof remaining === 'number' ? remaining : null);
          throw new Error(t.passRequired(remaining));
        }

        if (code === 'PASSPHRASE_INVALID') {
          setRemainingAttempts(typeof remaining === 'number' ? remaining : null);
          throw new Error(t.passInvalid(remaining));
        }

        if (
          code === 'ATTEMPTS_EXCEEDED' ||
          code === 'NOT_FOUND' ||
          code === 'BURNED' ||
          code === 'EXPIRED' ||
          code === 'REVOKED'
        ) {
          setInvalidLink(true);
          throw new Error(t.invalid);
        }

        throw new Error(code || `HTTP ${res.status}`);
      }

      const opened = data as OpenResponse;

      if (opened.duressTriggered && opened.duressNoContent) {
        setDuressNotice(t.duressNoContent);
        setContentVisibleUntil(Date.now() + 5 * 60 * 1000);
        setOpenedSuccessfully(true);
        setStatus((prev) =>
          prev
            ? {
                ...prev,
                remainingReads: 0,
                status: 'burned'
              }
            : prev
        );
        return;
      }

      let payloadBytes: Uint8Array;

      if (requiresPassphrase) {
        if (!passphrase.trim()) {
          throw new Error(t.enterPassphrase);
        }

        if (!opened.selectedEnvelope) {
          throw new Error(t.missingEnvelope);
        }

        const contentKey = await unwrapContentKeyWithPassphrase(opened.selectedEnvelope, passphrase);
        payloadBytes = await decryptBytes(opened.ciphertext, opened.iv, contentKey);
      } else {
        if (!decodedFragment || decodedFragment.mode !== 'raw' || !decodedFragment.rawKey) {
          throw new Error(t.missingFragment);
        }

        const contentKey = await importKeyFromBase64Url(decodedFragment.rawKey);
        payloadBytes = await decryptBytes(opened.ciphertext, opened.iv, contentKey);
      }

      const bundleText = bytesToText(payloadBytes);

      let parsed: BundlePayload | null = null;
      try {
        parsed = JSON.parse(bundleText) as BundlePayload;
      } catch {
        parsed = null;
      }

      if (parsed && parsed.version === 2 && Array.isArray(parsed.files)) {
        setSecretText(parsed.message || '');

        if (opened.duressTriggered) {
          setFiles([]);
          setLockedFiles([]);
        } else {
          const nextFiles: RevealedFile[] = [];
          const protectedFiles: BundleProtectedFile[] = [];

          for (const file of parsed.files) {
            if (file.mode === 'plain') {
              const plain = file as BundlePlainFile;
              const bytes = base64ToBytes(plain.data);
              const blob = new Blob([toArrayBuffer(bytes)], { type: plain.type || 'application/octet-stream' });
              const url = URL.createObjectURL(blob);

              nextFiles.push({
                name: plain.name,
                type: plain.type,
                size: plain.size,
                url
              });
            } else {
              protectedFiles.push(file as BundleProtectedFile);
            }
          }

          setFiles(nextFiles);
          setLockedFiles(protectedFiles);
        }
      } else {
        setSecretText(bundleText);
        setFiles([]);
        setLockedFiles([]);
      }

      if (opened.duressTriggered) {
        setDuressNotice(t.duressNotice);
      }

      setOpenedSuccessfully(true);
      setRemainingAttempts(null);
      setContentVisibleUntil(Date.now() + 5 * 60 * 1000);

      setStatus((prev) =>
        prev
          ? {
              ...prev,
              remainingReads: opened.remainingReads,
              status: opened.burned ? 'burned' : 'active'
            }
          : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t.invalid);
    } finally {
      setOpening(false);
    }
  }

  async function handleUnlockFiles() {
    setUnlockingFiles(true);
    setError('');

    try {
      if (!downloadPassphrase.trim()) {
        throw new Error(t.downloadPassRequired);
      }

      const nextFiles: RevealedFile[] = [];

      for (const file of lockedFiles) {
        try {
          const fileKey = await unwrapContentKeyWithPassphrase(file.protection, downloadPassphrase);
          const bytes = await decryptBytes(file.ciphertext, file.iv, fileKey);
          const blob = new Blob([toArrayBuffer(bytes)], { type: file.type || 'application/octet-stream' });
          const url = URL.createObjectURL(blob);

          nextFiles.push({
            name: file.name,
            type: file.type,
            size: file.size,
            url
          });
        } catch {
          throw new Error(t.downloadPassInvalid);
        }
      }

      setFiles((prev) => [...prev, ...nextFiles]);
      setLockedFiles([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.downloadPassInvalid);
    } finally {
      setUnlockingFiles(false);
    }
  }

  const showAttempts =
    !openedSuccessfully &&
    !invalidLink &&
    requiresPassphrase &&
    typeof remainingAttempts === 'number';

  const countdownText =
    contentVisibleUntil && contentVisibleUntil > tickNow
      ? formatCountdown(contentVisibleUntil - tickNow)
      : null;

  return (
    <main>
      <div className="shell">
        <section className="panel grid">
          <div className="eyebrow">HAPAX VEIL</div>
          <h1>{hiddenMode ? t.hiddenTitle : t.title}</h1>
          <p>{t.intro}</p>
        </section>

        <section className="panel grid">
          {loadingStatus ? <div className="notice">Loading…</div> : null}

          {invalidLink ? <div className="notice error">{t.invalid}</div> : null}

          {!invalidLink && status && !openedSuccessfully ? (
            <div className="meta-inline">
              {hiddenMode ? <span className="pill">{t.hiddenBadge}</span> : null}
              {previewTitle ? <span className="pill">{previewTitle}</span> : null}
            </div>
          ) : null}

          {showAttempts ? (
            <div className="notice warn">
              {t.passInvalid(remainingAttempts ?? undefined)}
            </div>
          ) : null}

          {!invalidLink && requiresPassphrase && !openedSuccessfully ? (
            <label>
              {t.passphrase}
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder={t.passphrase}
              />
            </label>
          ) : null}

          {error && error !== t.invalid ? <div className="notice error">{error}</div> : null}
          {duressNotice ? <div className="notice warn">{duressNotice}</div> : null}

          {!invalidLink && !openedSuccessfully ? (
            <div className="grid-2">
              <button
                onClick={handleOpen}
                disabled={opening || !status || status.status !== 'active'}
                className={flashOpen ? 'button-flash' : ''}
              >
                {opening ? t.opening : t.open}
              </button>

              <button
                className="secondary"
                type="button"
                onClick={() => setHiddenRevealed((prev) => !prev)}
                disabled={!hiddenMode || (!secretText && files.length === 0)}
              >
                {hiddenRevealed ? t.toggleHide : t.toggleReveal}
              </button>
            </div>
          ) : null}

          {openedSuccessfully && countdownText ? (
            <div className="notice countdown-live">
              {t.countdownPrefix} <strong>{countdownText}</strong>
            </div>
          ) : null}

          {secretText ? (
            <div className="grid">
              <h3>{t.message}</h3>
              <div
                className={`secret-box ${hiddenMode && !hiddenRevealed ? 'concealed' : ''}`}
                onClick={() => hiddenMode && setHiddenRevealed(true)}
              >
                {secretText}
              </div>
            </div>
          ) : null}

          {lockedFiles.length > 0 ? (
            <div className="grid">
              <h3>{t.files}</h3>

              <label>
                {t.downloadPassphrase}
                <input
                  type="password"
                  value={downloadPassphrase}
                  onChange={(e) => setDownloadPassphrase(e.target.value)}
                  placeholder={t.downloadPassphrase}
                />
              </label>

              <button type="button" onClick={handleUnlockFiles} disabled={unlockingFiles}>
                {unlockingFiles ? t.unlocking : t.unlockFiles}
              </button>

              <div className="grid">
                {lockedFiles.map((file, index) => (
                  <div className="file-row" key={`${file.name}-${index}`}>
                    <div>
                      <strong>{file.name}</strong>
                      <p>{formatSize(file.size)}</p>
                    </div>
                    <span className="pill">Locked</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {files.length > 0 ? (
            <div className="grid">
              <h3>{t.files}</h3>
              <div className="grid">
                {files.map((file, index) => (
                  <div className="file-row" key={`${file.name}-${index}`}>
                    <div>
                      <strong>{file.name}</strong>
                      <p>{formatSize(file.size)}</p>
                    </div>
                    <a href={file.url} download={file.name}>
                      <button className="success" type="button">
                        {t.download}
                      </button>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}


