# Contributing

## Ground rules

- do not commit secrets, `.env` files, build artifacts, runtime state, or database dumps
- prefer small, reviewable pull requests
- keep security-sensitive changes explicit and well documented
- document any new environment variable in `.env.example` and `README.md`

## Setup

```bash
corepack enable
corepack prepare pnpm@10.8.1 --activate
pnpm install
```

## Validation

Run before opening a pull request:

```bash
cd apps/backend && pnpm typecheck && pnpm build
cd ../frontend && pnpm typecheck && pnpm build
cd ../..
./scripts/repo-sanity-check.sh
```

## Pull requests

Include:

- problem statement
- scope of the change
- security impact
- migration notes if schema or deployment behavior changed
