# State changes — 2026-07-14 review

All persistent changes made during testing, and their disposition.

## Broker test instances (all deleted)

| Instance | Version | Seed | Disposition |
|---|---|---|---|
| agent-jobstatus-v43 | 2.43.0.1 | Sierra Leone v43 | **deleted** |
| agent-jobstatus-v42 | 2.42.5.1 | Sierra Leone v42 | **deleted** |
| agent-jobstatus-v41 | 2.41.9 | Laos HMIS demo v41 | **deleted** |
| agent-jobstatus-q | 2.43.0.1 | Sierra Leone v43 | **deleted** (queue-rendering test) |

On `agent-jobstatus-q` we also created three job configurations and a scheduler queue
(`test-queue`) via `POST /api/scheduler/queues` to exercise the queue UI. All discarded
with the instance.

Verified: `GET /instances` returns `{"instances": []}`. Nothing left running.

## Per-instance mutations (all on now-deleted disposable instances)

- **`corsWhitelist`**: added `http://localhost:49251` (the dev-server origin) on each
  instance so the dev server could call the API. Not reverted — instances deleted.
- **Analytics runs**: triggered `POST /api/resourceTables/analytics` on each instance to
  exercise the running-job/progress UI. This populated `analytics_*` tables. Not
  reverted — instances deleted.
- **App install (v43 only)**: installed the production bundle via `POST /api/apps`
  (HTTP 201) to verify the 2.42+ global-shell integration, then **uninstalled** it via
  `DELETE /api/apps/job-status` (HTTP 204) before deleting the instance.

## Repository changes

- **Source fixes** applied during review (committed): `JobProgress.tsx` (HTML-entity
  escaping) and `JobStatusPage.tsx` (`count` → `seconds`/`minutes` i18n param). See
  REVIEW-FINDINGS.md → "Fixed during review".
- **New review artefacts** (this folder) and the Playwright suite (`tests/e2e/`) added.
- No system-setting or config files on the host were touched (the app has no
  `d2auth.json`; the App Platform dev server was configured via CLI flags only).

## Left running

Nothing. All broker instances deleted; the local dev server was stopped.
