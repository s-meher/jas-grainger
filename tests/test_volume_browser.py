#!/usr/bin/env python3
"""Render verified volume and MPR data in Chrome with the local server running."""
import json

from _cdp import Browser


if __name__ == "__main__":
    with Browser(fake_camera=False, extra=("--enable-unsafe-swiftshader",)) as browser:
        browser.open("http://127.0.0.1:8794/tests/test_volume_probe.html")
        browser.wait("document.querySelector('#out')?.textContent !== 'running'", 60)
        result = json.loads(browser.eval("document.querySelector('#out').textContent"))
    print(json.dumps(result, indent=2))
    raise SystemExit(0 if result.get("ok") else 1)
