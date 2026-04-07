import { argon2id } from 'hash-wasm';
import { zip, type AsyncZippable } from 'fflate';

export type SecretKind = 'text' | 'file' | 'bundle';

export type FragmentPreview = {
  title?: string;
  hiddenMode?: boolean;
};

export type FragmentPayload =
  | {
      v: 2;
      mode: 'raw';
      rawKey: string;
      manageToken?: string;
      preview?: FragmentPreview;
    }
  | {
      v: 2;
      mode: 'locked';
      manageToken?: string;
      preview?: FragmentPreview;
    }
  | {
      v: 1;
      mode: 'raw';
      rawKey: string;
      manageToken?: string;
      preview?: FragmentPreview;
    }
  | {
      v: 1;
      mode: 'locked';
      manageToken?: string;
      preview?: FragmentPreview;
    };

export type WrappedKeyEnvelope = {
  salt: string;
  iv: string;
  wrappedKey: string;
  kdf: 'argon2id';
  iterations: number;
  memorySize: number;
  parallelism: number;
};

export type DuressPayloadEnvelope = {
  ciphertext: string;
  iv: string;
  kind: 'text';
  mimeType: 'text/plain';
};

export type PassphraseVerifier = {
  version: 1;
  kdf: 'pbkdf2-sha256';
  salt: string;
  iterations: number;
  digest: 'SHA-256';
  hash: string;
};

export type SecretMetadata = {
  title?: string;
  kind: SecretKind;
  filename?: string;
  fileSize?: number;
  mimeType?: string;
  hiddenMode?: boolean;
  embeddedText?: string;
  bundleMode?: boolean;
  archiveMode?: boolean;
  auth?: {
    realVerifier?: PassphraseVerifier | string;
    duressVerifier?: PassphraseVerifier | string;
    failedAttempts?: number;
  };
  protection?: {
    type: 'none' | 'passphrase';
    real?: WrappedKeyEnvelope;
    duress?: WrappedKeyEnvelope;
  };
  duressPayload?: DuressPayloadEnvelope;
};

export type BundlePlainFile = {
  name: string;
  type: string;
  size: number;
  mode: 'plain';
  data: string;
};

export type BundleProtectedFile = {
  name: string;
  type: string;
  size: number;
  mode: 'protected';
  ciphertext: string;
  iv: string;
  protection: WrappedKeyEnvelope;
};

export type BundleFile = BundlePlainFile | BundleProtectedFile;

export type BundlePayload = {
  version: 2;
  title?: string;
  message: string;
  files: BundleFile[];
  archive?: {
    enabled: boolean;
    filename: string;
    originalCount: number;
  };
};

const ARGON2_ITERATIONS = 3;
const ARGON2_MEMORY_KIB = 19456;
const ARGON2_PARALLELISM = 1;
const ARGON2_HASH_LENGTH = 32;
const VERIFIER_ITERATIONS = 600_000;
const VERIFIER_LENGTH = 32;

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  const out = new Uint8Array(view.byteLength);
  out.set(view);
  return out.buffer;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

export function base64ToUrlSafe(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function urlSafeToBase64(input: string): string {
  const base = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base.length % 4 === 0 ? '' : '='.repeat(4 - (base.length % 4));
  return base + pad;
}

export function encodeFragment(payload: FragmentPayload): string {
  const json = JSON.stringify(payload);
  return base64ToUrlSafe(bytesToBase64(new TextEncoder().encode(json)));
}

export function decodeFragment(fragment: string): FragmentPayload | null {
  try {
    const json = new TextDecoder().decode(base64ToBytes(urlSafeToBase64(fragment)));
    const parsed = JSON.parse(json) as Record<string, unknown>;

    const preview =
      parsed.preview && typeof parsed.preview === 'object' && !Array.isArray(parsed.preview)
        ? (parsed.preview as Record<string, unknown>)
        : null;

    if (parsed.v === 1 && parsed.mode === 'raw' && typeof parsed.rawKey === 'string') {
      return {
        v: 1,
        mode: 'raw',
        rawKey: parsed.rawKey,
        manageToken: typeof parsed.manageToken === 'string' ? parsed.manageToken : undefined,
        preview: {
          title: preview && typeof preview.title === 'string' ? preview.title : undefined,
          hiddenMode: preview ? Boolean(preview.hiddenMode) : undefined
        }
      };
    }

    if (parsed.v === 1 && parsed.mode === 'locked') {
      return {
        v: 1,
        mode: 'locked',
        manageToken: typeof parsed.manageToken === 'string' ? parsed.manageToken : undefined,
        preview: {
          title: preview && typeof preview.title === 'string' ? preview.title : undefined,
          hiddenMode: preview ? Boolean(preview.hiddenMode) : undefined
        }
      };
    }

    if (parsed.v === 2 && parsed.mode === 'raw' && typeof parsed.rawKey === 'string') {
      return {
        v: 2,
        mode: 'raw',
        rawKey: parsed.rawKey,
        manageToken: typeof parsed.manageToken === 'string' ? parsed.manageToken : undefined,
        preview: {
          title: preview && typeof preview.title === 'string' ? preview.title : undefined,
          hiddenMode: preview ? Boolean(preview.hiddenMode) : undefined
        }
      };
    }

    if (parsed.v === 2 && parsed.mode === 'locked') {
      return {
        v: 2,
        mode: 'locked',
        manageToken: typeof parsed.manageToken === 'string' ? parsed.manageToken : undefined,
        preview: {
          title: preview && typeof preview.title === 'string' ? preview.title : undefined,
          hiddenMode: preview ? Boolean(preview.hiddenMode) : undefined
        }
      };
    }

    return null;
  } catch {
    return null;
  }
}

export async function generateAesKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

export async function exportKeyToBase64Url(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return base64ToUrlSafe(bytesToBase64(new Uint8Array(raw)));
}

export async function importKeyFromBase64Url(rawKeyB64Url: string): Promise<CryptoKey> {
  const raw = base64ToBytes(urlSafeToBase64(rawKeyB64Url));
  return crypto.subtle.importKey('raw', toArrayBuffer(raw), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptBytes(input: Uint8Array, key: CryptoKey): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, key, toArrayBuffer(input));
  return { ciphertext: bytesToBase64(new Uint8Array(encrypted)), iv: bytesToBase64(iv) };
}

export async function decryptBytes(ciphertextB64: string, ivB64: string, key: CryptoKey): Promise<Uint8Array> {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(base64ToBytes(ivB64)) },
    key,
    toArrayBuffer(base64ToBytes(ciphertextB64))
  );
  return new Uint8Array(plaintext);
}

export async function deriveKekFromPassphrase(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const normalized = passphrase.normalize('NFKC');
  const derived = await argon2id({
    password: normalized,
    salt,
    parallelism: ARGON2_PARALLELISM,
    iterations: ARGON2_ITERATIONS,
    memorySize: ARGON2_MEMORY_KIB,
    hashLength: ARGON2_HASH_LENGTH,
    outputType: 'binary'
  });
  const bytes = derived instanceof Uint8Array ? derived : base64ToBytes(String(derived));
  return crypto.subtle.importKey('raw', toArrayBuffer(bytes), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function wrapContentKeyWithPassphrase(contentKey: CryptoKey, passphrase: string): Promise<WrappedKeyEnvelope> {
  const exportedKey = new Uint8Array(await crypto.subtle.exportKey('raw', contentKey));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const wrapIv = crypto.getRandomValues(new Uint8Array(12));
  const kek = await deriveKekFromPassphrase(passphrase, salt);
  const wrapped = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(wrapIv) },
    kek,
    toArrayBuffer(exportedKey)
  );

  return {
    salt: bytesToBase64(salt),
    iv: bytesToBase64(wrapIv),
    wrappedKey: bytesToBase64(new Uint8Array(wrapped)),
    kdf: 'argon2id',
    iterations: ARGON2_ITERATIONS,
    memorySize: ARGON2_MEMORY_KIB,
    parallelism: ARGON2_PARALLELISM
  };
}

export async function unwrapContentKeyWithPassphrase(envelope: WrappedKeyEnvelope, passphrase: string): Promise<CryptoKey> {
  const salt = base64ToBytes(envelope.salt);
  const iv = base64ToBytes(envelope.iv);
  const wrappedKey = base64ToBytes(envelope.wrappedKey);
  const kek = await deriveKekFromPassphrase(passphrase, salt);
  const rawKey = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    kek,
    toArrayBuffer(wrappedKey)
  );
  return crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function sha256Hex(input: string): Promise<string> {
  const normalized = input.normalize('NFKC');
  const data = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest('SHA-256', toArrayBuffer(data));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createPassphraseVerifier(passphrase: string): Promise<PassphraseVerifier> {
  const normalized = passphrase.normalize('NFKC');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passphraseKey = await crypto.subtle.importKey('raw', toArrayBuffer(textToBytes(normalized)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: toArrayBuffer(salt),
      iterations: VERIFIER_ITERATIONS
    },
    passphraseKey,
    VERIFIER_LENGTH * 8
  );

  return {
    version: 1,
    kdf: 'pbkdf2-sha256',
    salt: bytesToBase64(salt),
    iterations: VERIFIER_ITERATIONS,
    digest: 'SHA-256',
    hash: bytesToBase64(new Uint8Array(bits))
  };
}

export function textToBytes(input: string): Uint8Array {
  return new TextEncoder().encode(input);
}

export function bytesToText(input: Uint8Array): string {
  return new TextDecoder().decode(input);
}

export function formatExpiryLabel(value: string): string {
  if (value === '600') return '10 min';
  if (value === '3600') return '1 h';
  if (value === '21600') return '6 h';
  if (value === '86400') return '24 h';
  if (value === '604800') return '7 d';
  return 'custom';
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function qrUrl(input: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(input)}`;
}

async function zipFiles(files: File[]): Promise<{ bytes: Uint8Array; filename: string }> {
  const entries: AsyncZippable = {};
  for (const file of files) entries[file.name] = new Uint8Array(await file.arrayBuffer());
  const bytes = await new Promise<Uint8Array>((resolve, reject) => {
    zip(entries, { level: 6 }, (err, data) => {
      if (err) return reject(err);
      resolve(data);
    });
  });
  return { bytes, filename: files.length === 1 ? `${files[0].name}.zip` : 'hapax-archive.zip' };
}

export async function buildBundlePayload(
  message: string,
  files: File[],
  options?: {
    zipBeforeEncrypt?: boolean;
    downloadPassphrase?: string;
    onProgress?: (percent: number, stage: string) => void;
  }
): Promise<BundlePayload> {
  const onProgress = options?.onProgress;
  const zipBeforeEncrypt = Boolean(options?.zipBeforeEncrypt);
  const downloadPassphrase = options?.downloadPassphrase?.trim() || '';

  onProgress?.(3, 'reading');

  let workItems: Array<{ name: string; type: string; size: number; bytes: Uint8Array }> = [];
  let archive: BundlePayload['archive'] | undefined;

  if (zipBeforeEncrypt && files.length > 0) {
    onProgress?.(10, 'compressing');
    const zipped = await zipFiles(files);
    workItems = [{ name: zipped.filename, type: 'application/zip', size: zipped.bytes.length, bytes: zipped.bytes }];
    archive = { enabled: true, filename: zipped.filename, originalCount: files.length };
  } else {
    for (const file of files) {
      workItems.push({
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        bytes: new Uint8Array(await file.arrayBuffer())
      });
    }
  }

  const bundleFiles: BundleFile[] = [];
  if (workItems.length === 0) {
    onProgress?.(80, 'ready');
    return { version: 2, title: undefined, message, files: [], archive };
  }

  for (let i = 0; i < workItems.length; i += 1) {
    const item = workItems[i];
    const progressBase = 20 + Math.round((i / workItems.length) * 60);

    if (downloadPassphrase) {
      const fileKey = await generateAesKey();
      const encrypted = await encryptBytes(item.bytes, fileKey);
      const protection = await wrapContentKeyWithPassphrase(fileKey, downloadPassphrase);
      bundleFiles.push({
        name: item.name,
        type: item.type,
        size: item.size,
        mode: 'protected',
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        protection
      });
    } else {
      bundleFiles.push({
        name: item.name,
        type: item.type,
        size: item.size,
        mode: 'plain',
        data: bytesToBase64(item.bytes)
      });
    }

    onProgress?.(progressBase, 'encrypting');
  }

  onProgress?.(86, 'ready');
  return { version: 2, title: undefined, message, files: bundleFiles, archive };
}

export function generateManageToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return base64ToUrlSafe(bytesToBase64(bytes));
}

export async function qrDataUrl(input: string): Promise<string> {
  const qrcode = await import('qrcode');
  return qrcode.toDataURL(input, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 300
  });
}
