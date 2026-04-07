# HAPAX VEIL

Self-hosted platform for sharing encrypted messages and attachments through self-destructing links.

Production reference: `https://veil.hapax.online`

## Current status

This repository packages the current MVP runtime as a public, portable version suitable for self-hosting and GitHub publication.

### Implemented

- Client-side encryption for messages and attachment bundles
- Self-destruct links with expiration and max-read controls
- Optional access passphrase
- Optional duress passphrase with text-only decoy flow
- Manual revocation with manage token
- Preview-blocking middleware for common crawlers and unfurlers
- Hidden mode for more discreet reveal UX
- QR generation in the browser
- Automatic cleanup for expired, revoked, or consumed secrets

### Current limitations

- Large files still travel as a single HTTP request to the origin
- Real chunked upload/download is not implemented yet
- The service cannot prevent screenshots, local malware, keyloggers, or exfiltration after reveal
- Redis is intentionally not part of this public repo because the current MVP does not use it

## Stack

- Frontend: Next.js 15 + React 19
- Backend: Fastify + TypeScript
- Database: PostgreSQL 16
- Reverse proxy: Nginx
- Orchestration: Docker Compose

## Repository layout

```text
apps/
  backend/      Fastify API
  frontend/     Next.js web app
infra/
  nginx/        Internal reverse proxy configuration
  postgres/     Init SQL and migration history
scripts/        Repo maintenance helpers
docs/           Architecture, API, deployment notes
compose.yaml    Local / basic self-hosted stack
.env.example    Public configuration template
```

## Quick start with Docker Compose

1. Copy the environment template:

```bash
cp .env.example .env
```

2. Edit `.env` and replace the placeholder values.

3. Start the stack:

```bash
docker compose up --build -d
```

4. Open the service at the address defined by `NGINX_BIND_IP` and `NGINX_HTTP_PORT`.

Example with defaults:

```text
http://127.0.0.1:8080
```

## Local development

### Requirements

- Node.js 22+
- pnpm 10.8.1
- Docker + Docker Compose

### Install dependencies

```bash
corepack enable
corepack prepare pnpm@10.8.1 --activate
pnpm install
```

### Start only PostgreSQL in Docker

```bash
cp .env.example .env
docker compose up -d postgres
```

### Run the backend

```bash
export PGHOST=127.0.0.1
export PGPORT=5432
export PGDATABASE=hapax
export PGUSER=hapax
export PGPASSWORD=change-me-postgres-password
cd apps/backend
pnpm dev
```

### Run the frontend

```bash
cd apps/frontend
pnpm dev
```

## Environment variables

| Variable | Required | Purpose | Example |
|---|---:|---|---|
| `PROJECT_NAME` | no | Docker Compose project name | `hapax-veil` |
| `DOMAIN` | yes | Public hostname for your deployment docs and external proxy | `example.com` |
| `PUBLIC_BASE_URL` | yes | Public origin for the service | `https://example.com` |
| `POSTGRES_DB` | yes | PostgreSQL database name | `hapax` |
| `POSTGRES_USER` | yes | PostgreSQL username | `hapax` |
| `POSTGRES_PASSWORD` | yes | PostgreSQL password | `replace-me` |
| `NGINX_BIND_IP` | yes | Bind address for the internal HTTP listener | `127.0.0.1` |
| `NGINX_HTTP_PORT` | yes | Published HTTP port | `8080` |
| `PGPOOL_MAX` | no | Backend DB pool size | `10` |
| `CLEANUP_INTERVAL_MS` | no | Cleanup loop interval | `60000` |
| `CLEANUP_FIRST_DELAY_MS` | no | Delay before the first cleanup pass | `15000` |

## Security notes

- The server stores ciphertext and lifecycle state, not plaintext content from the main flow.
- Key material is expected to stay client-side and travel in the URL fragment.
- The backend can still observe traffic metadata such as timing, IP, request size, and lifecycle events.
- Do not claim screenshot-proofing or guaranteed receiver endpoint safety; those are outside the platform's control.

See also:

- [`docs/architecture.md`](docs/architecture.md)
- [`docs/api.md`](docs/api.md)
- [`docs/deployment.md`](docs/deployment.md)
- [`SECURITY.md`](SECURITY.md)

## Publish-safety check

Run the repository sanity check before every public push:

```bash
./scripts/repo-sanity-check.sh
```

## License

MIT. See [`LICENSE`](LICENSE).
