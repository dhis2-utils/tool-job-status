#!/usr/bin/env python3
"""
End-to-end smoke/functional test for the Job Status app.

Parameterized by env vars so it can run against any DHIS2 version:
  APP_URL   - where the dev server serves the app (default http://localhost:49251)
  API_URL   - the API origin the app talks to    (default http://localhost:8080)
  DHIS2_USER / DHIS2_PASS - credentials           (default admin/district)
  LABEL     - short label used in screenshot filenames (e.g. v43-sl)
  SHOT_DIR  - directory to write screenshots to

Auth: fetch a JSESSIONID from API_URL via Basic auth and inject it as a
localhost cookie (app + API are both localhost => same-site).
"""
import json
import os
import sys
from playwright.sync_api import sync_playwright

APP_URL = os.environ.get("APP_URL", "http://localhost:49251")
# Server URL the app-adapter dev login should target (the local proxy).
SERVER = os.environ.get("SERVER", "http://localhost:8080")
USER = os.environ.get("DHIS2_USER", "admin")
PASS = os.environ.get("DHIS2_PASS", "district")
LABEL = os.environ.get("LABEL", "run")
SHOT_DIR = os.environ.get("SHOT_DIR", "/tmp")


def login_if_needed(page):
    """The App Platform dev server shows an app-adapter login form; fill it."""
    server_input = page.locator("input[name='server']")
    if server_input.count() > 0:
        server_input.fill(SERVER)
        page.locator("input[name='j_username']").fill(USER)
        page.locator("input[name='j_password']").fill(PASS)
        page.get_by_role("button", name="Sign in").click()


def main():
    result = {"label": LABEL, "checks": {}, "console_errors": [],
              "page_errors": [], "http_errors": []}

    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1400, "height": 1000})
        page = ctx.new_page()
        page.on("console", lambda m: result["console_errors"].append(m.text)
                if m.type == "error" else None)
        page.on("pageerror", lambda e: result["page_errors"].append(str(e)))
        page.on("response", lambda r: result["http_errors"].append(
            [r.status, r.url]) if r.status >= 400 else None)

        page.goto(APP_URL, wait_until="networkidle", timeout=60000)
        login_if_needed(page)

        # The app title should render (proves the app booted + authenticated).
        page.get_by_role("heading", name="Background jobs").wait_for(timeout=45000)
        result["checks"]["title_renders"] = True

        # Running section: either job cards or the explicit empty state.
        running_empty = page.locator("[data-test='no-running-jobs']")
        running_cards = page.locator("[data-test='job-card']")
        page.wait_for_timeout(2000)
        result["checks"]["running_card_count"] = running_cards.count()
        result["checks"]["running_empty_shown"] = running_empty.count() > 0

        # Last / Upcoming headings present.
        result["checks"]["last_jobs_heading"] = page.get_by_text(
            "Last jobs", exact=True).count() > 0
        result["checks"]["upcoming_jobs_heading"] = page.get_by_text(
            "Upcoming jobs", exact=True).count() > 0

        # Count "Show details" (last jobs) + "View details" (running) buttons.
        show_details = page.get_by_role("button", name="Show details")
        result["checks"]["show_details_buttons"] = show_details.count()

        page.screenshot(path=f"{SHOT_DIR}/{LABEL}-overview.png", full_page=True)

        # Open a details modal if any "Show details" button exists.
        if show_details.count() > 0:
            show_details.first.click()
            page.get_by_role("heading", name="Job details").or_(
                page.get_by_text("Job details")).first.wait_for(timeout=15000)
            page.wait_for_timeout(1500)
            result["checks"]["modal_opens"] = True
            page.screenshot(path=f"{SHOT_DIR}/{LABEL}-modal.png")
            # Close it (footer button; the modal also has an X close icon).
            page.locator("[data-test='dhis2-uicore-buttonstrip']").get_by_role(
                "button", name="Close").click()
            page.wait_for_timeout(500)
            result["checks"]["modal_closes"] = (
                page.get_by_text("Job details").count() == 0)
        else:
            result["checks"]["modal_opens"] = "no-details-button"

        browser.close()

    print(json.dumps(result, indent=2))
    # Fail loudly if the app errored out.
    ok = (result["checks"].get("title_renders")
          and not result["page_errors"])
    print(f"[{LABEL}] RESULT: {'PASS' if ok else 'FAIL'}")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
