import type { FastifyInstance } from 'fastify';
import { createHash, pbkdf2Sync, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { pool } from '../lib/db.js';

type SecretStatus = 'active' | 'burned' | 'expired' | 'revoked';

type PassphraseVerifier = {
  version: 1;
  kdf: 'pbkdf2-sha256';
  salt: string;
  iterations: number;
  digest: 'SHA-256';
  hash: string;
};

type WrappedKeyEnvelope = {
  salt: string;
  iv: string;
  wrappedKey: string;
  kdf: 'argon2id';
  iterations: number;
  memorySize: number;
  parallelism: number;
};

type SecretMetadata = Record<string, unknown> & {
  kind?: string;
  bundleMode?: boolean;
  archiveMode?: boolean;
  mimeType?: string;
  auth?: {
    realVerifier?: PassphraseVerifier | string;
    duressVerifier?: PassphraseVerifier | string;
  };
  protection?: {
    type?: 'none' | 'passphrase';
    real?: WrappedKeyEnvelope;
    duress?: WrappedKeyEnvelope;
  };
  duressPayload?: {
    ciphertext?: string;
    iv?: string;
    kind?: 'text';
    mimeType?: string;
  };
};

type SecretRow = {
  id: string;
  ciphertext: string;
  iv: string;
  algorithm: string;
  mime_type: string;
  metadata: SecretMetadata | null;
  status: SecretStatus;
  max_reads: number;
  remaining_reads: number;
  created_at: string;
  expires_at: string;
  auth_fail_count: number;
  auth_max_attempts: number;
  manage_token_hash: string | null;
};

const createSecretSchema = z.object({
  ciphertext: z.string().min(1),
  iv: z.string().min(1),
  algorithm: z.string().min(1),
  mimeType: z.string().min(1),
  expiresInSeconds: z.number().int().min(60).max(60 * 60 * 24 * 30),
  maxReads: z.number().int().min(1).max(100),
  manageTokenHash: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({})
});

const secretIdParamsSchema = z.object({
  id: z.string().uuid()
});

const openSecretBodySchema = z.object({
  passphrase: z.string().optional().default('')
});

const revokeSecretBodySchema = z.object({
  manageToken: z.string().optional().default('')
});

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() <= Date.now();
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input.normalize('NFKC')).digest('hex');
}

function hexEqual(aHex: string, bHex: string): boolean {
  try {
    const a = Buffer.from(aHex, 'hex');
    const b = Buffer.from(bHex, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function getMetadataObject(value: unknown): SecretMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as SecretMetadata;
}

function sanitizeStoredMetadata(metadata: SecretMetadata): SecretMetadata {
  const sanitized: SecretMetadata = {
    kind: typeof metadata.kind === 'string' ? metadata.kind : 'bundle',
    bundleMode: Boolean(metadata.bundleMode),
    archiveMode: Boolean(metadata.archiveMode),
    mimeType: typeof metadata.mimeType === 'string' ? metadata.mimeType : undefined
  };

  if (metadata.auth && typeof metadata.auth === 'object' && !Array.isArray(metadata.auth)) {
    sanitized.auth = metadata.auth;
  }

  if (metadata.protection && typeof metadata.protection === 'object' && !Array.isArray(metadata.protection)) {
    sanitized.protection = metadata.protection as SecretMetadata['protection'];
  }

  if (metadata.duressPayload && typeof metadata.duressPayload === 'object' && !Array.isArray(metadata.duressPayload)) {
    sanitized.duressPayload = metadata.duressPayload as SecretMetadata['duressPayload'];
  }

  return sanitized;
}

function getProtectionType(metadata: SecretMetadata): 'none' | 'passphrase' {
  const type = metadata.protection?.type;
  return type === 'passphrase' ? 'passphrase' : 'none';
}

function isPassphraseVerifier(value: unknown): value is PassphraseVerifier {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const verifier = value as Record<string, unknown>;

  return (
    verifier.version === 1 &&
    verifier.kdf === 'pbkdf2-sha256' &&
    typeof verifier.salt === 'string' &&
    typeof verifier.hash === 'string' &&
    typeof verifier.iterations === 'number' &&
    verifier.digest === 'SHA-256'
  );
}

function getAuthVerifiers(metadata: SecretMetadata): {
  realVerifier: PassphraseVerifier | string | null;
  duressVerifier: PassphraseVerifier | string | null;
} {
  const auth = metadata.auth;
  const real = auth?.realVerifier;
  const duress = auth?.duressVerifier;

  return {
    realVerifier: isPassphraseVerifier(real) || typeof real === 'string' ? real : null,
    duressVerifier: isPassphraseVerifier(duress) || typeof duress === 'string' ? duress : null
  };
}

function verifyPassphrase(candidate: string, verifier: PassphraseVerifier | string | null): boolean {
  if (!verifier) {
    return false;
  }

  if (typeof verifier === 'string') {
    return hexEqual(sha256Hex(candidate), verifier);
  }

  const derived = pbkdf2Sync(
    candidate.normalize('NFKC'),
    Buffer.from(verifier.salt, 'base64'),
    verifier.iterations,
    32,
    'sha256'
  );

  const expected = Buffer.from(verifier.hash, 'base64');

  if (derived.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(derived, expected);
}

function getSelectedEnvelope(metadata: SecretMetadata, mode: 'real' | 'duress'): WrappedKeyEnvelope | null {
  const candidate = mode === 'duress' ? metadata.protection?.duress : metadata.protection?.real;
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return null;
  }
  return candidate as WrappedKeyEnvelope;
}

async function deleteSecretById(client: { query: (text: string, values?: unknown[]) => Promise<unknown> }, id: string) {
  await client.query('DELETE FROM secrets WHERE id = $1', [id]);
}

export async function secretRoutes(app: FastifyInstance) {
  app.post(
    '/v1/secrets',
    {
      config: {
        rateLimit: { max: 20, timeWindow: '1 minute' }
      }
    },
    async (request, reply) => {
      const parsed = createSecretSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({ ok: false, code: 'INVALID_PAYLOAD', issues: parsed.error.flatten() });
      }

      const body = parsed.data;
      const expiresAt = new Date(Date.now() + body.expiresInSeconds * 1000);
      const storedMetadata = sanitizeStoredMetadata(getMetadataObject(body.metadata ?? {}));

      const insert = await pool.query<Pick<SecretRow, 'id' | 'expires_at' | 'remaining_reads'>>(
        `
        INSERT INTO secrets (
          ciphertext,
          iv,
          algorithm,
          mime_type,
          metadata,
          status,
          max_reads,
          remaining_reads,
          created_at,
          expires_at,
          auth_fail_count,
          auth_max_attempts,
          manage_token_hash
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5::jsonb,
          'active',
          $6,
          $6,
          NOW(),
          $7,
          0,
          3,
          $8
        )
        RETURNING id, expires_at, remaining_reads
        `,
        [
          body.ciphertext,
          body.iv,
          body.algorithm,
          body.mimeType,
          JSON.stringify(storedMetadata),
          body.maxReads,
          expiresAt.toISOString(),
          body.manageTokenHash ?? null
        ]
      );

      const row = insert.rows[0];
      return reply.code(201).send({ ok: true, secretId: row.id, expiresAt: row.expires_at, remainingReads: row.remaining_reads });
    }
  );

  app.get(
    '/v1/secrets/:id/status',
    {
      config: {
        rateLimit: { max: 30, timeWindow: '1 minute' }
      }
    },
    async (request, reply) => {
      const parsed = secretIdParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.code(400).send({ ok: false, code: 'INVALID_SECRET_ID' });
      }

      const result = await pool.query<Pick<SecretRow, 'id' | 'status' | 'expires_at' | 'remaining_reads' | 'max_reads'>>(
        `
        SELECT id, status, expires_at, remaining_reads, max_reads
        FROM secrets
        WHERE id = $1
        LIMIT 1
        `,
        [parsed.data.id]
      );

      if (result.rowCount === 0) {
        return reply.code(404).send({ ok: false, code: 'NOT_FOUND' });
      }

      const row = result.rows[0];
      if (row.status !== 'active' || isExpired(row.expires_at) || row.remaining_reads <= 0) {
        await pool.query('DELETE FROM secrets WHERE id = $1', [row.id]);
        return reply.code(404).send({ ok: false, code: 'NOT_FOUND' });
      }

      return reply.send({
      ok: true,
      secretId: row.id,
      status: row.status,
      expiresAt: row.expires_at,
      remainingReads: row.remaining_reads,
      maxReads: row.max_reads
    });
    }
  );

  app.post(
    '/v1/secrets/:id/revoke',
    {
      config: {
        rateLimit: { max: 10, timeWindow: '1 minute' }
      }
    },
    async (request, reply) => {
      const parsedParams = secretIdParamsSchema.safeParse(request.params);
      const parsedBody = revokeSecretBodySchema.safeParse(request.body ?? {});

      if (!parsedParams.success) {
        return reply.code(400).send({ ok: false, code: 'INVALID_SECRET_ID' });
      }

      if (!parsedBody.success) {
        return reply.code(400).send({ ok: false, code: 'INVALID_BODY' });
      }

      const result = await pool.query<Pick<SecretRow, 'id' | 'manage_token_hash' | 'status'>>(
        `SELECT id, manage_token_hash, status FROM secrets WHERE id = $1 LIMIT 1`,
        [parsedParams.data.id]
      );

      if (result.rowCount === 0) {
        return reply.code(404).send({ ok: false, code: 'NOT_FOUND' });
      }

      const row = result.rows[0];
      if (row.status !== 'active') {
        await pool.query('DELETE FROM secrets WHERE id = $1', [row.id]);
        return reply.code(404).send({ ok: false, code: 'NOT_FOUND' });
      }

      const providedToken = parsedBody.data.manageToken.trim();
      if (!row.manage_token_hash || !providedToken) {
        return reply.code(401).send({ ok: false, code: 'MANAGE_TOKEN_REQUIRED' });
      }

      if (!hexEqual(sha256Hex(providedToken), row.manage_token_hash)) {
        return reply.code(403).send({ ok: false, code: 'MANAGE_TOKEN_INVALID' });
      }

      await pool.query('DELETE FROM secrets WHERE id = $1', [row.id]);
      return reply.send({ ok: true, secretId: row.id, revoked: true });
    }
  );

  app.post(
    '/v1/secrets/:id/open',
    {
      config: {
        rateLimit: { max: 30, timeWindow: '1 minute' }
      }
    },
    async (request, reply) => {
      const parsedParams = secretIdParamsSchema.safeParse(request.params);
      const parsedBody = openSecretBodySchema.safeParse(request.body ?? {});

      if (!parsedParams.success) {
        return reply.code(400).send({ ok: false, code: 'INVALID_SECRET_ID' });
      }

      if (!parsedBody.success) {
        return reply.code(400).send({ ok: false, code: 'INVALID_BODY' });
      }

      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const selected = await client.query<SecretRow>(
          `
          SELECT id, ciphertext, iv, algorithm, mime_type, metadata, status, max_reads, remaining_reads,
                 created_at, expires_at, auth_fail_count, auth_max_attempts, manage_token_hash
          FROM secrets
          WHERE id = $1
          FOR UPDATE
          `,
          [parsedParams.data.id]
        );

        if (selected.rowCount === 0) {
          await client.query('ROLLBACK');
          return reply.code(404).send({ ok: false, code: 'NOT_FOUND' });
        }

        const row = selected.rows[0];
        if (row.status !== 'active' || isExpired(row.expires_at) || row.remaining_reads <= 0) {
          await deleteSecretById(client, row.id);
          await client.query('COMMIT');
          return reply.code(404).send({ ok: false, code: 'NOT_FOUND' });
        }

        const metadata = getMetadataObject(row.metadata);
        const providedPassphrase = parsedBody.data.passphrase.trim();
        const protectionType = getProtectionType(metadata);
        const remainingAttemptsNow = Math.max(0, row.auth_max_attempts - row.auth_fail_count);

        if (protectionType === 'passphrase') {
          if (!providedPassphrase) {
            await client.query('ROLLBACK');
            return reply.code(400).send({ ok: false, code: 'PASSPHRASE_REQUIRED', remainingAttempts: remainingAttemptsNow });
          }

          const { realVerifier, duressVerifier } = getAuthVerifiers(metadata);
          const isReal = verifyPassphrase(providedPassphrase, realVerifier);
          const isDuress = verifyPassphrase(providedPassphrase, duressVerifier);

          if (!isReal && !isDuress) {
            const nextFailCount = row.auth_fail_count + 1;
            const remainingAttempts = Math.max(0, row.auth_max_attempts - nextFailCount);

            if (nextFailCount >= row.auth_max_attempts) {
              await deleteSecretById(client, row.id);
              await client.query('COMMIT');
              return reply.code(410).send({ ok: false, code: 'ATTEMPTS_EXCEEDED', remainingAttempts: 0 });
            }

            await client.query('UPDATE secrets SET auth_fail_count = $2 WHERE id = $1', [row.id, nextFailCount]);
            await client.query('COMMIT');
            return reply.code(401).send({ ok: false, code: 'PASSPHRASE_INVALID', remainingAttempts });
          }

          if (isDuress) {
            const selectedEnvelope = getSelectedEnvelope(metadata, 'duress');
            const hasDecoy =
              selectedEnvelope &&
              metadata.duressPayload &&
              typeof metadata.duressPayload.ciphertext === 'string' &&
              metadata.duressPayload.ciphertext &&
              typeof metadata.duressPayload.iv === 'string' &&
              metadata.duressPayload.iv;

            await deleteSecretById(client, row.id);
            await client.query('COMMIT');

            if (!hasDecoy) {
              return reply.send({
                ok: true,
                secretId: row.id,
                ciphertext: '',
                iv: '',
                algorithm: row.algorithm,
                mimeType: 'text/plain',
                remainingReads: 0,
                burned: true,
                duressTriggered: true,
                duressNoContent: true,
                selectedEnvelope: null
              });
            }

            return reply.send({
              ok: true,
              secretId: row.id,
              ciphertext: String(metadata.duressPayload?.ciphertext),
              iv: String(metadata.duressPayload?.iv),
              algorithm: row.algorithm,
              mimeType: typeof metadata.duressPayload?.mimeType === 'string' ? String(metadata.duressPayload?.mimeType) : 'text/plain',
              remainingReads: 0,
              burned: true,
              duressTriggered: true,
              duressNoContent: false,
              selectedEnvelope
            });
          }

          const selectedEnvelope = getSelectedEnvelope(metadata, 'real');
          if (!selectedEnvelope) {
            await client.query('ROLLBACK');
            return reply.code(400).send({ ok: false, code: 'MISSING_PROTECTION' });
          }

          const nextRemainingReads = row.remaining_reads - 1;
          if (nextRemainingReads <= 0) {
            await deleteSecretById(client, row.id);
          } else {
            await client.query(
              `UPDATE secrets SET remaining_reads = $2, last_opened_at = NOW(), auth_fail_count = 0 WHERE id = $1`,
              [row.id, nextRemainingReads]
            );
          }

          await client.query('COMMIT');
          return reply.send({
            ok: true,
            secretId: row.id,
            ciphertext: row.ciphertext,
            iv: row.iv,
            algorithm: row.algorithm,
            mimeType: row.mime_type,
            remainingReads: Math.max(0, nextRemainingReads),
            burned: nextRemainingReads <= 0,
            duressTriggered: false,
            duressNoContent: false,
            selectedEnvelope
          });
        }

        const nextRemainingReads = row.remaining_reads - 1;
        if (nextRemainingReads <= 0) {
          await deleteSecretById(client, row.id);
        } else {
          await client.query(
            `UPDATE secrets SET remaining_reads = $2, last_opened_at = NOW(), auth_fail_count = 0 WHERE id = $1`,
            [row.id, nextRemainingReads]
          );
        }

        await client.query('COMMIT');
        return reply.send({
          ok: true,
          secretId: row.id,
          ciphertext: row.ciphertext,
          iv: row.iv,
          algorithm: row.algorithm,
          mimeType: row.mime_type,
          remainingReads: Math.max(0, nextRemainingReads),
          burned: nextRemainingReads <= 0,
          duressTriggered: false,
          duressNoContent: false,
          selectedEnvelope: null
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  );
}

