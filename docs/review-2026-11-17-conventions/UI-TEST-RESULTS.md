# UI test results: Job Status Tool (branch `conventions-lint-review`)

**Date:** 2026-11-17
**Bundle:** `build/bundle/tool-job-status-1.0.0.zip`, built from the branch (both fixes included), installed with `POST /api/apps` by the suite
**Instances:** throwaway, **empty** databases (only the default job configurations), server time zone UTC, run as a superuser
**Harness:** `e2e/run.sh` (contract version 1), Playwright for Python, browser time zone `Pacific/Kiritimati` (UTC+14)

## Results

| Test id | 2.40.12 | 2.41.11 | 2.42.7.1 | 2.43.2.1 |
| --- | --- | --- | --- | --- |
| `app-loads` | PASS (top level) | PASS (top level) | PASS (shell iframe) | PASS (shell iframe) |
| `lists-render` | PASS | PASS | PASS | PASS |
| `updated-indicator` | PASS | PASS | PASS | PASS |
| `last-matches-api` | PASS | PASS | PASS | PASS |
| `upcoming-matches-api` | PASS | PASS | PASS | PASS |
| `next-run-matches-api` | PASS | PASS | PASS | PASS |
| `idle-job-not-running` | PASS | PASS | PASS | PASS |
| `execute-job` | PASS | PASS | PASS | PASS |
| `running-card` | PASS | PASS | PASS | PASS |
| `progress-line` | PASS | PASS | PASS | PASS |
| `cancel-visibility` | PASS (hidden) | PASS | PASS | PASS |
| `cancel-flow` | skip¹ | PASS | PASS | PASS |
| `cancel-stops-job` | skip¹ | PASS (`STOPPED`) | PASS (`STOPPED`) | PASS (`STOPPED`) |
| `card-clears` | PASS | PASS | PASS | PASS |
| `in-last-jobs` | PASS | PASS | PASS | PASS |
| `details-modal` | PASS | PASS | PASS | PASS |
| `no-errors` | PASS | PASS | PASS | PASS |
| **Total** | 15 pass, 2 skip | 17 pass | 17 pass | 17 pass |
| Duration | 56 s | 45 s | 54 s | 48 s |

¹ DHIS2 2.40 has no `POST /api/jobConfigurations/{id}/cancel`, so the app hides Cancel there.

Every run ended with the run record in `e2e-state/tool-job-status` deleted, the job configuration deleted and the app uninstalled (checked through the API after the 2.43 run).

## Follow-up run (2026-11-18)

After the low findings were fixed (translatable status labels and text), the suite ran again on 2.43.2.1 against a fresh build: 17/17 passed. The user documentation screenshots were taken again on that instance.

## The fixes, checked against the old code

| Check | 1.0.0 code | Fixed code |
| --- | --- | --- |
| `last-matches-api` (M1), 2.43.2.1 | FAIL: the app listed "Credentials expiry alert", "Dataset notification", "Data statistics", "Data value trim" and the new E2E job, none of which had run | PASS |
| `next-run-matches-api` (H1), 2.42.7.1 | FAIL: "Data value trim" showed "Due now"; the server clock said 6h 22m | PASS ("6h 22m" against 6h 21m) |

By hand on 2.42.7.1, with the 1.0.0 code: the first upcoming job, due at 01:00 server time with the server at 18:05, showed "6h 54m" in a UTC browser, "Due now" in Asia/Tokyo and "11h 54m" in America/New_York.

## Restricted user

On each version a user with only the app authority `M_tooljobstatus` opened the app and read `me`, `jobConfigurations`, `system/tasks` and `system/tasks/{type}/{id}` with 200. On 2.42.7.1 that user saw a running job that a superuser had started, without a Cancel button.

## Not covered

Scheduler queues, analytics jobs and LOOP progress were not exercised in the browser, because empty databases have no queue and the `TEST` job writes no task notifications. Unit and component tests cover them.
