"""End-to-end smoke test: demo mode and live mode (mocked endpoint) at 390x844 and 1440x900.

Run from the repo root:  python3 tests/e2e/smoke.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import ROOT, VIEWPORTS, Checks, mock_llm, no_horizontal_scroll, static_server, watch_console  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

MOCK_ARTICLE = """# Remote team productivity made simple: a practical guide

Meta description: MOCK LIVE ARTICLE. Remote team productivity explained in plain steps: what it is, why it matters, and how to start for small business owners.

Remote team productivity is about clear goals and steady routines.

## What remote team productivity really means

A mocked live answer from the configured model, rendered in the article panel.

## How to get started

Pick one routine and try it for a week.

## Wrapping up

Try one step this week.
"""


def main():
    checks = Checks()
    os.makedirs(os.path.join(ROOT, "docs"), exist_ok=True)
    with static_server() as url, sync_playwright() as p:
        browser = p.chromium.launch()
        for name, vp in VIEWPORTS.items():
            ctx = browser.new_context(viewport=vp)
            page = ctx.new_page()
            errors = watch_console(page)
            page.goto(url)
            page.wait_for_load_state("networkidle")
            checks.check(f"{name}: opens in demo mode", "Demo mode" in page.inner_text("#mode-badge"))
            page.click("#sample")
            page.click("#generate")
            page.wait_for_selector("#output:not([hidden])", timeout=10000)
            text = page.inner_text("#output").lower()
            checks.check(f"{name}: demo article contains the keyword", "remote team productivity" in text)
            checks.check(f"{name}: SEO scorecard shown", page.is_visible("#scorecard"))
            checks.check(f"{name}: demo article has an SEO score", "SEO score" in page.inner_text("#scorecard"))
            checks.check(f"{name}: no horizontal scroll (demo)", no_horizontal_scroll(page))
            shot = "desktop" if name == "desktop" else "mobile"
            page.screenshot(path=os.path.join(ROOT, "docs", f"screenshot-{shot}.png"))

            page.click("#settings summary")
            page.fill("#cfg-base", "https://llm.example.test/v1")
            page.fill("#cfg-key", "test-key-not-real")
            page.fill("#cfg-model", "mock-model")
            page.check("#cfg-live")
            page.click("#cfg-save")
            checks.check(f"{name}: live badge after saving settings", "Live mode" in page.inner_text("#mode-badge"))
            calls = []
            mock_llm(page, MOCK_ARTICLE, calls)
            page.click("#generate")
            page.wait_for_function("() => document.querySelector('#output').innerText.includes('MOCK LIVE ARTICLE')", timeout=10000)
            checks.check(f"{name}: live answer rendered", True)
            checks.check(f"{name}: request used the configured model", bool(calls) and calls[-1].get("model") == "mock-model")
            checks.check(f"{name}: no horizontal scroll (live)", no_horizontal_scroll(page))
            checks.check(f"{name}: no console errors", not errors, "; ".join(errors)[:300])
            ctx.close()
        browser.close()
    ok = checks.summary()
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
