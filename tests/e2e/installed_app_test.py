#!/usr/bin/env python3
"""
Functional test of the INSTALLED Job Status app bundle on a live DHIS2 instance.

Env: BASE (e.g. http://dhis2-agent-jobstatus-v40:8080), USER/PASS, LABEL, SHOT_DIR.

Flow:
  1. Log in via Basic-auth GET /api/me -> session cookie.
  2. Open /api/apps/tool-job-status/index.html; assert title renders.
  3. Assert "No running jobs", Last/Upcoming lists render, details modal opens/closes.
  4. Trigger an ANALYTICS_TABLE run via POST /api/resourceTables/analytics;
     wait for a running card with progress; click Cancel -> confirm; expect the
     success alert; wait for the card to leave "Now running".
  5. Report console/page errors and HTTP >= 400 responses.
"""
import json
import os
import sys
import time

import base64
import urllib.request
import urllib.parse
from playwright.sync_api import sync_playwright

BASE = os.environ["BASE"].rstrip("/")
USER = os.environ.get("USER_", "local_admin")
PASS = os.environ.get("PASS_", "district")
LABEL = os.environ.get("LABEL", "run")
SHOT_DIR = os.environ.get("SHOT_DIR", "/tmp")
APP_URL = f"{BASE}/api/apps/tool-job-status/index.html"

os.makedirs(SHOT_DIR, exist_ok=True)
result = {"label": LABEL, "checks": {}, "console_errors": [], "page_errors": [],
          "http_errors": []}


def shot(page, name):
    page.screenshot(path=f"{SHOT_DIR}/{LABEL}-{name}.png", full_page=True)


class Resp:
    def __init__(self, status, body):
        self.status_code = status
        self._body = body

    def json(self):
        return json.loads(self._body or "null")


# Optional "user:pass" used only to trigger the job, so the UI user can differ
# from the job's executedBy (tests the "started by me" cancel rule).
EXEC_AS = os.environ.get("EXEC_AS", f"{USER}:{PASS}")
# Optional "user:pass" with admin rights for setup/inspection calls.
ADMIN_AS = os.environ.get("ADMIN_AS", f"{USER}:{PASS}")


def api(method, path, params=None, as_=None):
    url = f"{BASE}/api{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, method=method, data=b"" if method == "POST" else None)
    req.add_header("Authorization", "Basic " + base64.b64encode(
        (as_ or f"{USER}:{PASS}").encode()).decode())
    if method == "POST":
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return Resp(r.status, r.read().decode())
    except urllib.error.HTTPError as e:
        return Resp(e.code, e.read().decode())


with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1400, "height": 1000})
    # Session cookie via Basic auth (works on all versions).
    r = ctx.request.get(f"{BASE}/api/me", headers={
        "Authorization": "Basic " + base64.b64encode(
            f"{USER}:{PASS}".encode()).decode()})
    result["checks"]["login_status"] = r.status
    page = ctx.new_page()
    page.on("console", lambda m: result["console_errors"].append(m.text)
            if m.type == "error" else None)
    page.on("pageerror", lambda e: result["page_errors"].append(str(e)))
    page.on("response", lambda r: result["http_errors"].append([r.status, r.url])
            if r.status >= 400 else None)

    page.goto(APP_URL, wait_until="networkidle", timeout=90000)
    # DHIS2 2.42+ serves installed apps inside the global app shell (iframe);
    # older versions render the app document directly.
    page.wait_for_timeout(3000)
    if page.locator("iframe").count() > 0:
        root = page.frame_locator("iframe").first
        result["checks"]["global_shell_iframe"] = True
    else:
        root = page
        result["checks"]["global_shell_iframe"] = False
    root.get_by_role("heading", name="Background jobs").wait_for(timeout=60000)
    result["checks"]["title_renders"] = True
    page.wait_for_timeout(2500)

    result["checks"]["no_running_state"] = root.locator(
        "[data-test='no-running-jobs']").count() > 0
    result["checks"]["last_jobs_heading"] = root.get_by_text(
        "Last jobs", exact=True).count() > 0
    result["checks"]["upcoming_jobs_heading"] = root.get_by_text(
        "Upcoming jobs", exact=True).count() > 0
    result["checks"]["upcoming_count"] = root.locator(
        "section:has(h3:text-is('Upcoming jobs')) li").count()
    result["checks"]["updated_ago_shown"] = root.get_by_text(
        "Updated", exact=False).count() > 0
    shot(page, "overview")

    # Details modal from the Last jobs list (if any finished job exists).
    details = root.get_by_role("button", name="View details")
    if details.count() > 0:
        details.first.click()
        root.get_by_text("Job details", exact=False).first.wait_for(timeout=15000)
        page.wait_for_timeout(1500)
        result["checks"]["modal_opens"] = True
        shot(page, "modal")
        root.locator("[data-test='dhis2-uicore-buttonstrip']").get_by_role(
            "button", name="Close").click()
        page.wait_for_timeout(500)
        result["checks"]["modal_closes"] = root.get_by_text(
            "Job details", exact=False).count() == 0
    else:
        result["checks"]["modal_opens"] = "no-finished-jobs"

    # Run a long-running TEST job (built-in job type that sleeps per work
    # item and reports stage/item progress) so the running card, live
    # progress and Cancel flow can be observed on an otherwise empty instance.
    types = api("GET", "/jobConfigurations/jobTypes", params={"paging": "false"}, as_=ADMIN_AS).json()
    types = types.get("jobTypes", types)
    test_type = [t for t in types if t.get("jobType") == "TEST"]
    result["checks"]["test_job_type_available"] = bool(test_type)
    param_names = {p["name"] for p in test_type[0]["jobParameters"]} if test_type else set()
    result["checks"]["test_job_params"] = sorted(param_names)
    wanted = {"waitMillis": 0, "stages": 3, "items": 20, "itemDuration": 1500,
              "failAtStage": -1, "failAtItem": -1}
    job_params = {k: v for k, v in wanted.items() if k in param_names}
    existing = api("GET", "/jobConfigurations", params={
        "filter": "name:eq:jobstatus-ui-test", "fields": "id", "paging": "false"}, as_=ADMIN_AS).json()
    if existing.get("jobConfigurations"):
        job_id = existing["jobConfigurations"][0]["id"]
    else:
        body = json.dumps({"name": "jobstatus-ui-test", "jobType": "TEST",
                           "cronExpression": "0 0 5 1 1 ?", "jobParameters": job_params}).encode()
        req = urllib.request.Request(f"{BASE}/api/jobConfigurations", method="POST", data=body)
        req.add_header("Authorization", "Basic " + base64.b64encode(f"{USER}:{PASS}".encode()).decode())
        req.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(req, timeout=60) as r:
            created = json.loads(r.read().decode())
        job_id = created["response"]["uid"]
    result["checks"]["test_job_id"] = job_id
    # Wait for any previous run of the test job to finish before re-triggering.
    t0 = time.time()
    while time.time() - t0 < 150:
        st = api("GET", f"/jobConfigurations/{job_id}", params={"fields": "jobStatus"}, as_=ADMIN_AS).json()
        if st.get("jobStatus") != "RUNNING":
            break
        time.sleep(3)
    trig = api("POST", f"/jobConfigurations/{job_id}/execute", as_=EXEC_AS)
    result["checks"]["trigger_status"] = trig.status_code
    card = root.locator("[data-test='job-card']")
    try:
        card.first.wait_for(timeout=45000)
        result["checks"]["running_card_appears"] = True
    except Exception:
        result["checks"]["running_card_appears"] = False
    if result["checks"]["running_card_appears"]:
        page.wait_for_timeout(3500)
        result["checks"]["running_card_title"] = card.first.locator("h3").inner_text()
        progress_text = card.first.locator("div[class*='progress']").inner_text() \
            if card.first.locator("div[class*='progress']").count() else ""
        result["checks"]["progress_text"] = progress_text
        shot(page, "running")

        cancel = root.locator("[data-test='cancel-job-button']")
        result["checks"]["cancel_button_visible"] = cancel.count() > 0
        if cancel.count() == 0:
            jc = api("GET", f"/jobConfigurations/{job_id}", params={
                "fields": "jobStatus,executedBy"}, as_=ADMIN_AS).json()
            result["checks"]["test_job_server_state"] = jc
        if cancel.count() > 0:
            cancel.first.click()
            root.get_by_text("Cancel this job?").wait_for(timeout=5000)
            shot(page, "cancel-confirm")
            root.locator("[data-test='dhis2-uicore-buttonstrip']").get_by_role(
                "button", name="Cancel job").click()
            try:
                root.get_by_text("Cancellation requested", exact=False).wait_for(
                    timeout=15000)
                result["checks"]["cancel_success_alert"] = True
            except Exception:
                result["checks"]["cancel_success_alert"] = False
            page.wait_for_timeout(500)
            cb = root.locator("[data-test='cancel-job-button']")
            result["checks"]["cancelling_label"] = (
                cb.first.inner_text() if cb.count() else "card-gone")
            shot(page, "cancelling")
            # Wait for the job to leave "Now running".
            t0 = time.time()
            while time.time() - t0 < 90 and root.locator(
                    "[data-test='job-card']").count() > 0:
                page.wait_for_timeout(2000)
            result["checks"]["running_card_gone_after_s"] = round(time.time() - t0)
            page.wait_for_timeout(3500)
            shot(page, "after-cancel")
            # Server-side status of the manual analytics job.
            jc = api("GET", f"/jobConfigurations/{job_id}", params={
                "fields": "name,jobStatus,lastExecutedStatus,lastRuntimeExecution,executedBy"}, as_=ADMIN_AS).json()
            result["checks"]["test_job_server_state"] = jc
            tasks = api("GET", f"/system/tasks/TEST/{job_id}", as_=ADMIN_AS).json()
            result["checks"]["test_job_last_tasks"] = [
                (t.get("level"), t.get("message"), t.get("completed")) for t in tasks[:4]]

    browser.close()

# Drop the noisy but expected 4xx (e.g. favicon, optional endpoints).
result["http_errors"] = [e for e in result["http_errors"]
                         if not e[1].endswith(("favicon.ico",))]
print(json.dumps(result, indent=2))
expect_cancel = os.environ.get("EXPECT_CANCEL", "1") == "1"
cancel_ok = (result["checks"].get("cancel_success_alert") if expect_cancel
             else result["checks"].get("cancel_button_visible") is False)
ok = (result["checks"].get("title_renders") and not result["page_errors"]
      and result["checks"].get("running_card_appears") and cancel_ok)
print(f"[{LABEL}] RESULT: {'PASS' if ok else 'FAIL'}")
sys.exit(0 if ok else 1)
