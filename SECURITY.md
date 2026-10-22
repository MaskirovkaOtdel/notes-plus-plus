# Security

## Reporting a vulnerability

Please report security issues privately via GitHub security advisories
(Reporting → New draft security advisory on this repository) rather than a
public issue. You will get an acknowledgement and a fix or mitigation plan
before any public disclosure.

## Security model

Notes++ is a **personal, single-user** notes application. Its posture:

- **Network.** The API binds to `127.0.0.1` by default — nothing is
  reachable from other machines unless you change `HOST`. The Docker
  container binds `0.0.0.0` _inside its private network_ and publishes the
  port to the host, which is the same exposure as any locally run service.
- **Authentication.** None by default (a loopback-bound personal instance
  needs none). Set `NOTESPP_API_TOKEN` to require a bearer token on every
  route except `GET /health`. The comparison is constant-time. The web app
  sends the token when built with the matching `VITE_API_TOKEN`.
- **Transport.** Plain HTTP. Anything beyond localhost should sit behind a
  TLS-terminating reverse proxy.
- **Storage.** Postgres with the credentials you provide. The compose file
  uses a development default password; rotate it
  (`NOTESPP_DB_PASSWORD`). Note bodies are stored unencrypted at rest —
  use disk/volume encryption if that matters for your threat model.
- **Input handling.** All API payloads validate against Zod schemas; the
  API is not an HTML renderer (the web client sanitizes rendered Markdown
  with DOMPurify).
- **Multi-tenant.** No. There is one trust domain; anyone who can reach the
  API with the token has full read/write access to every note.

## Exposure checklist

Before sharing an instance beyond your own machine:

1. `NOTESPP_API_TOKEN` set, token is high-entropy, UI rebuilt with
   `VITE_API_TOKEN`.
2. TLS at a reverse proxy; HTTP not exposed.
3. Postgres password rotated; Postgres port (`5432`) **not** published to
   the host (remove the `ports` mapping — the app reaches it on the compose
   network).
4. Instance kept updated (GitHub Dependabot alerts / release notes).

## Verified by

- Unit tests: 401 without/with wrong token, 200 with correct token,
  `/health` exempt, dotfiles not served, no directory listing.
- Live probes: loopback-only default confirmed unreachable over the LAN;
  `HOST=0.0.0.0` with token returns 401/200 as specified.
- Dependency scanning and the CI suite on every change.
