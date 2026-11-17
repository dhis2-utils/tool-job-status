# DHIS2 Job Status Tool

> ![Maturity: Validated](https://img.shields.io/badge/maturity-Validated-yellow)  
> Intended use: provide a visual overview of running and scheduled jobs.  
> Maintainers: HISP Centre implementation team.

> [!WARNING]
> This tool is intended for system administrators. It is available as a DHIS2 app but has not been through the same rigorous testing as core apps. Use it with care, and test in a development environment first.

The Job Status Tool shows the background jobs of a DHIS2 instance: running jobs with live progress, recently finished jobs and the next scheduled runs, and it lets an administrator cancel a running job. The user documentation is in [`docs/user/`](docs/user/tool-job-status.md).

Built with the [DHIS2 Application Platform](https://developers.dhis2.org/docs/app-platform/getting-started) (React, TypeScript, `@dhis2/ui`, `@dhis2/app-runtime`, TanStack Query).

## Supported DHIS2 versions

2.40 to 2.43. Cancelling a job needs 2.41 or later; on 2.40 the Cancel button is hidden, because 2.40 has no cancel endpoint. `minDHIS2Version` in `d2.config.js` is 2.40.

## Prerequisites

- Node.js 22
- pnpm, in the version that `packageManager` in `package.json` names (`corepack enable` picks it up)
- A DHIS2 instance to run against, for example a local one started as described in [DHIS2 in Docker](https://developers.dhis2.org/docs/tutorials/dhis2-docker/)

## Install the dependencies

```bash
pnpm install
```

## Start the tool against a local instance

```bash
pnpm start --proxy http://localhost:8080 --proxyPort 8081
```

The proxy listens on port 8080 unless you choose another, so `--proxyPort` keeps it off the instance's port. Open the URL that the dev server prints (usually `http://localhost:3000`), and sign in with `http://localhost:8081` as the server URL and a user of the instance.

## Test, lint and build

```bash
pnpm test     # Jest unit and component tests (src/**/*.test.ts[x])
pnpm lint     # Ultracite: Oxlint and Oxfmt over the DHIS2 house style
pnpm format   # format with Oxfmt
pnpm build    # build/bundle/tool-job-status-<version>.zip
```

The end-to-end suite in [`e2e/`](e2e/README.md) installs the built bundle on a throwaway instance and drives it with Playwright for Python. Read the warning in `e2e/README.md` before you run it.

Linting follows [LINTING.md](https://github.com/dhis2-utils/reference-tool-conventions/blob/main/LINTING.md) in reference-tool-conventions. `AGENTS.md` describes the house style for coding agents, and `.claude/` holds a Claude Code hook that lints each edited file. Nothing depends on them.

## Release

Releases follow [RELEASE-WORKFLOW.md](https://github.com/dhis2-utils/reference-tool-conventions/blob/main/RELEASE-WORKFLOW.md) in reference-tool-conventions:

1. Bump `version` in `package.json` and add a `## [x.y.z]` section at the top of `CHANGELOG.md`.
2. Merge to `main` and let CI pass.
3. Tag the merged commit: `git tag vx.y.z && git push origin vx.y.z`.

The tag starts `.github/workflows/release.yml`, which builds the bundle and creates the GitHub release with the zip attached and the changelog section as release notes.

## License

© Copyright University of Oslo. BSD-3-Clause, see [LICENSE](./LICENSE).
