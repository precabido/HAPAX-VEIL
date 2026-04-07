# Deployment notes

## Baseline

The included `compose.yaml` is designed for a self-hosted deployment where Docker publishes an internal HTTP listener and an external reverse proxy terminates TLS.

Default behavior:

- Docker publishes Nginx on `127.0.0.1:8080`
- PostgreSQL stays internal to the compose network
- The app stack is reachable only through the published Nginx listener

## Recommended production shape

```text
Internet
  -> Caddy / Nginx / Traefik with TLS
    -> 127.0.0.1:8080 (compose nginx)
      -> frontend + backend + postgres
```

## First deployment

```bash
cp .env.example .env
nano .env
docker compose up --build -d
docker compose ps
```

## Inspect logs

```bash
docker compose logs -f nginx
docker compose logs -f frontend
docker compose logs -f backend
docker compose logs -f postgres
```

## Stop / restart

```bash
docker compose stop
docker compose restart
docker compose down
```

## Data persistence

The compose stack writes PostgreSQL data to `./storage/postgres`.

Before making the repository public, this path must remain untracked. The provided `.gitignore` already excludes it.

## Existing deployments

For an already-populated database, review `infra/postgres/migrations/` before applying changes manually. Fresh installs use `infra/postgres/init/10-schema.sql` automatically.
