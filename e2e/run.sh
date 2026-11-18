#!/usr/bin/env bash
# e2e entry point, contract version 1 (see e2e/README.md).
# Changes and deletes data: run it against a throwaway DHIS2 instance only.
set -u

missing=()
for var in DHIS2_URL DHIS2_USER DHIS2_PASS APP_ZIP RESULTS_DIR; do
    [ -n "${!var:-}" ] || missing+=("$var")
done
if [ ${#missing[@]} -gt 0 ]; then
    echo "run.sh: missing required variables: ${missing[*]} (see e2e/README.md)" >&2
    exit 2
fi
if [ ! -d "$RESULTS_DIR" ]; then
    echo "run.sh: RESULTS_DIR $RESULTS_DIR does not exist" >&2
    exit 2
fi
if ! python3 -c 'import playwright' 2>/dev/null; then
    echo "run.sh: Playwright for Python is missing: pip install -r e2e/requirements.txt && playwright install chromium" >&2
    exit 2
fi

here="$(cd "$(dirname "$0")" && pwd)"
python3 -u "$here/suite.py" 2>&1 | tee "$RESULTS_DIR/suite.log"
exit "${PIPESTATUS[0]}"
