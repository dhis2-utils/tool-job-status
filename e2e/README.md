> [!WARNING]
> This suite changes and deletes data. It installs and uninstalls the app, creates and deletes two job configurations, runs and cancels a job, and regenerates the resource tables. Run it only against a throwaway DHIS2 instance that you can reset or recreate, never against a server that holds work you want to keep.

# End-to-end tests

The suite drives the built app on a live DHIS2 instance with Playwright for Python. It follows the `e2e/run.sh` contract (version 1) of [reference-tool-conventions](https://github.com/dhis2-utils/reference-tool-conventions/blob/main/TESTING.md).

## Get a throwaway instance

Start a local DHIS2 instance as described in [DHIS2 in Docker](https://developers.dhis2.org/docs/tutorials/dhis2-docker/). An empty database is enough: the suite only needs the job configurations that every instance has, and it creates the job it runs. The user must have the `ALL` authority.

## Run it

```bash
pip install -r e2e/requirements.txt
playwright install chromium
pnpm build

mkdir -p /tmp/e2e-results
DHIS2_URL=http://localhost:8080 DHIS2_USER=<superuser> DHIS2_PASS=<password> \
APP_ZIP=$PWD/build/bundle/tool-job-status-1.0.0.zip RESULTS_DIR=/tmp/e2e-results \
  e2e/run.sh
```

| Variable                   | Required | Meaning                                                            |
| -------------------------- | -------- | ------------------------------------------------------------------ |
| `DHIS2_URL`                | yes      | Instance base URL, no trailing slash                               |
| `DHIS2_USER`, `DHIS2_PASS` | yes      | A user with the `ALL` authority                                    |
| `APP_ZIP`                  | yes      | Absolute path of the built bundle                                  |
| `RESULTS_DIR`              | yes      | Existing directory for `results.json`, `suite.log` and screenshots |
| `LABEL`                    | no       | Label for output and screenshot names; default: the server version |
| `APP_KEY`                  | no       | Default: the key the server reports for the installed app          |

Exit codes: `0` every test passed, `1` a test failed, `2` the suite could not run (the `error` field in `results.json` says which stage failed).

## What it tests

| Test id                                               | Checks                                                                                                                                           |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app-loads`                                           | The installed app renders its title (inside the global shell iframe on 2.42 and later)                                                           |
| `lists-render`, `updated-indicator`                   | The Last and Upcoming lists and the "Updated" indicator are shown                                                                                |
| `last-matches-api`, `upcoming-matches-api`            | Both lists show the jobs, in the order, that the API says they should                                                                            |
| `next-run-matches-api`                                | The countdown to the first upcoming job matches the server's clock, with the browser in a time zone far from the server's (`Pacific/Kiritimati`) |
| `idle-job-not-running`, `execute-job`, `running-card` | A `TEST` job appears under "Now running" after it is started                                                                                     |
| `progress-line`                                       | The running card shows a progress line                                                                                                           |
| `cancel-visibility`                                   | Cancel is shown to a superuser on 2.41 and later, and hidden on 2.40, which has no cancel endpoint                                               |
| `cancel-flow`, `cancel-stops-job`                     | Cancel and confirm show the success alert, and the server then reports the job as `STOPPED` (skipped on 2.40)                                    |
| `card-clears`                                         | The card leaves "Now running" once the job has stopped                                                                                           |
| `in-last-jobs`, `details-hidden`                      | The finished `TEST` job is in Last jobs, without View details, because `TEST` writes no task messages                                            |
| `details-modal`                                       | A `RESOURCE_TABLE` run, which writes task messages, has View details, and its modal shows the newest message the API holds                       |
| `no-errors`                                           | No page errors, console errors or failed responses, apart from the platform messages listed in `suite.py`                                        |

## Seeding and cleanup

The suite creates two job configurations, a `TEST` job and a `RESOURCE_TABLE` job, with run-unique names that start with `E2E tool-job-status <timestamp>`. Before creating each, it records the UID in the dataStore at `e2e-state/tool-job-status`. Every run first deletes whatever that record still lists, so a run that was killed half-way is cleaned up by the next one. After a clean run the record is gone and the app is uninstalled.

## Optional manual check

`executed_by_test.py` checks the "started by me" rule for Cancel with two non-admin users and an async metadata import. It needs users and a payload that you prepare yourself; see the docstring at the top of the file.
