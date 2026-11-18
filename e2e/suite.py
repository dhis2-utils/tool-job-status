#!/usr/bin/env python3
"""
End-to-end suite for the Job Status Tool (e2e/run.sh contract version 1).

Installs the built bundle on a throwaway DHIS2 instance, creates one TEST job
configuration with a run-unique name, and drives the installed app through
Playwright: page load, the Last / Upcoming lists, a running job card, Cancel
(DHIS2 2.41+; hidden on 2.40, where the endpoint does not exist) and the
details modal. Every check that depends on a write reads the server state
back through the API. Writes $RESULTS_DIR/results.json.

Read e2e/README.md first: this suite changes and deletes data.

Inputs (environment, no defaults): DHIS2_URL, DHIS2_USER, DHIS2_PASS,
APP_ZIP, RESULTS_DIR. Optional: LABEL, APP_KEY.
Exit codes: 0 all passed, 1 a test failed, 2 the suite could not run.
"""

import base64
import json
import os
import random
import string
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import zipfile
from datetime import datetime, timezone

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import sync_playwright

CONTRACT_VERSION = 1
REPO = "tool-job-status"
STATE_PATH = f"/dataStore/e2e-state/{REPO}"
NAME_PREFIX = f"E2E {REPO}"

# Selectors and labels used more than once.
SEL_JOB_CARD = "[data-test='job-card']"
SEL_NO_RUNNING = "[data-test='no-running-jobs']"
SEL_CANCEL_BUTTON = "[data-test='cancel-job-button']"
SEL_BUTTON_STRIP = "[data-test='dhis2-uicore-buttonstrip']"
SEL_ALERT = "[data-test='dhis2-uicore-alertbar']"
TEXT_TITLE = "Background jobs"
TEXT_LAST_JOBS = "Last jobs"
TEXT_UPCOMING_JOBS = "Upcoming jobs"
TEXT_VIEW_DETAILS = "View details"
TEXT_CANCEL_JOB = "Cancel job"
TEXT_JOB_DETAILS = "Job details"
CONTENT_JSON = "application/json"

# Mirrors src/components/JobStatusPage.tsx.
MAX_LAST_JOBS = 6
MAX_UPCOMING_JOBS = 10
# TEST job: 3 stages x 10 items x 1.5 s, about 45 s when not cancelled.
TEST_JOB_PARAMS = {"stages": 3, "items": 10, "itemDuration": 1500}
# The browser runs in a zone far from any server's, so the countdown to the
# next run is only right if the app reads job times in the server's zone.
BROWSER_TIME_ZONE = "Pacific/Kiritimati"
# Jobs are scheduled at a random time on 1 January, so they never fire during
# a run. Random, because DHIS2 refuses two jobs of one type with the same
# cron (E7000), and an instance can hold a TEST job of its own.
def never_cron():
    return f"{random.randrange(60)} {random.randrange(60)} {random.randrange(24)} 1 1 ?"
# Responses that are expected and not errors. The 2.42+ global shell asks for
# the instance's custom banner logo, which an instance without one answers 404.
# The platform's app adapter looks up optional custom translations; without
# any configured, that key does not exist.
ALLOWED_HTTP_ERROR_SUFFIXES = (
    "favicon.ico",
    "/staticContent/logo_banner",
    "/dataStore/custom-translations/controller",
)
# Logged by the platform, not by this app: PWA support needs a secure context,
# and a test instance on plain http at a non-localhost name is not one.
# The browser's "Failed to load resource" line repeats a failed response
# without its URL; on_response records every one of those with the URL.
ALLOWED_CONSOLE_SUBSTRINGS = (
    "This window is not a secure context",
    "Failed to load resource: the server responded with a status of",
)


class SetupError(Exception):
    """The suite could not run (exit code 2)."""


def require_env(name):
    value = os.environ.get(name, "").strip()
    if not value:
        raise SetupError(f"{name} is not set")
    return value


BASE = ""
AUTH = ""


def configure():
    global BASE, AUTH
    BASE = require_env("DHIS2_URL").rstrip("/")
    user = require_env("DHIS2_USER")
    password = require_env("DHIS2_PASS")
    AUTH = "Basic " + base64.b64encode(f"{user}:{password}".encode()).decode()
    app_zip = require_env("APP_ZIP")
    results_dir = require_env("RESULTS_DIR")
    if not os.path.isfile(app_zip):
        raise SetupError(f"APP_ZIP {app_zip} does not exist")
    if not os.path.isdir(results_dir):
        raise SetupError(f"RESULTS_DIR {results_dir} is not a directory")
    return app_zip, results_dir


# ── API helpers ──────────────────────────────────────────────────────────


def api(method, path, body=None, params=None, content_type=CONTENT_JSON):
    """Call the API; return (status, parsed JSON or raw text or None)."""
    url = f"{BASE}/api{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    data = None
    if body is not None:
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
    req = urllib.request.Request(url, method=method, data=data)
    req.add_header("Authorization", AUTH)
    req.add_header("Accept", CONTENT_JSON)
    if data is not None:
        req.add_header("Content-Type", content_type)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return resp.status, parse_body(resp.read())
    except urllib.error.HTTPError as err:
        return err.code, parse_body(err.read())


def parse_body(raw):
    if not raw:
        return None
    try:
        return json.loads(raw)
    except ValueError:
        return raw.decode(errors="replace")


def new_uid():
    first = random.choice(string.ascii_letters)
    rest = "".join(random.choices(string.ascii_letters + string.digits, k=10))
    return first + rest


def server_version():
    status, info = api("GET", "/system/info")
    if status != 200 or not isinstance(info, dict):
        raise SetupError(f"GET /api/system/info returned {status}")
    return info["version"]


def server_minor(version):
    # "2.41.9.1" -> 41
    parts = version.split(".")
    return int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 0


def read_manifest(app_zip):
    with zipfile.ZipFile(app_zip) as bundle:
        return json.loads(bundle.read("manifest.webapp"))


# ── Run state record (dataStore e2e-state/<repo>) ────────────────────────


def read_state():
    status, body = api("GET", STATE_PATH)
    if status == 200 and isinstance(body, dict):
        return body
    return {"objects": []}


def write_state(state):
    status, _ = api("PUT", STATE_PATH, state)
    if status == 404:
        status, _ = api("POST", STATE_PATH, state)
    if status not in (200, 201):
        raise SetupError(f"could not write the run record ({status})")


def record_object(state, kind, uid):
    """Record an object before creating it, so a killed run can be cleaned."""
    state["objects"].append({"type": kind, "id": uid})
    write_state(state)


def delete_recorded_objects(state):
    """Delete what a record lists; return the entries that failed."""
    left = []
    for entry in state.get("objects", []):
        if entry["type"] == "jobConfigurations":
            # A running job cannot be deleted; let it finish first.
            wait_until_not_running(entry["id"], 120)
        status, _ = api("DELETE", f"/{entry['type']}/{entry['id']}")
        if status not in (200, 204, 404):
            left.append(entry)
    return left


def clean_leftovers():
    state = read_state()
    left = delete_recorded_objects(state)
    if left:
        raise SetupError(f"could not delete leftovers of an earlier run: {left}")
    api("DELETE", STATE_PATH)


# ── App install ──────────────────────────────────────────────────────────


def install_app(app_zip):
    boundary = uuid.uuid4().hex
    with open(app_zip, "rb") as handle:
        payload = handle.read()
    filename = os.path.basename(app_zip)
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        "Content-Type: application/zip\r\n\r\n"
    ).encode() + payload + f"\r\n--{boundary}--\r\n".encode()
    status, resp = api(
        "POST", "/apps", body, content_type=f"multipart/form-data; boundary={boundary}"
    )
    if not 200 <= status < 300:
        raise SetupError(f"POST /api/apps returned {status}: {resp}")


def find_app_key(app_name):
    """The key the server gave the app, found by the manifest's name."""
    deadline = time.time() + 120
    while time.time() < deadline:
        status, apps = api("GET", "/apps")
        if status == 200 and isinstance(apps, list):
            for app in apps:
                if app.get("name") == app_name:
                    return app["key"]
        time.sleep(3)
    raise SetupError(f"installed app '{app_name}' not found in GET /api/apps")


def uninstall_app(app_key):
    status, _ = api("DELETE", f"/apps/{app_key}")
    return status in (200, 204)


# ── Seeding ──────────────────────────────────────────────────────────────


def create_job(state, name, job_type, params=None):
    """Create a job configuration that never runs on its own; return its UID."""
    uid = new_uid()
    record_object(state, "jobConfigurations", uid)
    body = {"id": uid, "name": name, "jobType": job_type, "cronExpression": never_cron()}
    if params:
        body["jobParameters"] = params
    status, resp = api("POST", "/jobConfigurations", body)
    if status not in (200, 201):
        raise SetupError(f"could not create the {job_type} job configuration ({status}): {resp}")
    status, job = api("GET", f"/jobConfigurations/{uid}", params={"fields": "id,name"})
    if status != 200 or job.get("name") != name:
        raise SetupError(f"the {job_type} job configuration was not stored")
    return uid


def task_messages(job_type, uid):
    """The non-empty messages the server holds for a job, newest first."""
    status, tasks = api("GET", f"/system/tasks/{job_type}/{uid}")
    if status != 200 or not isinstance(tasks, list):
        return []
    return [t["message"].strip() for t in tasks if (t.get("message") or "").strip()]


def idle_jobs():
    status, body = api(
        "GET",
        "/jobConfigurations",
        params={
            "paging": "false",
            "fields": "displayName,jobType,jobStatus,enabled,lastExecutedStatus,"
            "lastFinished,nextExecutionTime",
        },
    )
    if status != 200:
        raise SetupError(f"GET /api/jobConfigurations returned {status}")
    return [
        job
        for job in body["jobConfigurations"]
        if job.get("jobType") != "HOUSEKEEPING" and job.get("jobStatus") != "RUNNING"
    ]


def expected_lists():
    """The Last and Upcoming lists the app should show, from the API."""
    jobs = idle_jobs()
    # A job that has never run reports lastExecutedStatus NOT_STARTED.
    last = [j for j in jobs if j.get("lastExecutedStatus") not in (None, "", "NOT_STARTED")]
    last.sort(key=lambda j: j.get("lastFinished") or "", reverse=True)
    # The scheduler runs only enabled jobs, whatever jobStatus says.
    upcoming = [
        j
        for j in jobs
        if j.get("jobStatus") == "SCHEDULED"
        and j.get("enabled") is not False
        and j.get("nextExecutionTime")
    ]
    upcoming.sort(key=lambda j: j["nextExecutionTime"])
    return (
        [j["displayName"] for j in last[:MAX_LAST_JOBS]],
        [j["displayName"] for j in upcoming[:MAX_UPCOMING_JOBS]],
    )


def server_clock():
    """The server's wall-clock time now, as a naive datetime."""
    _, info = api("GET", "/system/info")
    return datetime.fromisoformat(info["serverDate"][:19])


def format_time_until(minutes):
    """Mirrors formatTimeUntil in src/utils/jobParsing.ts."""
    if minutes <= 0:
        return "Due now"
    days, rest = divmod(minutes, 60 * 24)
    hours, mins = divmod(rest, 60)
    return f"{days}d {hours}h" if days else f"{hours}h {mins}m"


def job_state(uid):
    _, job = api(
        "GET",
        f"/jobConfigurations/{uid}",
        params={"fields": "jobStatus,lastExecutedStatus,lastExecuted"},
    )
    return job if isinstance(job, dict) else {}


def wait_for_run(uid, before, timeout_s):
    """Wait until a run that started after `before` (lastExecuted) has ended.

    execute only queues a job; the scheduler starts it a few seconds later,
    so "not RUNNING" alone can still mean "not started yet".
    """
    deadline = time.time() + timeout_s
    state = job_state(uid)
    while time.time() < deadline:
        state = job_state(uid)
        started = state.get("lastExecuted") and state.get("lastExecuted") != before
        if started and state.get("jobStatus") != "RUNNING":
            return state
        time.sleep(2)
    return state


def wait_until_not_running(uid, timeout_s):
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        state = job_state(uid)
        if state.get("jobStatus") != "RUNNING":
            return state
        time.sleep(2)
    return job_state(uid)


# ── Test bookkeeping ─────────────────────────────────────────────────────


class Results:
    def __init__(self):
        self.tests = []

    def add(self, test_id, status, message=""):
        entry = {"id": test_id, "status": status}
        if message:
            entry["message"] = message
        self.tests.append(entry)
        print(f"  [{status.upper():4}] {test_id}{' - ' + message if message else ''}")

    def check(self, test_id, ok, message=""):
        self.add(test_id, "pass" if ok else "fail", message)
        return ok

    def has(self, test_id):
        return any(t["id"] == test_id for t in self.tests)

    def tally(self):
        count = {s: sum(1 for t in self.tests if t["status"] == s) for s in ("pass", "fail", "skip")}
        return {
            "total": len(self.tests),
            "passed": count["pass"],
            "failed": count["fail"],
            "skipped": count["skip"],
        }


class EventLog:
    """Console errors, page errors and failed responses seen by the page."""

    def __init__(self):
        self.errors = []

    def attach(self, page):
        page.on("console", self.on_console)
        page.on("pageerror", lambda exc: self.errors.append(f"pageerror: {exc}"))
        page.on("requestfailed", self.on_request_failed)
        page.on("response", self.on_response)

    def on_console(self, msg):
        if msg.type == "error" and not any(s in msg.text for s in ALLOWED_CONSOLE_SUBSTRINGS):
            self.errors.append(f"console: {msg.text[:300]}")

    def on_request_failed(self, request):
        # Navigation away aborts pending polls; that is not an app error.
        if request.failure and "ERR_ABORTED" not in request.failure:
            self.errors.append(f"requestfailed: {request.url} {request.failure}")

    def on_response(self, response):
        if response.status >= 400 and not response.url.endswith(ALLOWED_HTTP_ERROR_SUFFIXES):
            self.errors.append(f"http {response.status}: {response.url}")


# ── UI steps ─────────────────────────────────────────────────────────────


class AppUi:
    def __init__(self, page, label, results_dir):
        self.page = page
        self.root = page
        self.label = label
        self.results_dir = results_dir

    def shot(self, name):
        path = os.path.join(self.results_dir, f"{self.label}-{name}.png")
        self.page.screenshot(path=path, full_page=True)

    def open(self, app_key):
        """Open the app; on 2.42+ it runs inside the global shell iframe."""
        self.page.goto(f"{BASE}/api/apps/{app_key}/index.html", wait_until="domcontentloaded")
        deadline = time.time() + 90
        while time.time() < deadline:
            if self.page.get_by_role("heading", name=TEXT_TITLE).count():
                self.root = self.page
                return "top-level"
            for frame in self.page.frames[1:]:
                if frame.get_by_role("heading", name=TEXT_TITLE).count():
                    self.root = frame
                    return "iframe"
            self.page.wait_for_timeout(500)
        raise PlaywrightError(f"heading '{TEXT_TITLE}' did not appear")

    def section(self, heading):
        return self.root.locator(f"section:has(> h3:text-is('{heading}'))")

    def card_for(self, uid):
        return self.root.locator(f"{SEL_JOB_CARD}[data-job-id='{uid}']")


def test_app_loads(ui, res, app_key):
    try:
        mode = ui.open(app_key)
    except PlaywrightError as exc:
        res.check("app-loads", False, str(exc).splitlines()[0])
        return False
    ui.page.wait_for_timeout(3000)
    ui.shot("overview")
    return res.check("app-loads", True, f"rendered {mode}")


def test_lists(ui, res):
    last = ui.section(TEXT_LAST_JOBS)
    upcoming = ui.section(TEXT_UPCOMING_JOBS)
    res.check("lists-render", last.count() == 1 and upcoming.count() == 1)
    res.check(
        "updated-indicator",
        ui.root.get_by_text("Updated ", exact=False).count() > 0,
    )
    expected_last, expected_upcoming = expected_lists()
    for test_id, section, expected in (
        ("last-matches-api", last, expected_last),
        ("upcoming-matches-api", upcoming, expected_upcoming),
    ):
        shown = [name.strip() for name in section.locator("li strong").all_inner_texts()]
        res.check(test_id, shown == expected, "" if shown == expected else f"API {expected}, app {shown}")
    test_next_run(upcoming, res)


def test_next_run(upcoming, res):
    """The countdown of the first upcoming job, against the server's clock."""
    first = upcoming.locator("li").first
    if not first.count():
        res.add("next-run-matches-api", "skip", "no upcoming jobs")
        return
    name = first.locator("strong").inner_text().strip()
    shown = first.locator("dd").nth(1).inner_text().strip()
    _, body = api(
        "GET",
        "/jobConfigurations",
        params={"paging": "false", "fields": "displayName,nextExecutionTime"},
    )
    nexts = [j["nextExecutionTime"] for j in body["jobConfigurations"] if j["displayName"] == name]
    if not nexts:
        res.check("next-run-matches-api", False, f"{name} not found in the API")
        return
    # Both are server wall-clock times, so their difference needs no zone.
    minutes = int((datetime.fromisoformat(nexts[0][:19]) - server_clock()).total_seconds() // 60)
    accepted = {format_time_until(m) for m in (minutes - 1, minutes, minutes + 1)}
    res.check(
        "next-run-matches-api",
        shown in accepted,
        f"{name}: app {shown!r}, server clock says {format_time_until(minutes)!r} "
        f"(browser in {BROWSER_TIME_ZONE})",
    )


def test_running_card(ui, res, uid):
    # The job is idle before it is executed: not under "Now running".
    res.check("idle-job-not-running", ui.card_for(uid).count() == 0)
    status, body = api("POST", f"/jobConfigurations/{uid}/execute")
    if not res.check("execute-job", 200 <= status < 300, "" if status < 300 else f"{status}: {body}"):
        return False
    try:
        ui.card_for(uid).wait_for(timeout=20000)
    except PlaywrightError:
        res.check("running-card", False, f"no card within 20 s; server: {job_state(uid)}")
        return False
    ui.page.wait_for_timeout(1500)
    progress = ui.card_for(uid).locator("div[class*='progress']")
    text = progress.inner_text().strip() if progress.count() else ""
    res.check("running-card", True)
    res.check("progress-line", bool(text), f"text: {text!r}")
    ui.shot("running")
    return True


def test_cancel_hidden_on_240(ui, res):
    res.check(
        "cancel-visibility",
        ui.root.locator(SEL_CANCEL_BUTTON).count() == 0,
        "2.40 has no cancel endpoint; button must be hidden",
    )
    for test_id in ("cancel-flow", "cancel-stops-job"):
        res.add(test_id, "skip", "DHIS2 2.40 has no cancel endpoint")


def test_cancel(ui, res, uid):
    button = ui.card_for(uid).locator(SEL_CANCEL_BUTTON)
    if not res.check("cancel-visibility", button.count() == 1, "superuser must see Cancel"):
        res.add("cancel-flow", "skip", "no Cancel button")
        res.add("cancel-stops-job", "skip", "no Cancel button")
        return
    button.click()
    ui.root.get_by_text("Cancel this job?").wait_for(timeout=5000)
    ui.shot("cancel-confirm")
    ui.root.locator(SEL_BUTTON_STRIP).get_by_role("button", name=TEXT_CANCEL_JOB).click()
    try:
        ui.root.locator(SEL_ALERT).get_by_text("Cancellation requested", exact=False).wait_for(timeout=15000)
        alert_ok = True
    except PlaywrightError:
        alert_ok = False
    label = button.inner_text() if button.count() else "card gone"
    res.check("cancel-flow", alert_ok, f"button now {label!r}")
    ui.shot("cancelling")
    final = wait_until_not_running(uid, 90)
    res.check(
        "cancel-stops-job",
        final.get("lastExecutedStatus") == "STOPPED",
        f"server: {final}",
    )


def test_card_clears(ui, res, uid):
    final = wait_until_not_running(uid, 120)
    try:
        ui.card_for(uid).wait_for(state="detached", timeout=20000)
        ok = True
    except PlaywrightError:
        ok = False
    res.check("card-clears", ok, f"server: {final}")


def last_jobs_item(ui, name):
    return ui.section(TEXT_LAST_JOBS).locator(
        "li", has=ui.root.locator(f"strong:text-is('{name}')")
    )


def test_details_hidden(ui, res, uid, name):
    """The TEST job writes no task messages, so it has no details button."""
    item = last_jobs_item(ui, name)
    try:
        item.wait_for(timeout=20000)
    except PlaywrightError:
        res.check("in-last-jobs", False, "the finished TEST job is not in Last jobs")
        res.add("details-hidden", "skip", "job not in Last jobs")
        return
    res.check("in-last-jobs", True)
    messages = task_messages("TEST", uid)
    if messages:
        res.add("details-hidden", "skip", f"this server wrote messages for TEST: {messages[:1]}")
        return
    shown = item.get_by_role("button", name=TEXT_VIEW_DETAILS).count()
    res.check("details-hidden", shown == 0, "" if shown == 0 else "View details shown without messages")


def test_details_modal(ui, res, uid, name):
    """A RESOURCE_TABLE run writes messages; its modal shows the newest one."""
    before = job_state(uid).get("lastExecuted")
    status, body = api("POST", f"/jobConfigurations/{uid}/execute")
    if not 200 <= status < 300:
        res.check("details-modal", False, f"could not run RESOURCE_TABLE ({status}): {body}")
        return
    final = wait_for_run(uid, before, 240)
    messages = task_messages("RESOURCE_TABLE", uid)
    if not messages:
        res.check("details-modal", False, f"server holds no messages for the run; job: {final}")
        return
    button = last_jobs_item(ui, name).get_by_role("button", name=TEXT_VIEW_DETAILS)
    try:
        button.wait_for(timeout=20000)
    except PlaywrightError:
        res.check("details-modal", False, "no View details for a job with messages")
        return
    button.click()
    title = ui.root.get_by_text(f"{TEXT_JOB_DETAILS} — {name}", exact=False)
    try:
        title.wait_for(timeout=15000)
        ui.root.get_by_text(messages[0], exact=False).first.wait_for(timeout=15000)
        shows_message = True
    except PlaywrightError:
        shows_message = False
    ui.shot("modal")
    ui.root.locator(SEL_BUTTON_STRIP).get_by_role("button", name="Close").click()
    try:
        title.wait_for(state="detached", timeout=5000)
        closed = True
    except PlaywrightError:
        closed = False
    res.check(
        "details-modal",
        shows_message and closed,
        f"newest message {messages[0]!r} shown: {shows_message}, closed: {closed}",
    )


def test_no_errors(res, events):
    res.check(
        "no-errors",
        not events.errors,
        "; ".join(events.errors[:5]),
    )


def run_ui(ctx_args):
    app_key, jobs, minor, label, results_dir, res = ctx_args
    uid, name = jobs["test"]
    events = EventLog()
    with sync_playwright() as pw:
        browser = pw.chromium.launch(args=["--disable-dev-shm-usage"])
        try:
            context = browser.new_context(
                viewport={"width": 1400, "height": 1000},
                timezone_id=BROWSER_TIME_ZONE,
            )
            login = context.request.get(f"{BASE}/api/me", headers={"Authorization": AUTH})
            if login.status != 200:
                raise SetupError(f"browser login returned {login.status}")
            page = context.new_page()
            events.attach(page)
            ui = AppUi(page, label, results_dir)
            if not test_app_loads(ui, res, app_key):
                return
            test_lists(ui, res)
            if test_running_card(ui, res, uid):
                if minor >= 41:
                    test_cancel(ui, res, uid)
                else:
                    test_cancel_hidden_on_240(ui, res)
                test_card_clears(ui, res, uid)
                test_details_hidden(ui, res, uid, name)
            test_details_modal(ui, res, *jobs["resource_tables"])
            ui.shot("final")
            test_no_errors(res, events)
        finally:
            browser.close()


# ── Main ─────────────────────────────────────────────────────────────────


def write_results(results_dir, report):
    with open(os.path.join(results_dir, "results.json"), "w") as handle:
        json.dump(report, handle, indent=2)
        handle.write("\n")


def main():
    started = time.time()
    report = {"contract_version": CONTRACT_VERSION}
    res = Results()
    results_dir = os.environ.get("RESULTS_DIR", "")
    app_key = None
    stage = "configure"
    try:
        app_zip, results_dir = configure()
        stage = "server"
        version = server_version()
        manifest = read_manifest(app_zip)
        label = os.environ.get("LABEL") or version
        report.update(label=label, server_version=version, app_version=manifest.get("version"))
        print(f"{REPO} e2e on {BASE} (DHIS2 {version}), label {label}")
        stage = "cleanup of earlier runs"
        clean_leftovers()
        stage = "install"
        install_app(app_zip)
        app_key = os.environ.get("APP_KEY") or find_app_key(manifest["name"])
        report["app_key"] = app_key
        stage = "seeding"
        run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
        state = {"run": run_id, "objects": []}
        write_state(state)
        test_name = f"{NAME_PREFIX} {run_id} test"
        rt_name = f"{NAME_PREFIX} {run_id} resource tables"
        jobs = {
            "test": (create_job(state, test_name, "TEST", TEST_JOB_PARAMS), test_name),
            "resource_tables": (create_job(state, rt_name, "RESOURCE_TABLE"), rt_name),
        }
        stage = "suite"
        run_ui((app_key, jobs, server_minor(version), label, results_dir, res))
    except (SetupError, PlaywrightError, OSError, KeyError, ValueError) as exc:
        report["error"] = f"{stage}: {exc}"
        print(f"ERROR during {stage}: {exc}", file=sys.stderr)
    finally:
        cleanup_errors = cleanup(app_key)
        if cleanup_errors:
            report.setdefault("cleanup_errors", cleanup_errors)
    report["duration_s"] = round(time.time() - started)
    if "error" in report:
        report.update(total=0, passed=0, failed=0, skipped=0, tests=[])
        if os.path.isdir(results_dir):
            write_results(results_dir, report)
        return 2
    report.update(res.tally(), tests=res.tests)
    write_results(results_dir, report)
    print(f"{report['passed']}/{report['total']} passed, {report['failed']} failed, {report['skipped']} skipped")
    return 1 if report["failed"] else 0


def cleanup(app_key):
    """Delete what this run created and uninstall the app, pass or fail."""
    errors = []
    if not BASE:
        return errors
    state = read_state()
    left = delete_recorded_objects(state)
    if left:
        errors.append(f"could not delete {left}")
    else:
        api("DELETE", STATE_PATH)
    if app_key and not uninstall_app(app_key):
        errors.append(f"could not uninstall {app_key}")
    return errors


if __name__ == "__main__":
    sys.exit(main())
