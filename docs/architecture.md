# Architecture

## High-level flow

```text
Browser
  ├─ encrypts payload locally
  ├─ uploads ciphertext + minimal metadata
  └─ keeps the content key in the URL fragment (#...)
        |
        v
Nginx
  ├─ routes /api/* to Fastify
  └─ routes web traffic to Next.js
        |
        v
Fastify API
  ├─ stores ciphertext records
  ├─ enforces expiration / max reads / revocation
  └─ returns ciphertext for valid openings
        |
        v
PostgreSQL
  └─ stores secret lifecycle state and ciphertext blobs
```

## Components

### Frontend (`apps/frontend`)

Responsibilities:

- Client-side encryption and decryption
- Link generation and fragment encoding
- Passphrase wrapping and duress UX
- Secret creation and reveal screens
- Preview-blocking middleware for `/s/*`

### Backend (`apps/backend`)

Responsibilities:

- Accept encrypted payload creation requests
- Check secret status and remaining reads
- Revoke links via manage token
- Serve ciphertext for legitimate opens
- Delete consumed, expired, or revoked records

### Database (`infra/postgres`)

Responsibilities:

- Persist ciphertext, IV, metadata, read counters, and expiry timestamps
- Provide a single table (`secrets`) for the MVP runtime
- Run fresh-install bootstrap SQL automatically through Docker init scripts

### Reverse proxy (`infra/nginx`)

Responsibilities:

- Expose one HTTP entrypoint for the internal stack
- Add basic hardening headers
- Proxy `/api/` to the backend and `/` to the frontend

## Data model summary

Main table: `secrets`

Key columns:

- `id`
- `ciphertext`
- `iv`
- `algorithm`
- `mime_type`
- `metadata`
- `status`
- `max_reads`
- `remaining_reads`
- `expires_at`
- `auth_fail_count`
- `auth_max_attempts`
- `manage_token_hash`

## Trust boundaries

### Intended protections

- No plaintext storage in the backend for the main flow
- Link lifecycle constraints enforced server-side
- Key material kept outside normal HTTP requests via URL fragment

### Non-goals / unavoidable exposure

- No protection against screenshots
- No protection against malware on sender or receiver device
- No anonymity guarantees against network observers without external OPSEC controls
- No chunked large-object transport yet
