# DHIS2 Job Status Tool

A DHIS2 application for monitoring the execution of background jobs and queues within a
DHIS2 instance — currently running tasks/jobs (with live progress), recently completed
jobs, and upcoming scheduled jobs. It does a best-effort job of showing correct
information as provided by the API, but cannot be guaranteed to always show correct job
info.

> **Warning**
> This tool is intended for system administrators. It is available as a DHIS2 app but has
> not been through the same rigorous testing as core apps. Use it with care, and test in a
> development environment first.

Built with the [DHIS2 Application Platform](https://platform.dhis2.nu/) (React + TypeScript,
`@dhis2/ui`, `@dhis2/app-runtime`, TanStack Query). This replaces the previous vanilla-JS
(jQuery + Materialize) implementation — see
`docs/superpowers/specs/2026-07-14-app-platform-migration-design.md` for the migration
design.

## Features

- **Running jobs** — polls `jobConfigurations` and `system/tasks` every 5s, showing
  running jobs grouped by queue (with position) or under "Now running", each with a live
  progress line derived from the job's task messages.
- **Last / Upcoming jobs** — recently finished jobs and the next scheduled runs.
- **Job details modal** — task history, with special handling for `PREDICTOR` jobs
  (prediction summary) and `ANALYTICS_TABLE` jobs (parameter breakdown).

Compatible with DHIS2 **v41–v43** (tested end-to-end on all three).

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
pnpm test          # jest unit tests (pure job-parsing logic)
```

End-to-end Playwright tests live in `tests/e2e/` and run against a live instance
(parameterized via `APP_URL` / `SERVER` / `DHIS2_USER` / `DHIS2_PASS` env vars).

### Build a deployable zip

```
pnpm build         # produces build/bundle/job-status-<version>.zip
```

## License

© Copyright University of Oslo. See [LICENSE](./LICENSE).
