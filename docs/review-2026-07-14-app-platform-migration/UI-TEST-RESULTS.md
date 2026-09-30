# UI / Functional test results — Job Status (App Platform migration)

**Date:** 2026-07-14
**App:** Job Status tool, migrated to the DHIS2 App Platform (React/TS)
**Test harness:** Playwright (Python), `tests/e2e/job_status_test.py`, run against the
`d2-app-scripts` dev server proxying each instance. Auth via the app-adapter dev login.
**Data:** live demo seeds (not synthetic).

## Instances

| Label | DHIS2 version | Seed | Notes |
|---|---|---|---|
| v43-sl | 2.43.0.1 | Sierra Leone v43 | `admin`/`district` |
| v42-sl | 2.42.5.1 | Sierra Leone v42 | `admin`/`district` |
| v41-laos | 2.41.9 | Laos HMIS demo v41 | seed's `admin` is **disabled**; used `local_admin`/`district` |

Running-job / live-progress paths were exercised by triggering
`POST /api/resourceTables/analytics` on each instance and observing the app while the
`ANALYTICS_TABLE` job ran.

## Results

| Flow | v43 (SL) | v42 (SL) | v41 (Laos) |
|---|---|---|---|
| App loads & authenticates (dev server) | PASS | PASS | PASS |
| Title + "updated Ns ago" + Refresh render | PASS | PASS | PASS |
| "No running jobs" empty state | PASS | PASS | PASS |
| Last jobs list populated (COMPLETED tags) | PASS (6) | PASS (6) | PASS (6) |
| Upcoming jobs list populated (SCHEDULED tags, relative times) | PASS | PASS | PASS |
| Details modal opens & closes | PASS | PASS | PASS |
| Running job appears under "Now running" | PASS | PASS | PASS |
| Scheduler **queue**: grouped container + "Job N of M" position labels | PASS (real queue, 3 jobs) | n/a | n/a |
| Analytics manual-run title ("Analytics table (manual run)") | PASS | PASS | PASS |
| Analytics `lastYears` shown correctly (not always "All") | PASS (Years=1/2) | PASS | PASS |
| Analytics parameter table (included/skipped) | PASS (EVENT=No when skipped) | PASS | PASS |
| Live progress line + LinearLoader (`… — N% complete`) | PASS | PASS | PASS |
| Progress text free of HTML entities (`&#39;`) after fix | PASS | PASS | PASS |
| No page errors (pageerror stream) | PASS | PASS | PASS |
| Installed production bundle in 2.42+ global shell (iframe) | PASS | n/a | n/a |

**Queue test:** created a real DHIS2 scheduler queue (`test-queue`) sequencing three
jobs (ANALYTICS_TABLE → MONITORING → DATA_INTEGRITY) via `POST /api/scheduler/queues`,
fired it, and confirmed the app renders the queue container with all three cards and
"Job 1/2/3 of 3" position labels, the lead job RUNNING with live progress and the rest
SCHEDULED. Screenshots: `v43-queue-running.png` (as found) and `v43-queue-fixed.png`
(after the position-label fix).

**Screenshots** (in `./screenshots/`): `v43-sl-overview.png`, `v43-sl-modal.png`,
`v43-sl-running-fixed.png`, `v42-sl-running.png`, `v41-laos-overview.png`,
`v41-laos-running.png`, `v43-installed-globalshell.png`, `v43-queue-running.png`,
`v43-queue-fixed.png`.

## Cross-version diffs

- **Job API shapes identical across 41/42/43** for everything the app uses:
  `jobConfigurations` (envelope `{ jobConfigurations: [...] }`), `system/tasks`
  (nested map `{ [jobType]: { [jobId]: Task[] } }`), `system/tasks/{type}/{id}`
  (`Task[]`). No version-gating needed; confirmed live on all three.
- **v41 Laos `admin` disabled** — an instance/seed property, not an app issue.
  Handled by using the `local_admin` superuser.
- **2.42 global-shell boundary**: on 2.43 the installed app is served inside the
  global-shell iframe (`/apps/job-status` → iframe `/api/apps/job-status/index.html`).
  The app renders correctly there — the migration correctly relies on the platform
  shell instead of the old legacy-header shim.

## Console 404s (investigated, not app bugs)

Every version logged 404s for `…/staticContent/logo_banner` and (v43)
`…/dataStore/custom-translations/controller`. These are requests made by the DHIS2
**app-adapter / global shell**, not by application code — the app makes no such calls.
Benign; documented in REVIEW-FINDINGS.md under "Claims investigated and rejected".

## Global vs per-job task endpoint (liveness check) — definitive

A deep comparison of the **full task arrays** from the global `system/tasks` map versus
the per-job `system/tasks/{type}/{id}` endpoint, on a live analytics job (v43), sampled
repeatedly:

| | global map | per-job endpoint |
|---|---|---|
| task count for the job | 2 | 67 |
| latest message | `Analytics table update process` (coarse) | `Populating … 'DATA_VALUE'` + `[n/m]` LOOP |
| advances live? | no (frozen) | yes |

**Conclusion: a single endpoint is not sufficient.** The global map is a lagging
summary; the per-job endpoint holds the live progress and full history. The two are
complementary (global = running-job discovery, per-job = live detail), so the per-job
polling is retained. (An earlier single-field snapshot on v41 matched by coincidence; the
deep comparison corrects that.) See REVIEW-FINDINGS.md → "Verified, not a defect".
