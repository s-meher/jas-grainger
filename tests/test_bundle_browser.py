#!/usr/bin/env python3
"""Tasks 2.3/2.4 in a real browser: headless Chrome loads tests/bundle_probe.html.

    python3 server.py &            # idle server, like the other suites
    python3 tests/test_bundle_browser.py

Exit 0 = the phantom bundle verified, attached, and millimetres survived
stage.html's view transform under a rotated pose (landmark < 0.8 mm,
round trip < 1e-6 mm, scale = fit). Needs network for the pinned three.js
CDN build, the same as stage.html itself.
"""
import html, json, os, re, shutil, subprocess, sys
from pathlib import Path

CHROME = os.environ.get("CHROME") or shutil.which("google-chrome") or shutil.which("chromium")
if not CHROME:
    for p in (Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
              Path(os.environ.get("PROGRAMFILES", "C:/Program Files")) / "Google/Chrome/Application/chrome.exe"):
        if p.is_file():
            CHROME = str(p)
            break
if not CHROME:
    sys.exit("Chrome not found. Set CHROME to the browser executable path.")
URL = "http://127.0.0.1:8794/tests/bundle_probe.html"
r = subprocess.run([CHROME, "--headless=new", "--virtual-time-budget=15000",
                    "--timeout=25000", "--dump-dom", URL],
                   capture_output=True, text=True, timeout=90)
m = re.search(r'<pre id="out">(.*?)</pre>', r.stdout, re.S)
if not m:
    sys.exit(f"probe page produced no result (is the server running?)\n{r.stderr[-400:]}")
res = json.loads(html.unescape(m.group(1)))
for k, v in res.items():
    print(f"  {k:24s} {v}")
print("PASS" if res.get("ok") else "FAIL")
sys.exit(0 if res.get("ok") else 1)
