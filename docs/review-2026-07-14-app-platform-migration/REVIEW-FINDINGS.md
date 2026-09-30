# Review findings — Job Status App Platform migration

**Date:** 2026-07-14
**Scope:** code review + functional test of the migrated App Platform app, across
DHIS2 v41 (Laos), v42 (SL), v43 (SL), including a real scheduler **queue**.
**Baseline gates:** `tsc --noEmit` clean, `eslint src` clean, `prettier -c` clean,
**29/29** tests pass, production bundle builds, i18n extracts cleanly.

Overall: **the migration is functionally complete and works on all three target
versions**, for idle, running-job (live progress), **queue** (grouped, with position
labels), list, and details-modal flows, and as an installed app inside the 2.42+ global
shell. All issues found have been fixed (see below) — there are no open blockers.

References use `file:line`.

## Fixed during review

- **[HIGH → fixed] Progress line showed literal `&#39;` HTML entities.**
  `JobProgress` passed the task message through `i18n.t()` interpolation, which
  HTML-escapes values, so `Populating 'DATA_VALUE'` rendered as `…&#39;DATA_VALUE&#39;`.
  Fixed by rendering the message as a raw JSX child and translating only the numeric
  suffix. `src/components/JobProgress.tsx`. Before/after:
  `screenshots/v43-sl-running.png` → `screenshots/v43-sl-running-fixed.png`.
- **[LOW → fixed] i18n `count` param would be dropped by the extractor.**
  `formatUpdatedAgo` used `{{count}}`; renamed to `{{seconds}}`/`{{minutes}}`.
  `src/components/JobStatusPage.tsx`.
- **[LOW → fixed] Timestamps shown as raw ISO strings.** Added `formatDateTime`
  (`2026-07-14T11:20:40.057` → `2026-07-14 11:20:40`) and `formatDuration`
  (`00:08:33.965` → `00:08:33`), applied in the cards, lists, and modal. Verified in
  `screenshots/v43-queue-fixed.png`. `src/utils/jobParsing.ts`.
- **[LOW → fixed] Analytics element list didn't match the current enum.** Aligned
  `ANALYTICS_TABLE_ELEMENTS` to the full `AnalyticsTableType` enum — added
  `ORG_UNIT_TARGET` and `VALIDATION_RESULT` — while keeping `RESOURCE_TABLES` /
  `OUTLIER_STATISTICS` as their own boolean-driven rows. `src/utils/jobParsing.ts`.
- **[LOW → fixed] No component/hook tests.** Added `RunningJobs.test.tsx` (empty,
  HOUSEKEEPING-excluded, independent, and queue+position-label branches) and
  `JobStatusPage.test.tsx` (loading, error, empty) — 11 new tests. Pure logic already
  had 18; suite is now 29.
- **[LOW → fixed] Queue position label overlapped the status tag.** Seen once the queue
  was tested live (`screenshots/v43-queue-running.png`); the absolutely-positioned label
  collided with the `Tag`. Moved it into normal flow above the card header.
  `src/components/JobCard.module.css`. Verified: `screenshots/v43-queue-fixed.png`.

## Verified, not a defect: single-endpoint polling is insufficient

The design polls the global `system/tasks` map (to discover running jobs) **and** the
per-job `system/tasks/{type}/{id}` endpoint (for live progress + modal history). We
tested whether the per-job polling could be dropped in favour of the global map alone
(to remove the apparent duplication). **It cannot.** On a live analytics job (v43), a
deep comparison of the full task arrays showed:

- global map: **2** tasks, a coarse summary (`"Analytics table update process"`), **not
  advancing**;
- per-job endpoint: **67** tasks with the live detail (`Populating … 'DATA_VALUE'`, the
  `[n/m]` LOOP counter), advancing in real time.

So the two endpoints are **complementary, not duplicate**: global = cheap running-job
discovery, per-job = authoritative live detail. The per-job polling is required and
retained. (An earlier single-field snapshot on v41 had matched by coincidence; the deep,
repeated comparison is definitive.) In practice the request rate is modest: queues run
sequentially, so typically **one** job is running at a time → ~3 requests / 5 s.

## Minor / informational

- **[LOW] No error backoff on the poll.** Polling continues at a fixed 5 s even after
  repeated request failures (the error `NoticeBox` is shown meanwhile). Fine for an admin
  tool; a backoff could be added. Note: polling already **pauses when the browser tab is
  unfocused** — TanStack Query's `refetchInterval` does not fire in the background by
  default (`refetchIntervalInBackground: false`), so there is no wasted background
  traffic. `src/hooks/useJobs.ts`, `src/hooks/useJobTasks.ts`.
- **[LOW] Main JS chunk is ~657 KB (204 KB gz), above Vite's 500 KB warning.** Mostly the
  `@dhis2/ui` + app-runtime baseline; acceptable for a single-view internal tool. A
  vendor `manualChunks` split would silence the warning if desired.

## Claims investigated and rejected

- **Console 404s are not app bugs.** `…/staticContent/logo_banner` and (v43)
  `…/dataStore/custom-translations/controller` originate from the DHIS2 app-adapter /
  global shell, not application code. Benign.
- **"Polling runs full-rate in a backgrounded tab" — false.** TanStack Query pauses
  interval refetches when the window is unfocused by default; no change needed. (Corrects
  an earlier draft of this report.)

## Architecture

The migration lands correctly: the app now uses `@dhis2/app-runtime` (auth, versioning,
error handling), `@dhis2/ui` (consistent look, global-shell integration), i18n, and
TanStack Query — replacing the hand-rolled fetch wrapper, jQuery/Materialize UI, and the
manual `<42` header-bar shim. API usage is version-agnostic across 41–43 for every
endpoint the app touches, verified live. No further architectural change recommended.
