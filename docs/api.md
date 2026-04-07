# API

Base path: `/api`

## Health

### `GET /api/health`

Returns a simple liveness payload.

## Secrets

### `POST /api/v1/secrets`

Create a new encrypted secret.

Request body fields:

- `ciphertext`
- `iv`
- `algorithm`
- `mimeType`
- `expiresInSeconds`
- `maxReads`
- `manageTokenHash` (optional)
- `metadata` (optional)

Response:

- `ok`
- `secretId`
- `expiresAt`
- `remainingReads`

### `GET /api/v1/secrets/:id/status`

Returns minimal lifecycle information for a secret that is still alive.

Response:

- `ok`
- `secretId`
- `status`
- `expiresAt`
- `remainingReads`
- `maxReads`

### `POST /api/v1/secrets/:id/open`

Attempts to open a secret.

Request body:

- `passphrase` (optional)

Possible behaviors:

- returns ciphertext and IV for a valid open
- rejects with `PASSPHRASE_REQUIRED`
- rejects with `PASSPHRASE_INVALID`
- burns the secret if the duress passphrase is used
- deletes the record when reads are exhausted or the secret is no longer valid

### `POST /api/v1/secrets/:id/revoke`

Revokes a secret using the manage token.

Request body:

- `manageToken`

Response:

- `ok`
- `secretId`
- `revoked`

## Error model

The API returns JSON objects with `ok: false` and a `code` field for operational errors such as:

- `INVALID_PAYLOAD`
- `INVALID_SECRET_ID`
- `NOT_FOUND`
- `PASSPHRASE_REQUIRED`
- `PASSPHRASE_INVALID`
- `ATTEMPTS_EXCEEDED`
- `MANAGE_TOKEN_REQUIRED`
- `MANAGE_TOKEN_INVALID`
