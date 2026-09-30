# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Changed
- Migrated the app from vanilla JS (jQuery + Materialize, webpack) to the DHIS2
  Application Platform (React + TypeScript, `@dhis2/ui`, `@dhis2/app-runtime`,
  TanStack Query). UI rebuilt with `@dhis2/ui`; running-job progress and the details
  modal now use the authoritative per-job task endpoint.
- Dropped the legacy `< 42` header-bar shim — the App Platform provides the shell.

### Fixed
- Analytics "years" now reads the correct `lastYears` job parameter (previously always
  displayed "All").
- Unified the details button label to "View details" everywhere (previously the Last
  jobs list said "Show details" — an inconsistency inherited from the vanilla app).

### Added
- Real error / empty / loading states, colored status tags, manual refresh with an
  "updated Ns ago" indicator, and unit tests for the job-parsing logic.
- **Cancel a running job** — a Cancel action on running-job cards
  (`POST /api/jobConfigurations/{id}/cancel`), guarded by a confirmation dialog, with
  success/error alerts. Cancellation is cooperative (the job stops at its next
  checkpoint). This makes the app mutating; it needs the scheduling authority.
- Component tests for RunningJobs, JobStatusPage, and the Cancel flow.
- Verified end-to-end on DHIS2 v41, v42, and v43.


