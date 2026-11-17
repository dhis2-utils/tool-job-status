# Review findings: Job Status Tool 1.0.0 (unreleased changes on `conventions-lint-review`)

Reviewed: 2026-11-17 · Scope: conformance with reference-tool-conventions, linter adoption, code review, functional test · Reviewer: agent (Claude Code, Opus 5.5)
DHIS2 versions tested: 2.40.12, 2.41.11, 2.42.7.1, 2.43.2.1 (empty databases)

## Summary

The tool is in good shape: small, well structured and well tested. The review found two real bugs, both now fixed on this branch with unit tests and e2e checks that fail on the old bundle and pass on the fixed one. The serious one (H1) made "Next run" wrong whenever the browser and the DHIS2 server are in different time zones, which is the usual case for a remote administrator. With this branch merged, the e2e suite passes on 2.40 to 2.43, and the repo meets every machine-checkable rule of reference-tool-conventions except the cleanup of old working notes under `docs/` (C1), which needs the maintainer's decision.

## Findings

### HIGH

#### H1. "Next run" is wrong when the browser and the server are in different time zones (fixed)

- **Where**: `src/utils/jobParsing.ts:262` (`formatTimeUntil`), called from `src/components/JobList.tsx:80`
- **What**: DHIS2 sends `nextExecutionTime` as the server's wall-clock time with no offset (`2026-11-18T01:00:00.000`). `new Date()` read it in the browser's time zone. With the server in UTC, a browser in Asia/Tokyo showed every upcoming job as "Due now", and a browser in America/New_York showed them 5 hours late (live on 2.42.7.1: correct "6h 54m", Tokyo "Due now", New York "11h 54m").
- **Fix**: `parseServerDateTime` (`src/utils/jobParsing.ts:235`) reads such times in `systemInfo.serverTimeZoneId`, which the App Platform already provides, keeps an explicit offset when one is present, and falls back to the browser's zone without a usable zone id. Unit tests cover Tokyo, New York, Oslo across DST, explicit offsets and the fallback, and pass with the test process in several time zones. The e2e check `next-run-matches-api` runs the browser in `Pacific/Kiritimati` (UTC+14) and compares the countdown with the server's own clock; it fails on the 1.0.0 code and passes on the fix.

### MEDIUM

#### M1. "Last jobs" lists jobs that have never run (fixed)

- **Where**: `src/components/JobStatusPage.tsx:31`
- **What**: The filter kept every job with a truthy `lastExecutedStatus`, but DHIS2 reports `NOT_STARTED` for a job that has never run (seen on 2.40 to 2.43). On a new instance, or for new job configurations, those filled the six slots of "Last jobs" with "Last executed N/A".
- **Fix**: exclude `NOT_STARTED`. Component test added; the e2e check `last-matches-api` compares the list with the API and fails on the 1.0.0 code.

### LOW

#### L1. English text outside i18n — `src/utils/jobParsing.ts:39,52,277` and the prediction summary labels — "Running", "Processing", "N/A", "Due now", the `d`/`h`/`m` units and the prediction summary row labels are hard-coded, and `JobStatusTag` shows the raw status enum. Only `en` exists today, so nothing is visibly wrong; move them into `i18n.t` before the first translation.

#### L2. Pass-through test helper — `src/test-utils.tsx:10` — `renderWithProviders` is `render` under another name and provides nothing. Remove it, or make it provide the app-runtime and TanStack contexts so components can be tested without mocking every hook.

#### L3. `executed_by_test.py` is outside the e2e contract — `e2e/executed_by_test.py` — the "started by me" Cancel rule is only checked by this manual script, which needs prepared users and a payload. The restricted-user half was checked by hand in this review (below). Folding it into `run.sh` needs a once-off job that a non-admin user starts and that runs long enough to see; an async import of real metadata would do, at the cost of more cleanup.

## Conformance with reference-tool-conventions

Checked against `conventions.yaml` version 2 and the prose, at reference-tool-conventions `eab82c8`.

| Rule | Before | On this branch |
| --- | --- | --- |
| Lint: Ultracite on Oxlint and Oxfmt (LINTING.md) | ESLint + Prettier | Adopted as LINTING.md describes; `ultracite doctor` 8/8; lint 2.8 s → 1.1 s |
| `ci.yml` / `release.yml` equal to the templates | `ci.yml` had no `permissions`; `release.yml` had `cache: pnpm` and was not safe to re-run | Copied from the templates |
| README header | `**Warning**` (old syntax) | `> [!WARNING]` in its own blockquote |
| README developer topics, link to `docs/user/` | Missing link, release process without RELEASE-WORKFLOW.md, no prerequisites | Rewritten to the DOCS.md list |
| User documentation in `docs/user/` | Missing | `index.yml`, `index.md`, `tool-job-status.md` with the required anchors, 3 screenshots |
| `minDHIS2Version` in `d2.config.js` | Missing | `2.40` |
| e2e in `e2e/` with the `run.sh` contract, warning README, `requirements.txt` | `tests/e2e/`, ad-hoc env vars, default user | `e2e/run.sh` contract version 1, `results.json`, dataStore run record |
| `.sonarcloud.properties` | Missing | The four properties from TESTING.md, plus `src/test-utils.tsx` as test code |
| Team-internal tooling strings | 3 occurrences in `docs/` and a default user in the e2e script | None left |
| Changelog format | `### Upgrading from 0.x`, sections out of order, upgrade note without the role and bookmark points | Fixed; `[Unreleased]` section added |
| C1. Working notes and agent plans under `docs/` | `docs/superpowers/` (agent design spec), `docs/review-2026-07-14-app-platform-migration/STATE-CHANGES.md` (ops log) | **Open**: DOCS.md says `docs/` is not a place for these. Removing them is the maintainer's decision. |

Not checkable from the sandbox: whether CI is green on `main`, whether the v1.0.0 release has the bundle attached, the Dependabot settings, and whether the repo is public.

## Functional checks outside the e2e suite

- A user whose only authority is the app's (`M_tooljobstatus`) can open the tool and read `jobConfigurations` and `system/tasks` on 2.40, 2.41, 2.42 and 2.43 (all 200). The authority id drops the hyphens of the app key.
- That user sees a job that a superuser started under "Now running", without a Cancel button (2.42.7.1).

## Claims investigated and rejected

- **Claim**: the `no-errors` check failed on 2.43 with console errors and 404s, which looked like app errors.
- **Source**: the first e2e runs.
- **Refuted by**: tracing each one. "This window is not a secure context" is logged by the 2.42+ global shell (`/apps/assets/main-*.js`) because the test instance is plain http at a non-localhost name. `staticContent/logo_banner` 404 is the shell asking for a custom logo the instance does not have. `dataStore/custom-translations/controller` 404 is `@dhis2/app-adapter` (`utils/customTranslations.js`) looking for optional custom translations. All three are allowlisted in `e2e/suite.py` with the reason; every other 4xx/5xx still fails the check.

## Environment gaps

- All four versions ran on empty databases, which have only the default job configurations. No scheduler queues, analytics runs or job types that report LOOP progress were exercised in the browser; the progress parsing and queue grouping are covered by unit and component tests only.
- DHIS2 2.40 is out of upstream support (the supported majors are 2.41 to 2.43). It still works, so `minDHIS2Version` is 2.40; raise it when 2.40 support is no longer wanted.
