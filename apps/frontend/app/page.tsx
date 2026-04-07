'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type BundlePayload,
  type FragmentPayload,
  type SecretMetadata,
  buildBundlePayload,
  createPassphraseVerifier,
  decodeFragment,
  encodeFragment,
  encryptBytes,
  exportKeyToBase64Url,
  formatSize,
  generateAesKey,
  generateManageToken,
  qrDataUrl,
  sha256Hex,
  textToBytes,
  wrapContentKeyWithPassphrase
} from '../lib/veil';
import { getStoredLang, onLangChange, type Lang } from '../lib/i18n';

type CreateResponse = {
  ok: boolean;
  secretId: string;
  expiresAt: string;
  remainingReads: number;
};

type CreateErrorResponse = {
  ok?: false;
  message?: string;
  code?: string;
};

const MAX_SOURCE_BYTES = 180 * 1024 * 1024;
const MAX_REQUEST_BODY_BYTES = 95 * 1024 * 1024;
const AUTO_ZIP_SOURCE_BYTES = 48 * 1024 * 1024;

function jsonSize(input: unknown): number {
  return new TextEncoder().encode(JSON.stringify(input)).length;
}

const DICT = {
  es: {
    eyebrow: 'HAPAX VEIL',
    title: 'Crear secreto cifrado',
    subtitle:
      'Texto y archivos se cifran en tu navegador. El servidor solo almacena ciphertext y metadatos mínimos.',
    optionalTitle: 'Título opcional',
    files: 'Archivos',
    fileHint: 'Selecciona o arrastra uno o varios archivos.',
    message: 'Mensaje',
    messagePlaceholder: 'Escribe aquí el mensaje que acompañará al enlace o a los archivos...',
    expiration: 'Expiración',
    reads: 'Lecturas permitidas',
    passphrase: 'Contraseña de acceso opcional',
    hidden: 'Modo oculto',
    hiddenOff: 'Normal',
    hiddenOn: 'Oculto / discreto',
    duress: 'Contraseña duress opcional',
    duressMessage: 'Mensaje señuelo opcional',
    duressMessagePlaceholder:
      'Opcional: mensaje alternativo si se usa la contraseña duress',
    downloadPass: 'Contraseña adicional para descargar archivos',
    downloadPassPlaceholder: 'Solo se pedirá para descargar los adjuntos',
    create: 'Crear enlace autodestructivo',
    creating: 'Creando…',
    clear: 'Limpiar',
    linkReady: 'Tu enlace secreto está listo',
    linkAutohide: 'El enlace se ocultará automáticamente de tu pantalla en 3 minutos.',
    copy: 'Copiar enlace',
    copied: 'Enlace copiado ✓',
    qr: 'Ver QR',
    revoke: 'Revocar enlace',
    revoked: 'Revocado',
    qrTitle: 'Compartir enlace secreto',
    qrDesc: 'Escanéalo, compártelo o descárgalo como imagen.',
    share: 'Compartir',
    download: 'Descargar',
    back: 'Volver atrás',
    openLink: 'Abrir enlace',
    onlyMessage: 'Solo mensaje',
    passBadge: 'Contraseña',
    duressBadge: 'Duress',
    hiddenBadge: 'Modo oculto',
    totalSelection: 'Selección total',
    overLimitTitle: 'Selección superior a 1 GB',
    overLimitBody:
      'Has seleccionado más de 1 GB. Puedes intentar comprimir los archivos en ZIP y cifrarlos como un único adjunto antes de crear el enlace.',
    zipYes: 'Comprimir y cifrar en ZIP',
    zipNo: 'Cancelar',
    zipActive: 'ZIP cifrado activo',
    prepTitle: 'Preparando archivos',
    prepReading: 'Leyendo archivos…',
    prepCompressing: 'Comprimiendo…',
    prepEncrypting: 'Cifrando…',
    prepReady: 'Listo para crear el enlace',
    payloadRequired: 'Añade texto o selecciona uno o más archivos.',
    duressNeedsPass: 'La contraseña duress requiere contraseña principal.',
    tooBigNoZip:
      'La selección supera 1 GB. Usa compresión ZIP o reduce el tamaño.',
    genericCreateError: 'No se pudo crear el secreto.',
    qrFailed: 'No se pudo generar el QR local.',
    filesCount: (n: number) => `${n} archivo(s)`,
    passwordPlaceholder: 'Protección adicional',
    duressPlaceholder: 'Contraseña alternativa bajo coacción',
    titlePlaceholder: 'Ej. credenciales de acceso',
    sourceTooLarge: 'La selección supera el máximo práctico de esta versión. Reduce tamaño o espera al modo chunked.',
    requestTooLarge: (limit: string) => `El paquete cifrado supera el límite práctico de subida (${limit}). Reduce tamaño o usa menos adjuntos.`,
    autoZipEnabled: 'Se activó ZIP cifrado automáticamente para intentar ajustarse al límite.',
    zipRetrying: 'Reintentando con ZIP cifrado…',
    limitHint: 'Límite práctico actual',
    titleShownBeforeOpen: 'El título se mostrará antes de abrir el enlace, pero no saldrá desde la API.'
  },
  en: {
    eyebrow: 'HAPAX VEIL',
    title: 'Create encrypted secret',
    subtitle:
      'Text and files are encrypted in your browser. The server stores only ciphertext and minimal metadata.',
    optionalTitle: 'Optional title',
    files: 'Files',
    fileHint: 'Select or drag one or more files.',
    message: 'Message',
    messagePlaceholder: 'Write the message that will accompany the link or files...',
    expiration: 'Expiration',
    reads: 'Allowed reads',
    passphrase: 'Optional access password',
    hidden: 'Hidden mode',
    hiddenOff: 'Normal',
    hiddenOn: 'Hidden / discreet',
    duress: 'Optional duress password',
    duressMessage: 'Optional decoy message',
    duressMessagePlaceholder:
      'Optional: alternate message if the duress password is used',
    downloadPass: 'Extra password for file downloads',
    downloadPassPlaceholder: 'Only required to download attachments',
    create: 'Create self-destruct link',
    creating: 'Creating…',
    clear: 'Clear',
    linkReady: 'Your secret link is ready',
    linkAutohide: 'This link will disappear from your screen in 3 minutes.',
    copy: 'Copy link',
    copied: 'Link copied ✓',
    qr: 'View QR',
    revoke: 'Revoke link',
    revoked: 'Revoked',
    qrTitle: 'Share secret link',
    qrDesc: 'Scan it, share it or download it as an image.',
    share: 'Share',
    download: 'Download',
    back: 'Go back',
    openLink: 'Open link',
    onlyMessage: 'Message only',
    passBadge: 'Password',
    duressBadge: 'Duress',
    hiddenBadge: 'Hidden mode',
    totalSelection: 'Total selection',
    overLimitTitle: 'Selection exceeds 1 GB',
    overLimitBody:
      'You selected more than 1 GB. You can try compressing the files into a ZIP and encrypting them as a single attachment before creating the link.',
    zipYes: 'Compress and encrypt as ZIP',
    zipNo: 'Cancel',
    zipActive: 'Encrypted ZIP enabled',
    prepTitle: 'Preparing files',
    prepReading: 'Reading files…',
    prepCompressing: 'Compressing…',
    prepEncrypting: 'Encrypting…',
    prepReady: 'Ready to create the link',
    payloadRequired: 'Add text or select one or more files.',
    duressNeedsPass: 'Duress password requires a main password.',
    tooBigNoZip:
      'The selection exceeds 1 GB. Use ZIP compression or reduce the size.',
    genericCreateError: 'Failed to create secret.',
    qrFailed: 'Failed to generate the local QR code.',
    filesCount: (n: number) => `${n} file(s)`,
    passwordPlaceholder: 'Additional protection',
    duressPlaceholder: 'Alternate coercion password',
    titlePlaceholder: 'e.g. access credentials',
    sourceTooLarge: 'The selection exceeds the practical limit of this version. Reduce the size or wait for chunked uploads.',
    requestTooLarge: (limit: string) => `The encrypted package exceeds the practical upload limit (${limit}). Reduce the size or use fewer attachments.`,
    autoZipEnabled: 'Encrypted ZIP was enabled automatically to try to fit the limit.',
    zipRetrying: 'Retrying with encrypted ZIP…',
    limitHint: 'Current practical limit',
    titleShownBeforeOpen: 'The title is shown before opening the link, but it is not exposed by the API.'
  }
} as const;

export default function HomePage() {
  const [lang, setLang] = useState<Lang>('en');
  const [title, setTitle] = useState('');
  const [plaintext, setPlaintext] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [expiresInSeconds, setExpiresInSeconds] = useState('3600');
  const [maxReads, setMaxReads] = useState('1');
  const [passphrase, setPassphrase] = useState('');
  const [duressPassphrase, setDuressPassphrase] = useState('');
  const [duressMessage, setDuressMessage] = useState('');
  const [downloadPassphrase, setDownloadPassphrase] = useState('');
  const [hiddenMode, setHiddenMode] = useState(false);
  const [zipBeforeEncrypt, setZipBeforeEncrypt] = useState(false);

  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState('');
  const [error, setError] = useState('');
  const [uploadNotice, setUploadNotice] = useState('');
  const [secretId, setSecretId] = useState('');
  const [revoked, setRevoked] = useState(false);
  const [revokeMsg, setRevokeMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [hideCreatedPanel, setHideCreatedPanel] = useState(false);
  const [flashCopy, setFlashCopy] = useState(false);
  const [flashCreate, setFlashCreate] = useState(false);
  const [flashQr, setFlashQr] = useState(false);
  const [flashRevoke, setFlashRevoke] = useState(false);
  const [highlightResult, setHighlightResult] = useState(false);
  const [qrImageUrl, setQrImageUrl] = useState('');

  const [showZipPrompt, setShowZipPrompt] = useState(false);
  const [prepPercent, setPrepPercent] = useState(0);
  const [prepStage, setPrepStage] = useState<'reading' | 'compressing' | 'encrypting' | 'ready' | ''>('');

  const resultRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLang(getStoredLang());
    return onLangChange(setLang);
  }, []);

  const t = DICT[lang];

  const hasPayload = useMemo(() => {
    return plaintext.trim().length > 0 || selectedFiles.length > 0;
  }, [plaintext, selectedFiles]);

  const canSubmit = useMemo(() => {
    return hasPayload && !loading;
  }, [hasPayload, loading]);

  const totalSelectedBytes = useMemo(() => {
    return selectedFiles.reduce((sum, file) => sum + file.size, 0);
  }, [selectedFiles]);

  useEffect(() => {
    if (!resultUrl || !resultRef.current) return;

    const el = resultRef.current;

    window.setTimeout(() => {
      el.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }, 140);

    setHighlightResult(true);
    const timer = window.setTimeout(() => setHighlightResult(false), 4200);
    const autoclear = window.setTimeout(() => {
      setHideCreatedPanel(true);
      setResultUrl('');
      setSecretId('');
      setCopied(false);
      setShowQr(false);
      setQrImageUrl('');
    }, 3 * 60 * 1000);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(autoclear);
    };
  }, [resultUrl]);

  useEffect(() => {
    if (!showQr || !resultUrl || qrImageUrl) return;

    void ensureQrImage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showQr, resultUrl, qrImageUrl]);

  function appendFiles(list: FileList | File[]) {
    const incoming = Array.from(list);
    setSelectedFiles((prev) => {
      const map = new Map<string, File>();
      for (const file of prev) map.set(`${file.name}:${file.size}:${file.lastModified}`, file);
      for (const file of incoming) map.set(`${file.name}:${file.size}:${file.lastModified}`, file);
      return Array.from(map.values());
    });
  }

  async function ensureQrImage(): Promise<string> {
    if (!resultUrl) {
      throw new Error(t.qrFailed);
    }

    if (qrImageUrl) {
      return qrImageUrl;
    }

    try {
      const dataUrl = await qrDataUrl(resultUrl);
      setQrImageUrl(dataUrl);
      return dataUrl;
    } catch {
      throw new Error(t.qrFailed);
    }
  }

  async function handleCreate() {
    setFlashCreate(true);
    window.setTimeout(() => setFlashCreate(false), 320);

    setLoading(true);
    setError('');
    setUploadNotice('');
    setResultUrl('');
    setSecretId('');
    setRevoked(false);
    setRevokeMsg('');
    setCopied(false);
    setHideCreatedPanel(false);
    setShowQr(false);
    setQrImageUrl('');
    setPrepPercent(0);
    setPrepStage('');

    try {
      if (!plaintext.trim() && selectedFiles.length === 0) {
        throw new Error(t.payloadRequired);
      }

      if (duressPassphrase && !passphrase) {
        throw new Error(t.duressNeedsPass);
      }

      if (totalSelectedBytes > MAX_SOURCE_BYTES) {
        throw new Error(t.sourceTooLarge);
      }

      let useZip = zipBeforeEncrypt || (selectedFiles.length > 1 && totalSelectedBytes > AUTO_ZIP_SOURCE_BYTES);
      if (useZip && !zipBeforeEncrypt) {
        setZipBeforeEncrypt(true);
        setUploadNotice(t.autoZipEnabled);
      }

      const contentKey = await generateAesKey();
      const manageToken = generateManageToken();
      const manageTokenHash = await sha256Hex(manageToken);
      const previewTitle = title.trim() || undefined;
      const previewHidden = hiddenMode ? true : undefined;

      const buildRequestPayload = async (forceZip: boolean) => {
        const bundle: BundlePayload = await buildBundlePayload(plaintext, selectedFiles, {
          zipBeforeEncrypt: forceZip,
          downloadPassphrase,
          onProgress: (percent, stage) => {
            setPrepPercent(percent);
            if (stage === 'reading' || stage === 'compressing' || stage === 'encrypting' || stage === 'ready') {
              setPrepStage(stage);
            }
          }
        });

        bundle.title = previewTitle;
        const payloadBytes = textToBytes(JSON.stringify(bundle));
        setPrepPercent(92);
        setPrepStage('encrypting');

        const encryptedMain = await encryptBytes(payloadBytes, contentKey);
        setPrepPercent(98);

        const metadata: SecretMetadata = {
          kind: 'bundle',
          bundleMode: true,
          archiveMode: forceZip,
          mimeType: 'application/vnd.hapax.bundle+json',
          auth: {},
          protection: {
            type: passphrase ? 'passphrase' : 'none'
          }
        };

        let fragmentPayload: FragmentPayload;

        if (passphrase.trim()) {
          metadata.protection!.real = await wrapContentKeyWithPassphrase(contentKey, passphrase);
          metadata.auth!.realVerifier = await createPassphraseVerifier(passphrase);
          fragmentPayload = {
            v: 2,
            mode: 'locked',
            manageToken,
            preview: {
              title: previewTitle,
              hiddenMode: previewHidden
            }
          };
        } else {
          fragmentPayload = {
            v: 2,
            mode: 'raw',
            rawKey: await exportKeyToBase64Url(contentKey),
            manageToken,
            preview: {
              title: previewTitle,
              hiddenMode: previewHidden
            }
          };
        }

        if (passphrase.trim() && duressPassphrase.trim()) {
          const duressKey = await generateAesKey();
          metadata.protection!.duress = await wrapContentKeyWithPassphrase(duressKey, duressPassphrase);
          metadata.auth!.duressVerifier = await createPassphraseVerifier(duressPassphrase);

          if (duressMessage.trim()) {
            const encryptedDuress = await encryptBytes(textToBytes(duressMessage), duressKey);
            metadata.duressPayload = {
              ciphertext: encryptedDuress.ciphertext,
              iv: encryptedDuress.iv,
              kind: 'text',
              mimeType: 'text/plain'
            };
          }
        }

        const requestBody = {
          ciphertext: encryptedMain.ciphertext,
          iv: encryptedMain.iv,
          algorithm: 'AES-256-GCM',
          mimeType: 'application/vnd.hapax.bundle+json',
          expiresInSeconds: Number(expiresInSeconds),
          maxReads: Number(maxReads),
          manageTokenHash,
          metadata
        };

        return {
          bundle,
          requestBody,
          requestBytes: jsonSize(requestBody),
          fragmentPayload
        };
      };

      let prepared = await buildRequestPayload(useZip);

      if (prepared.requestBytes > MAX_REQUEST_BODY_BYTES && selectedFiles.length > 0 && !useZip) {
        setUploadNotice(t.zipRetrying);
        useZip = true;
        setZipBeforeEncrypt(true);
        prepared = await buildRequestPayload(true);
        setUploadNotice(t.autoZipEnabled);
      }

      if (prepared.requestBytes > MAX_REQUEST_BODY_BYTES) {
        throw new Error(t.requestTooLarge(formatSize(MAX_REQUEST_BODY_BYTES)));
      }

      setPrepPercent(100);
      setPrepStage('ready');

      const res = await fetch('/api/v1/secrets', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify(prepared.requestBody)
      });

      const raw = await res.text();
      let data: CreateResponse | CreateErrorResponse = {};

      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(raw || `HTTP ${res.status}`);
      }

      if (!res.ok) {
        const apiError = data as CreateErrorResponse;
        throw new Error(apiError.message || apiError.code || t.genericCreateError);
      }

      const created = data as CreateResponse;
      const link = `${window.location.origin}/s/${created.secretId}#${encodeFragment(prepared.fragmentPayload)}`;

      setSecretId(created.secretId);
      setResultUrl(link);
      setTitle('');
      setPlaintext('');
      setSelectedFiles([]);
      setPassphrase('');
      setDuressPassphrase('');
      setDuressMessage('');
      setDownloadPassphrase('');
      setHiddenMode(false);
      setZipBeforeEncrypt(false);
      setUploadNotice('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t.genericCreateError);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!resultUrl) return;

    setFlashCopy(true);
    window.setTimeout(() => setFlashCopy(false), 320);

    await navigator.clipboard.writeText(resultUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function handleRevoke() {
    if (!secretId || !resultUrl) return;

    setFlashRevoke(true);
    window.setTimeout(() => setFlashRevoke(false), 320);

    setRevokeMsg('');
    setError('');

    try {
      const fragmentValue = resultUrl.split('#')[1] || '';
      const decoded = decodeFragment(fragmentValue);
      const manageToken = decoded?.manageToken || '';

      const res = await fetch(`/api/v1/secrets/${secretId}/revoke`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({ manageToken })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.code || `HTTP ${res.status}`);
      }

      setRevoked(true);
      setRevokeMsg(lang === 'es' ? 'Secreto revocado.' : 'Secret revoked.');

      window.setTimeout(() => {
        setHideCreatedPanel(true);
        setResultUrl('');
        setSecretId('');
        setQrImageUrl('');
      }, 180);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to revoke secret');
    }
  }

  async function handleShareQr() {
    if (!resultUrl) return;

    const dataUrl = await ensureQrImage();
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const file = new File([blob], 'hapax-veil-qr.png', { type: 'image/png' });
    const text =
      lang === 'es'
        ? 'Mira mi mensaje secreto en HAPAX VEIL.'
        : 'Check out my secret message on HAPAX VEIL.';

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: 'HAPAX VEIL',
        text,
        files: [file]
      });
      return;
    }

    if (navigator.share) {
      await navigator.share({
        title: 'HAPAX VEIL',
        text: `${text}\n${resultUrl}`,
        url: resultUrl
      });
      return;
    }

    await navigator.clipboard.writeText(resultUrl);
  }

  async function handleDownloadQr() {
    if (!resultUrl) return;

    const dataUrl = await ensureQrImage();
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = 'hapax-veil-qr.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  }

  function prepStageLabel() {
    if (prepStage === 'reading') return t.prepReading;
    if (prepStage === 'compressing') return t.prepCompressing;
    if (prepStage === 'encrypting') return t.prepEncrypting;
    if (prepStage === 'ready') return t.prepReady;
    return '';
  }

  return (
    <main>
      <div className="shell">
        <section className="panel grid hero-grid hero-grid-wide">
          <div className="section-stack">
            <div className="eyebrow">{t.eyebrow}</div>
            <h1>{t.title}</h1>
            <p>{t.subtitle}</p>
          </div>
        </section>

        <section className="panel grid">
          <div className="grid-2">
            <label>
              {t.optionalTitle}
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t.titlePlaceholder}
              />
            </label>

            <label>
              {t.files}
              <div
                className="dropzone"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.length) appendFiles(e.dataTransfer.files);
                }}
              >
                <input
                  type="file"
                  multiple
                  onChange={(e) => {
                    if (e.target.files?.length) appendFiles(e.target.files);
                  }}
                />
                <p>{t.fileHint}</p>

                {selectedFiles.length > 0 ? (
                  <>
                    <div className="file-list">
                      {selectedFiles.map((file, index) => (
                        <div className="pill" key={`${file.name}-${file.size}-${index}`}>
                          {file.name} · {formatSize(file.size)}
                        </div>
                      ))}
                    </div>

                    <div className="notice">
                      {t.totalSelection}: {formatSize(totalSelectedBytes)} · {t.limitHint}: {formatSize(MAX_REQUEST_BODY_BYTES)}
                    </div>

                    {zipBeforeEncrypt ? (
                      <div className="notice success">{t.zipActive}</div>
                    ) : null}

                    <div className="notice">{t.titleShownBeforeOpen}</div>
                  </>
                ) : null}
              </div>
            </label>
          </div>

          <label>
            {t.message}
            <textarea
              value={plaintext}
              onChange={(e) => setPlaintext(e.target.value)}
              placeholder={t.messagePlaceholder}
            />
          </label>

          <div className="grid-2">
            <label>
              {t.expiration}
              <select
                value={expiresInSeconds}
                onChange={(e) => setExpiresInSeconds(e.target.value)}
              >
                <option value="600">10 min</option>
                <option value="3600">1 h</option>
                <option value="21600">6 h</option>
                <option value="86400">24 h</option>
                <option value="604800">7 d</option>
              </select>
            </label>

            <label>
              {t.reads}
              <select value={maxReads} onChange={(e) => setMaxReads(e.target.value)}>
                <option value="1">1</option>
                <option value="3">3</option>
                <option value="5">5</option>
                <option value="10">10</option>
              </select>
            </label>
          </div>

          <div className="grid-2">
            <label>
              {t.passphrase}
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder={t.passwordPlaceholder}
              />
            </label>

            <label>
              {t.hidden}
              <select
                value={hiddenMode ? '1' : '0'}
                onChange={(e) => setHiddenMode(e.target.value === '1')}
              >
                <option value="0">{t.hiddenOff}</option>
                <option value="1">{t.hiddenOn}</option>
              </select>
            </label>
          </div>

          <div className="grid-2">
            <label>
              {t.duress}
              <input
                type="password"
                value={duressPassphrase}
                onChange={(e) => setDuressPassphrase(e.target.value)}
                placeholder={t.duressPlaceholder}
              />
            </label>

            <label>
              {t.downloadPass}
              <input
                type="password"
                value={downloadPassphrase}
                onChange={(e) => setDownloadPassphrase(e.target.value)}
                placeholder={t.downloadPassPlaceholder}
              />
            </label>
          </div>

          <label>
            {t.duressMessage}
            <textarea
              value={duressMessage}
              onChange={(e) => setDuressMessage(e.target.value)}
              placeholder={t.duressMessagePlaceholder}
              style={{ minHeight: 120 }}
            />
          </label>

          {loading || prepPercent > 0 ? (
            <div className="progress-wrap">
              <div className="progress-head">
                <strong>{t.prepTitle}</strong>
                <span>{prepPercent}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${prepPercent}%` }} />
              </div>
              {prepStage ? <p className="progress-note">{prepStageLabel()}</p> : null}
            </div>
          ) : null}

          <div className="grid-2">
            <button
              onClick={handleCreate}
              disabled={!canSubmit}
              className={flashCreate ? 'button-flash' : ''}
            >
              {loading ? t.creating : t.create}
            </button>

            <button
              className="secondary"
              onClick={() => {
                setTitle('');
                setPlaintext('');
                setSelectedFiles([]);
                setExpiresInSeconds('3600');
                setMaxReads('1');
                setPassphrase('');
                setDuressPassphrase('');
                setDuressMessage('');
                setDownloadPassphrase('');
                setHiddenMode(false);
                setZipBeforeEncrypt(false);
                setError('');
                setResultUrl('');
                setSecretId('');
                setRevoked(false);
                setRevokeMsg('');
                setCopied(false);
                setShowQr(false);
                setHideCreatedPanel(false);
                setPrepPercent(0);
                setPrepStage('');
                setQrImageUrl('');
                setUploadNotice('');
              }}
              disabled={loading}
            >
              {t.clear}
            </button>
          </div>

          {error ? <div className="notice error">{error}</div> : null}
          {uploadNotice ? <div className="notice success">{uploadNotice}</div> : null}
          {revokeMsg ? <div className="notice warn">{revokeMsg}</div> : null}
        </section>

        {resultUrl ? (
          <section
            ref={resultRef}
            className={`panel grid ${hideCreatedPanel ? 'fade-out' : ''}`}
          >
            <div className="section-stack">
              <div className="eyebrow">{t.eyebrow}</div>
              <h2>{t.linkReady}</h2>
              <p>{t.linkAutohide}</p>
            </div>

            <div className={`link-box mono ${highlightResult ? 'highlight' : ''}`}>
              {resultUrl}
            </div>

            <div className="meta-inline">
              <span className="pill">
                {selectedFiles.length > 0 ? t.filesCount(selectedFiles.length) : t.onlyMessage}
              </span>
              {passphrase ? <span className="pill">{t.passBadge}</span> : null}
              {duressPassphrase ? <span className="pill">{t.duressBadge}</span> : null}
              {hiddenMode ? <span className="pill">{t.hiddenBadge}</span> : null}
              {zipBeforeEncrypt ? <span className="pill">ZIP</span> : null}
            </div>

            <div className="grid-3">
              <button
                onClick={handleCopy}
                className={`${copied ? 'success' : ''} ${flashCopy ? 'button-flash' : ''}`}
              >
                {copied ? t.copied : t.copy}
              </button>

              <button
                className={`secondary ${flashQr ? 'button-flash' : ''}`}
                onClick={() => {
                  setFlashQr(true);
                  window.setTimeout(() => setFlashQr(false), 320);
                  setShowQr(true);
                }}
              >
                {t.qr}
              </button>

              <button
                className={`danger ${flashRevoke ? 'button-flash' : ''}`}
                onClick={handleRevoke}
                disabled={revoked}
              >
                {revoked ? t.revoked : t.revoke}
              </button>
            </div>
          </section>
        ) : null}

        {showQr && resultUrl ? (
          <div className="qr-backdrop" onClick={() => setShowQr(false)}>
            <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
              <div className="section-stack">
                <div className="eyebrow">{t.eyebrow}</div>
                <h3>{t.qrTitle}</h3>
                <p>{t.qrDesc}</p>
              </div>

              <div className="qr-box">
                {qrImageUrl ? (
                  <img
                    className="qr-image"
                    src={qrImageUrl}
                    alt="QR secret link"
                    width={300}
                    height={300}
                  />
                ) : (
                  <div className="notice">{t.prepReading}</div>
                )}
              </div>

              <div className="qr-actions">
                <button onClick={handleShareQr}>{t.share}</button>
                <button className="secondary" onClick={handleDownloadQr}>
                  {t.download}
                </button>
                <button className="secondary" onClick={() => setShowQr(false)}>
                  {t.back}
                </button>
                <a href={resultUrl}>
                  <button className="secondary" type="button">{t.openLink}</button>
                </a>
              </div>
            </div>
          </div>
        ) : null}

        {showZipPrompt ? (
          <div className="qr-backdrop" onClick={() => setShowZipPrompt(false)}>
            <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
              <div className="section-stack">
                <div className="eyebrow">{t.eyebrow}</div>
                <h3>{t.overLimitTitle}</h3>
                <p>{t.overLimitBody}</p>
              </div>

              <div className="qr-actions">
                <button
                  onClick={() => {
                    setZipBeforeEncrypt(true);
                    setShowZipPrompt(false);
                    setError('');
                  }}
                >
                  {t.zipYes}
                </button>
                <button className="secondary" onClick={() => setShowZipPrompt(false)}>
                  {t.zipNo}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

