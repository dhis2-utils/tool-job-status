#!/usr/bin/env python3
"""
Verify the "started by me" cancel rule in the installed app.

Env: BASE, UI_USER (user:pass viewing the app), EXEC_USER (user:pass that
triggers an async metadata import), PAYLOAD (json file), LABEL, SHOT_DIR,
EXPECT_CANCEL (1/0).

Flow: log in as UI_USER, open the app, trigger the import as EXEC_USER, wait
for the running METADATA_IMPORT card and report whether the Cancel button is
shown; if EXPECT_CANCEL=1, click it and expect the success alert.
"""
import base64
import json
import os
import sys
import time
import urllib.request

from playwright.sync_api import sync_playwright

BASE = os.environ["BASE"].rstrip("/")
UI_USER = os.environ["UI_USER"]
EXEC_USER = os.environ["EXEC_USER"]
PAYLOAD = os.environ["PAYLOAD"]
LABEL = os.environ.get("LABEL", "executedby")
SHOT_DIR = os.environ.get("SHOT_DIR", "/tmp")
EXPECT_CANCEL = os.environ.get("EXPECT_CANCEL", "1") == "1"
os.makedirs(SHOT_DIR, exist_ok=True)
result = {"label": LABEL, "checks": {}, "page_errors": []}


def basic(userpass):
    return "Basic " + base64.b64encode(userpass.encode()).decode()


def trigger_import():
    req = urllib.request.Request(
        f"{BASE}/api/metadata?async=true&importStrategy=CREATE_AND_UPDATE",
        method="POST", data=open(PAYLOAD, "rb").read())
    req.add_header("Authorization", basic(EXEC_USER))
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.status, json.loads(r.read().decode())


with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1400, "height": 1000})
    r = ctx.request.get(f"{BASE}/api/me", headers={"Authorization": basic(UI_USER)})
    result["checks"]["login_status"] = r.status
    page = ctx.new_page()
    page.on("pageerror", lambda e: result["page_errors"].append(str(e)))
    page.goto(f"{BASE}/api/apps/tool-job-status/index.html", wait_until="networkidle",
              timeout=90000)
    page.wait_for_timeout(3000)
    root = page.frame_locator("iframe").first if page.locator("iframe").count() else page
    root.get_by_role("heading", name="Background jobs").wait_for(timeout=60000)
    result["checks"]["title_renders"] = True

    status, body = trigger_import()
    result["checks"]["import_trigger_status"] = status
    result["checks"]["import_job"] = body.get("response", {}).get("id")

    card = root.locator("[data-test='job-card']")
    try:
        card.first.wait_for(timeout=30000)
        result["checks"]["running_card_appears"] = True
        result["checks"]["running_card_title"] = card.first.locator("h3").inner_text()
    except Exception:
        result["checks"]["running_card_appears"] = False
    if result["checks"]["running_card_appears"]:
        page.wait_for_timeout(1500)
        cancel = root.locator("[data-test='cancel-job-button']")
        result["checks"]["cancel_button_visible"] = cancel.count() > 0
        page.screenshot(path=f"{SHOT_DIR}/{LABEL}-running.png", full_page=True)
        if EXPECT_CANCEL and cancel.count() > 0:
            cancel.first.click()
            root.get_by_text("Cancel this job?").wait_for(timeout=5000)
            root.locator("[data-test='dhis2-uicore-buttonstrip']").get_by_role(
                "button", name="Cancel job").click()
            try:
                root.get_by_text("Cancellation requested", exact=False).wait_for(timeout=15000)
                result["checks"]["cancel_success_alert"] = True
            except Exception:
                result["checks"]["cancel_success_alert"] = False
            page.screenshot(path=f"{SHOT_DIR}/{LABEL}-cancelling.png", full_page=True)
    browser.close()

print(json.dumps(result, indent=2))
if EXPECT_CANCEL:
    ok = result["checks"].get("cancel_success_alert") is True
else:
    ok = result["checks"].get("running_card_appears") and \
        result["checks"].get("cancel_button_visible") is False
ok = ok and not result["page_errors"]
print(f"[{LABEL}] RESULT: {'PASS' if ok else 'FAIL'}")
sys.exit(0 if ok else 1)
