"""Shared Playwright helpers for the end-to-end smoke tests (python3 + local chromium).

Serves the repo root on a free local port, checks each viewport for console errors and horizontal scroll,
and mocks an OpenAI-compatible endpoint so live mode is exercised without any network access.
"""
import contextlib
import json
import os
import socket
import subprocess
import sys
import time
import urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
VIEWPORTS = {"mobile": {"width": 390, "height": 844}, "desktop": {"width": 1440, "height": 900}}
MOCK_BASE = "https://llm.example.test/v1"


def _free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


@contextlib.contextmanager
def static_server():
    port = _free_port()
    proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"],
        cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    url = f"http://127.0.0.1:{port}/"
    for _ in range(100):
        try:
            urllib.request.urlopen(url, timeout=1)
            break
        except Exception:
            time.sleep(0.1)
    try:
        yield url
    finally:
        proc.terminate()
        try:
            proc.wait(5)
        except subprocess.TimeoutExpired:
            proc.kill()


def watch_console(page):
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    return errors


def no_horizontal_scroll(page):
    return page.evaluate("() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1")


def mock_llm(page, content, calls=None):
    """Answer every chat-completions request with `content`; records each request body in `calls`."""
    def handler(route, request):
        if request.method == "OPTIONS":
            return route.fulfill(status=204, headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
            })
        if calls is not None:
            calls.append(json.loads(request.post_data or "{}"))
        body = json.dumps({"choices": [{"message": {"role": "assistant", "content": content}}]})
        return route.fulfill(status=200, content_type="application/json",
                             headers={"Access-Control-Allow-Origin": "*"}, body=body)
    page.route("**/chat/completions", handler)


class Checks:
    """Collects named pass/fail checks so the smoke test reports real counts."""
    def __init__(self):
        self.results = []

    def check(self, name, ok, detail=""):
        self.results.append((name, bool(ok), detail))
        mark = "PASS" if ok else "FAIL"
        print(f"[{mark}] {name}" + (f" — {detail}" if detail and not ok else ""), flush=True)
        return ok

    def summary(self):
        passed = sum(1 for _, ok, _ in self.results if ok)
        total = len(self.results)
        print(json.dumps({"e2e_checks": total, "e2e_passed": passed, "all_passed": passed == total}))
        return passed == total
