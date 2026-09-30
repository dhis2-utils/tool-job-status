# Release 1.0.0 — multi-version test results

**Date:** 2026-09-03
**Bundle:** `build/bundle/tool-job-status-1.0.0.zip`, installed via `POST /api/apps`
**Instances:** disposable, **empty** DHIS2 instances (no seed; only the default job
configurations), 2 GB heap, created through d2-broker. Tested as the `local_admin`
superuser unless stated otherwise.
**Harness:** Playwright (Python) against the installed bundle —
`tests/e2e/installed_app_test.py` and `tests/e2e/executed_by_test.py`.

A long-running job was produced with the built-in `TEST` job type (3 stages × 20 items ×
1.5 s), executed through `POST /api/jobConfigurations/{id}/execute`. On empty databases
`ANALYTICS_TABLE` finishes before the app's first 3 s poll.

## Results

| Flow                                                                   | 2.40.12 | 2.41.9.1 | 2.42.6 | 2.43.1 |
| ---------------------------------------------------------------------- | ------- | -------- | ------ | ------ |
| Bundle installs (`POST /api/apps`), key `tool-job-status`              | PASS    | PASS     | PASS   | PASS   |
| App loads and authenticates                                            | PASS    | PASS     | PASS¹  | PASS¹  |
| Title, "Updated Ns ago", Refresh render                                | PASS    | PASS     | PASS   | PASS   |
| "No running jobs" empty state                                          | PASS    | PASS     | PASS   | PASS   |
| Last / Upcoming lists render (upcoming: 14 / 15 / 15 / 15 jobs)        | PASS    | PASS     | PASS   | PASS   |
| Details modal opens and closes                                         | PASS    | PASS     | PASS   | PASS   |
| Running job appears under "Now running" within one poll                | PASS    | PASS     | PASS   | PASS   |
| Cancel button shown to superuser                                       | hidden² | PASS     | PASS   | PASS   |
| Cancel → confirm → success alert → "Cancelling…"                       | n/a²    | PASS     | PASS   | PASS   |
| Job actually stopped (server `lastExecutedStatus = STOPPED`, ~30 s)    | n/a²    | PASS     | PASS   | PASS   |
| Running card disappears after the job stops                            | PASS    | PASS     | PASS   | PASS   |
| Cancel shown to the non-admin user who started an async import³        | n/a     | —        | —      | PASS   |
| Cancel hidden from another non-admin user for that import³             | n/a     | —        | —      | PASS   |
| Live LOOP progress bar + "… — N% complete" text (metadata import)       | —       | —        | —      | PASS   |
| No page errors (`pageerror` stream)                                    | PASS    | PASS     | PASS   | PASS   |

¹ 2.42+ redirects `/api/apps/tool-job-status/index.html` to the global app shell
(`/apps/tool-job-status`) and renders the app in an iframe; the harness follows that.

² **DHIS2 2.40 has no `POST /api/jobConfigurations/{uid}/cancel` endpoint** (confirmed in
the 2.40 `JobConfigurationController` source; on the instance the request fell through to
the generic collection handler and returned 404 while the job kept running). The app now
hides the Cancel action when the server minor version is below 41. Verified: the running
card renders on 2.40 with no Cancel button.

³ Users `jobtester` / `jobviewer` with a role holding only `F_JOB_LOG_READ`,
`F_METADATA_IMPORT`, `F_DATAELEMENT_PUBLIC_ADD` and the app authority `M_tooljobstatus`.
`jobtester` started `POST /api/metadata?async=true` (8000 data elements, ~10 s); the
resulting `METADATA_IMPORT` job carried `executedBy = jobtester`. Server-side,
`POST …/cancel` returned 403 for `jobviewer`, matching the UI.

## Coverage notes

- **Live LOOP progress bar / percentage:** the built-in `TEST` job type writes no
  notifications to `system/tasks` on any version, so the TEST runs only show the "Running"
  fallback. The `[n/m]`-counter path was verified on 2.43 with the 8000-element metadata
  import ("Creating 8000 DataElement object(s) as jobtester — 42% complete", see
  `screenshots/v43-executedby-owner-running.png`), by unit tests
  (`src/utils/jobParsing.test.ts`), and live with real analytics runs on seeded v41–v43
  instances in the migration review
  (`docs/review-2026-07-14-app-platform-migration/UI-TEST-RESULTS.md`).
- **Scheduler queues:** verified on a seeded v43 instance in the migration review.

## Observations (not defects)

- The `/api/{v}/staticContent/logo_banner` 404 in the console comes from the DHIS2 header
  bar on instances without a custom logo.
- On a fresh instance "Last jobs" lists never-run system jobs with status `NOT_STARTED`
  and "Last executed N/A" (they carry a `lastExecutedStatus`). Inherited from the
  original tool's filtering; harmless on real instances where jobs have run.
- Non-superusers need the app's module authority (`M_tooljobstatus`) to open the app at
  all — standard DHIS2 behaviour for installed apps.

## Screenshots

`screenshots/`: `v40-overview.png`, `v40-running.png` (no Cancel on 2.40),
`v41-cancelling.png`, `v42-running.png`, `v43-cancelling.png`, `v43-after-cancel.png`,
`v43-executedby-owner-running.png`, `v43-executedby-other-running.png`.
