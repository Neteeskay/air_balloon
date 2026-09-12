# Air Balloon — Final Demo Evidence Pack

## Release identity

- Release branch: `release/demo-final`
- Release source: `fix/final-demo-polish`
- Source SHA before release-only changes: `689cebe02c370da99d8d2ba8441275e7febe97ec`
- Release date: 2026-09-11
- Final verification completed: 2026-09-11
- Planned annotated tag: `demo-final-2026-09-11`

## Run locally

Requirements: Docker Desktop with Compose, Java/Maven or the repository Maven wrapper, and Node.js/npm for the local test suites.

```bash
docker compose up -d --build --wait
```

The default URLs are:

- Frontend: `http://127.0.0.1:${FRONTEND_PORT:-5173}` (значение задаётся в `.env`)
- Backend health: http://127.0.0.1:8080/actuator/health

PostgreSQL and Flyway migrations start automatically. The demo profile provides these login-enabled profiles:

| Login | Password |
| --- | --- |
| `anna` | `balloon1` |
| `maks` | `balloon2` |
| `liza` | `balloon3` |

## Verified release gates

| Gate | Result |
| --- | --- |
| Backend | 381/381 PASS |
| Frontend | 32/32 PASS |
| E2E | 38/38 PASS |
| Typecheck | PASS |
| Lint | PASS |
| Build | PASS |
| Docker clean-room | PASS |
| Chromium | PASS |
| Firefox | PASS |
| WebKit | PASS |

The evidence run used a fresh Compose project and fresh PostgreSQL volume. The clean database applied all eight source migrations through `V303`.

## Evidence files

Raw Playwright logs and HTML output remain ignored under `artifacts/acceptance/`; this release pack records the concise, reviewable results instead of committing giant logs.
