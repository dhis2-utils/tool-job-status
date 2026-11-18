# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-11-18

### Changed

- Lint and format with Ultracite (Oxlint and Oxfmt) over the DHIS2 house style,
  replacing ESLint and Prettier.
- `minDHIS2Version` is set to 2.40 in `d2.config.js`.
- The end-to-end suite moved to `e2e/` and follows the `e2e/run.sh` contract of
  reference-tool-conventions.
- User documentation in `docs/user/`.
- Status tags show a translatable label ("Completed", "Stopped") instead of the
  server's status code (`COMPLETED`, `STOPPED`), and the remaining fixed English
  text ("N/A", "Due now", the countdown units, the prediction summary labels) can
  be translated.

### Fixed

- **View details** is shown only for jobs that the server holds task messages for.
  Many job types write none, and the server drops them after 7 days or a restart,
  so the button used to open an empty window.
- The progress bar of a running job spans the whole progress box. It had the
  fixed 300 px default width of the DHIS2 UI loader.
- "Next run" in Upcoming jobs counts down in the server's time zone. DHIS2 sends job
  times without a time zone, and the tool read them in the browser's zone, so when
  the two differed the countdown was off by the difference: a browser 9 hours ahead
  of the server showed every job as "Due now".
- "Last jobs" no longer lists jobs that have never run. DHIS2 reports their last
  status as `NOT_STARTED`, and on a new instance they filled the list.

## [1.0.0] - 2026-09-03

### Upgrading

1.0.0 is a rewrite on the DHIS2 App Platform and is installed under the app key
`tool-job-status`. The 0.x versions were installed under `Job-Status-Tool`, so DHIS2
treats 1.0.0 as a new app:

- After installing it, **uninstall the old "Job Status Tool" app** in the App
  Management app, or two entries remain in the app menu.
- Add the new app to every user role that gave access to the old one. Until then,
  users without the ALL authority cannot open it.
- Bookmarks to the old app URL stop working.

### Added

- **Cancel a running job** (DHIS2 v41+; the endpoint does not exist on 2.40, so the
  action is hidden there) — a Cancel action on running-job cards
  (`POST /api/jobConfigurations/{id}/cancel`), guarded by a confirmation dialog, with
  success/error alerts. Cancellation is cooperative (the job stops at its next
  checkpoint). The button is shown to superusers, users with `F_PERFORM_MAINTENANCE`,
  and the user who started the job — the same rule the server enforces. If the job is
  still running 30 seconds after a cancel request, the button re-enables so the request
  can be retried.
- Real error / empty / loading states, colored status tags, manual refresh with an
  "updated Ns ago" indicator.
- Unit tests for the job-parsing logic and component tests for RunningJobs,
  JobStatusPage, the Cancel flow, and the running-state / cancel-permission hooks.
- Verified end-to-end on DHIS2 v40, v41, v42 and v43.

### Changed

- Migrated the app from vanilla JS (jQuery + Materialize, webpack) to the DHIS2
  Application Platform (React + TypeScript, `@dhis2/ui`, `@dhis2/app-runtime`,
  TanStack Query). UI rebuilt with `@dhis2/ui`; running-job progress and the details
  modal now use the authoritative per-job task endpoint.
- Polling interval is 3 seconds (was 5).
- Dropped the legacy `< 42` header-bar shim — the App Platform provides the shell.
- Build and release moved to GitHub Actions workflows: CI (lint, typecheck, test, build)
  on every pull request, and a tag-triggered release that attaches the bundle.

### Fixed

- Analytics "years" now reads the correct `lastYears` job parameter (previously always
  displayed "All").
- Unified the details button label to "View details" everywhere (previously the Last
  jobs list said "Show details").
- The live progress line no longer flickers back to "Running" when a WARN, ERROR or
  DEBUG notification is interleaved with LOOP/INFO progress lines.
- A finished job is no longer shown as running when the `system/tasks` poll fails while
  `jobConfigurations` keeps refreshing.
- The details modal stays open (with a notice) if the job is deleted or cleaned up by
  the server while it is being read, instead of vanishing.

## [0.2.0] and earlier

Vanilla-JS (jQuery + Materialize) implementation. See the git history.
