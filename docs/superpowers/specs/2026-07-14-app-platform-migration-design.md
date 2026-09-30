# Job Status Tool — Migration to the DHIS2 App Platform

**Date:** 2026-07-14
**Status:** Approved (design), pending implementation

## Goal

Migrate the existing vanilla-JS Job Status Tool (jQuery + materialize-css, built with
webpack + `d2-manifest`) to the **React-based DHIS2 App Platform** using TypeScript and
`@dhis2/ui`, preserving all current functionality while making modest, clearly-scoped
improvements. The migrated app must run correctly on **DHIS2 v41, v42, and v43**.

## What the current app does (functionality to preserve)

A system-admin tool that monitors background jobs / queues:

1. **Running jobs** — every 5s, polls `jobConfigurations` + `system/tasks`, renders cards
   for jobs that are running, grouped by **queue** (with position labels) or under
   **"Now running"** for independent jobs. `HOUSEKEEPING` jobs are excluded. Each running
   card shows a **live progress** line derived from the job's task messages
   (LOOP messages of the form `[current/total]` → percentage + action text; otherwise the
   latest INFO message; otherwise "Running").
2. **Last Jobs** — up to 6 most-recently-finished non-running jobs (by `lastFinished`).
3. **Upcoming Jobs** — up to 10 `SCHEDULED` jobs (by `nextExecutionTime`), showing time
   until next run.
4. **Job details modal** — task history (latest 5 messages with timestamps), with two
   specials:
   - **PREDICTOR**: parse `PredictionSummary{...}` from a task message → summary table
     (status, predictors, inserted/updated/deleted/unchanged).
   - **ANALYTICS_TABLE**: parameter table showing which analytics table types are
     included/skipped (from `skipTableTypes`, `skipResourceTables`, `skipOutliers`,
     `skipPrograms`), plus a friendlier title for manual runs.
5. **Legacy header-bar shim** for DHIS2 < 42 — **dropped** (the App Platform provides the
   shell/header).

### API endpoints used

| Endpoint | Purpose |
| --- | --- |
| `GET jobConfigurations?paging=false&fields=id,jobType,jobStatus,displayName,jobParameters,lastExecuted,lastExecutedStatus,lastFinished,lastRuntimeExecution,nextExecutionTime,queueName,queuePosition` | All job configs |
| `GET system/tasks` | Global map `{ [jobType]: { [jobId]: Task[] } }` — used to detect running jobs |
| `GET system/tasks/{jobType}/{jobId}` | Per-job task history (progress + modal) |

`Task` shape (observed): `{ id, level, category, time, message, completed }` where
`level ∈ {INFO, LOOP, ERROR, WARN, DEBUG}`.

## Target architecture

Standard App Platform bootstrap (see skill `references/bootstrapping.md`): Vite, hash
router, `@dhis2/app-runtime`, `@dhis2/ui`, TanStack Query v4, `@` path alias. **Single-view
tool** → no sidebar, no TanStack Table (skill's single-view exception).

```
src/
  App.tsx                         providers + single route
  utils/
    SyncUrlWithGlobalShell.tsx    (bootstrap)
    useApiDataQuery.ts            (bootstrap)
    jobParsing.ts                 pure logic (progress, prediction summary,
                                  analytics params, time-until) + jobParsing.test.ts
  interfaces/apiQueryTypes.ts     (bootstrap)
  types/jobs.ts                   JobConfiguration, JobParameters, Task, EnhancedJob
  hooks/
    useJobs.ts                    jobConfigurations + system/tasks, 5s poll -> EnhancedJob[]
    useJobTasks.ts                system/tasks/{type}/{id}, 5s poll while active
  components/
    JobStatusPage.tsx             layout, loading/error/empty, refresh + "updated Ns ago"
    RunningJobs.tsx               grouping into queues / "Now running"
    JobCard.tsx                   default + analytics-table variants, status Tag
    JobProgress.tsx               live progress line for a running job
    JobList.tsx                   Last Jobs / Upcoming Jobs
    JobDetailsModal.tsx           task history + predictor/analytics specials
```

## Data layer — correctness first

**Constraint from the user:** not all task endpoints reliably show current, live data;
no live detail may be lost in the migration.

Therefore:

- `useJobs()` polls `jobConfigurations` + the global `system/tasks` every 5s. The global
  map is used **only** to compute `isRunning` per job (cheap, and how the original detects
  running state).
- **Running-job progress and the modal use the per-job `system/tasks/{jobType}/{jobId}`
  endpoint** (`useJobTasks`), faithfully matching the original. This guarantees the live
  per-job detail is preserved.
- **Possible simplification (only if proven safe):** during the review phase, empirically
  compare the global `system/tasks` task arrays against the per-job endpoint on a *live
  running job* across v41–43. Only if they are demonstrably identical and equally live will
  progress be derived from the already-fetched global map (dropping per-job polling for
  cards). If there is any divergence, per-job polling stays. Correctness over cleverness.

Progress polling is only active for jobs currently running, and the modal poll only runs
while the modal is open and its job is running — so we don't fan out requests for idle jobs.

Caching: job data is "data" not "metadata" → short/no stale time, `refetchInterval: 5000`.

## Small improvements (approved "+improvements" scope)

1. **Real error state** — `NoticeBox` on poll failure instead of silent `console.error`.
2. **Loading / empty states** — `CircularLoader`; explicit "No running jobs".
3. **Accessibility & safety** — real `Button onClick` handlers; no inline `onclick`
   strings; no `innerHTML` of raw API strings (render as React text). Status shown as a
   colored `@dhis2/ui` `Tag`.
4. **Human-readable times** — friendly relative time for "next run" and timestamps.
5. **Manual refresh + "updated Ns ago"** indicator in a small page header.

These are additive; no existing behavior is removed except the legacy header shim and unused
build deps (jQuery, materialize, chart.js, datatables, choices).

## Version handling (v41–v43)

- Read the `jobConfigurations` / `system/tasks` contracts from `@dhis2/api-types` specs
  (v41–v43) and confirm on live instances during review.
- If a real shape/behavior difference appears between versions, add it to a centralized
  `src/utils/support.ts` feature map + `useFeature` hook (per skill) rather than inline
  checks. Not added pre-emptively.

## Testing & review

- **Unit tests** for `jobParsing.ts` (progress extraction, prediction-summary parsing,
  analytics inclusion, time-until) — the regression-prone logic.
- **End-to-end review** (skill `dhis2-app-review`): static code review + Playwright
  functional testing against live instances on **v41, v42, v43**, using a mix of
  **Sierra Leone** and **Laos** seeded instances. Severity-ranked report.

## Out of scope

- Redesigning the monitoring UX beyond the listed improvements.
- Mutations (the tool is read-only monitoring; `d2api.js` had POST/PUT/DELETE helpers but
  the app only ever GETs).
- Backporting to DHIS2 < 41.
