# Backend №3 integration result

Дата: 2026-09-11.

- Core source: `fd0846e92cc8c83330c07beba682dfec60c4542f`
- Tournament source: `a5d32bb2222f26d314cda03eefcdf9ee9bcf2306`
- Target: `integration/backend-tournament`
- Backend strict verify: 368/368 PASS, 0 skipped
- Backend №3 original suite: 37/37 PASS
- Formerly BLOCKED: 18/18 PASS
- Core↔Tournament: 5/5 PASS
- Frontend production build: PASS
- Fresh Flyway v0→v301: PASS
- Existing Core Flyway v4→v301: PASS
- Restart/retry/duplicate/atomic rollback: PASS
- Docker build/smoke: BLOCKED by host — Windows-container daemon only; Linux daemon, WSL and Compose plugin are absent

Подробности: [backend-tournament-integration.md](backend-tournament-integration.md), [acceptance-tests.md](acceptance-tests.md).
