# DHIS2 Job Status Tool

> ![Maturity: Validated](https://img.shields.io/badge/maturity-Validated-yellow)  
> Intended use: provide a visual overview of running and scheduled jobs.  
> Maintainers: HISP Centre implementation team.
>
> **Warning**
> This tool is intended for system administrators. It is available as a DHIS2 app but has
> not been through the same rigorous testing as core apps. Use it with care, and test in a
> development environment first.

A DHIS2 application for monitoring the execution of background jobs and queues within a
DHIS2 instance — currently running tasks/jobs (with live progress), recently completed
jobs, and upcoming scheduled jobs. It does a best-effort job of showing correct
information as provided by the API, but cannot be guaranteed to always show correct job
info.

Built with the [DHIS2 Application Platform](https://platform.dhis2.nu/) (React + TypeScript,
`@dhis2/ui`, `@dhis2/app-runtime`, TanStack Query). This replaces the previous vanilla-JS
(jQuery + Materialize) implementation — see
`docs/superpowers/specs/2026-07-14-app-platform-migration-design.md` for the migration
design.

## Features

- **Running jobs** — polls `jobConfigurations` and `system/tasks` every 3s, showing
  running jobs grouped by queue (with position) or under "Now running", each with a live
  progress line derived from the job's task messages.
- **Cancel a running job** (DHIS2 v41+) — asks the server to stop the job at its next
  checkpoint (`POST /api/jobConfigurations/{id}/cancel`), after a confirmation dialog.
  The button is shown to superusers, users with the `F_PERFORM_MAINTENANCE` authority, and the user
  who started the job — the same rule the server enforces.
- **Last / Upcoming jobs** — recently finished jobs and the next scheduled runs.
- **Job details modal** — task history, with special handling for `PREDICTOR` jobs
  (prediction summary) and `ANALYTICS_TABLE` jobs (parameter breakdown).

Compatible with DHIS2 **v40–v43** (tested end-to-end on all four).

## Installing and upgrading

Download `tool-job-status-<version>.zip` from the
[releases](../../releases) page and upload it in the DHIS2 App Management app.

**Upgrading from 0.x:** 1.0.0 is installed under a new app key (`tool-job-status`; the
0.x versions used `Job-Status-Tool`), so DHIS2 treats it as a new app. Uninstall the
old "Job Status Tool" app in App Management after installing 1.0.0, or two entries
remain in the app menu.

## Getting started

Install dependencies (this project uses **pnpm**):

```
pnpm install
```

### Start the dev server

```
pnpm start --proxy https://your-dhis2-instance
```

Then open the app and sign in with the instance's server URL and credentials.

### Run tests

```
pnpm test          # jest unit + component tests
pnpm lint          # eslint + prettier
```

Playwright (Python) end-to-end scripts live in `tests/e2e/` (requires
`pip install playwright && playwright install chromium`):

- `installed_app_test.py` — runs against the **installed bundle** on a live instance
  (`BASE`, `USER_`, `PASS_`, `LABEL`, `SHOT_DIR`, `EXPECT_CANCEL` env vars): loads the app,
  checks the lists and details modal, runs a built-in `TEST` job and exercises Cancel.
  Used for the v40–v43 release test, see `docs/release-1.0.0-test/RESULTS.md`.
- `executed_by_test.py` — verifies the "started by me" cancel rule with non-admin users.
- `job_status_test.py` — smoke test against the dev server (`APP_URL`, `SERVER`,
  `DHIS2_USER`, `DHIS2_PASS`).

### Build a deployable zip

```
pnpm build         # produces build/bundle/tool-job-status-<version>.zip
```

### Releasing

CI runs lint, typecheck, tests and the build on every pull request. Pushing a tag
`vX.Y.Z` builds the bundle, extracts the matching `CHANGELOG.md` section and creates a
GitHub release with the zip attached. Bump `version` in `package.json` and add the
changelog section before tagging.

## License

© Copyright University of Oslo. See [LICENSE](./LICENSE).
