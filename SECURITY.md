# Security policy

## Supported scope

This repository is the public MVP codebase for HAPAX VEIL.

Supported for security reports:

- current default branch
- current Docker Compose deployment path
- current API endpoints under `/api/v1/secrets`

## Reporting a vulnerability

Do not open public issues for suspected vulnerabilities.

Send a private report that includes:

- affected commit or branch
- impact summary
- reproduction steps
- proof of concept
- proposed remediation if available

If you are maintaining a fork, remove any production secrets before sharing evidence.

## Disclosure expectations

- no destructive testing against third-party infrastructure
- no automated high-volume abuse
- no publication of live secrets, tokens, or private user material
