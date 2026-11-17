#!/usr/bin/env python3
"""Tracker-page acceptance in a real (headless) Chrome: 2.1, 3.2, 3.3, 3.6-1, 3.9/3.10 plumbing, 3.11 opt-in.

    python3 server.py &                 # idle server, like the other suites
    python3 tests/test_tracker_browser.py

Chrome's fake camera (--use-fake-device-for-media-stream) stands in for a
webcam. It shows a test pattern, so there are NO hands. Everything here is
plumbing and states. Hand feel, real latency and real cameras are the manual
session (docs/validation/phase1-webcam-session.md). Needs network for the
pinned CDN builds, like stage.html itself. ~3 minutes.
"""
import json
import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _cdp import Browser  # noqa: E402

BASE = "http://127.0.0.1:8794"
BOOTED = "!document.getElementById('boot') && document.getElementById('cam').videoWidth > 0"
results = []


def check(name, cond, detail=""):
    results.append((bool(cond), name, detail))
    print(f"  {'ok  ' if cond else 'FAIL'} {name}" + (f"  ({detail})" if detail and not cond else ""))


def state():
    return json.loads(urllib.request.urlopen(BASE + "/state").read() or b"{}")


def cmd(c):
    req = urllib.request.Request(BASE + "/cmd", json.dumps(c).encode(), {"Content-Type": "application/json"})
    return urllib.request.urlopen(req).status


def item(pred):
    for it in state().get("items", []):
        if pred(it):
            return it
    return None


print("2.1 boot (fake camera, real time)")
with Browser() as b:
    b.open(BASE + "/stage.html?perf=1")
    ok = b.wait(BOOTED, 120)
    # #boot is removed BEFORE `await loadTree(); spawnStage()`, so sampling the
    # card count the instant BOOTED flips raced the stage (seen once, 2026-11-14)
    check("tracker page boots with a camera and spawns the stage",
          ok and b.wait("document.querySelectorAll('.card').length > 0", 15))
    check("hint lists the new keys (K, V)", "K pick camera" in (b.eval("document.getElementById('hint')?.textContent || ''") or ""))
    perf_main = b.wait("window.__trackPerf && window.__trackPerf.frames > 60 && window.__trackPerf", 60)
    check("3.2 main-thread mode measured (?perf=1)", perf_main and perf_main["mode"] == "main", perf_main)

    print("3.3 camera states")
    b.key("v")
    hidden = b.wait("document.getElementById('cam').style.opacity === '0' && !!document.getElementById('cam-private')", 5)
    still = b.eval("(async () => { const c = document.getElementById('cam'); const t = c.currentTime; "
                   "await new Promise(r => setTimeout(r, 800)); return c.currentTime > t; })()")
    check("V hides the preview while the camera keeps running", hidden and still)
    b.key("v")
    check("V again restores it", b.wait("document.getElementById('cam').style.opacity === '' && !document.getElementById('cam-private')", 5))
    b.key("k")
    menu = b.wait("document.getElementById('cam-menu')?.textContent", 5) or ""
    check("K lists cameras by name, current one ticked", "fake" in menu.lower() and "✓" in menu, menu[:120])
    b.key("k")
    check("K again closes the list", b.wait("!document.getElementById('cam-menu')", 5))
    b.eval("document.getElementById('cam').srcObject.getVideoTracks()[0].dispatchEvent(new Event('ended'))")
    banner = b.wait("document.getElementById('cam-banner')?.textContent", 5) or ""
    check("unplug -> 'camera disconnected' banner", "disconnected" in banner.lower(), banner)
    check("...and it recovers on its own (camera reopened, banner gone)",
          b.wait("!document.getElementById('cam-banner') && document.getElementById('cam').videoWidth > 0", 20))

    print("3.6-1 mouse fallback, live")
    cmd({"a": "hand", "src": "models/phantom/model.glb"})
    it0 = None
    for _ in range(30):                            # delivered via the /state heartbeat, then flies in
        time.sleep(0.5)
        it0 = item(lambda i: "phantom" in (i.get("src") or ""))
        if it0:
            break
    time.sleep(2.5)                                # let the hand-delivery flight settle
    it0 = item(lambda i: "phantom" in (i.get("src") or "")) or it0
    check("staged the phantom on the tracker page", it0 is not None)
    if it0:
        W, H = b.eval("[innerWidth, innerHeight]")
        x, y = it0["x"] * W, it0["y"] * H
        b.mouse("mouseMoved", x, y)
        b.mouse("mousePressed", x, y, button="left", clickCount=1)
        for k in range(1, 11):
            b.mouse("mouseMoved", x + 15 * k, y + 8 * k, button="left")
        b.mouse("mouseReleased", x + 150, y + 80, button="left", clickCount=1)
        time.sleep(0.6)
        it1 = item(lambda i: i.get("id") == it0["id"])
        dx = (it1["x"] - it0["x"]) * W
        check("drag moves the model with the mouse (~150 px)", 120 < dx < 180, f"dx={dx:.0f}px")
        x, y = it1["x"] * W, it1["y"] * H
        s0 = it1["scale"]
        b.mouse("mouseWheel", x, y, deltaX=0, deltaY=-400)
        time.sleep(0.6)
        s1 = item(lambda i: i.get("id") == it0["id"])["scale"]
        check("wheel scales the model up", s1 > s0 * 1.3, f"{s0} -> {s1}")
        for t in ("mousePressed", "mouseReleased"):
            b.mouse(t, x, y, button="left", clickCount=2)
        time.sleep(0.6)
        s2 = item(lambda i: i.get("id") == it0["id"])["scale"]
        check("double-click resets the pose", abs(s2 - s0) < 0.05 * s0 + 1e-3, f"{s1} -> {s2} (start {s0})")

    print("3.9 / 3.10 overlay + speech plumbing, live (no hands: pointing/speech by hand is manual)")
    hud = b.wait("document.getElementById('nova-hud')?.textContent", 10) or ""
    check("HUD panel is on the tracker page with the education-only banner", "NOT FOR CLINICAL USE" in hud, hud[:160])
    hud = b.wait("(t => t.includes('scan bundle') && t)(document.getElementById('nova-hud').textContent)", 10) or hud
    check("HUD shows the phantom's whitelisted bundle fields (dataset, short rev, review state)",
          "synthetic" in hud and "rev e98a3dec87b3" in hud and "seg: dataset_reference" in hud, hud[:300])
    check("HUD never shows bundle_id / source_case", "asymmetric-phantom" not in hud and "synthetic:" not in hud, hud[:300])
    check("HUD reports tracking honestly with no hands in the fake feed", "no hands" in hud, hud[:300])
    check("default page keeps the EMA (HUD names no alternative filter)", "one-euro" not in hud, hud[:300])
    sp = b.eval("typeof speechSynthesis !== 'undefined'")
    line = b.eval("[...document.querySelectorAll('#nova-hud .r')].map(r => r.textContent)"
                  ".find(t => t.startsWith('SPEECH')) || ''")
    check("HUD speech line is present and truthful about the engine",
          ("unavailable" in line) != bool(sp), f"speechSynthesis={sp} line={line!r}")
    print(f"    (headless speech line: {line!r})")
    b.key("m")
    check("M mutes (HUD says so)", b.wait("document.getElementById('nova-hud').textContent.includes('muted (M)')", 5))
    b.key("m")
    check("M again unmutes", b.wait("!document.getElementById('nova-hud').textContent.includes('muted (M)')", 5))
    b.key("h")
    check("H hides the HUD", b.wait("document.getElementById('nova-hud').classList.contains('off')", 5))
    b.key("h")
    if it0:
        cmd_scale = item(lambda i: i.get("id") == it0["id"])["scale"]
        b.mouse("mouseWheel", x, y, deltaX=0, deltaY=-400)
        time.sleep(0.6)
        big = item(lambda i: i.get("id") == it0["id"])["scale"]
        b.eval("[...document.querySelectorAll('#nova-hud button')].find(e => /Reset/.test(e.textContent)).click()")
        time.sleep(0.6)
        back = item(lambda i: i.get("id") == it0["id"])["scale"]
        check("HUD Reset pose button resets the model (same pose as double-click)",
              big > cmd_scale * 1.3 and abs(back - 1) < 0.05, f"{cmd_scale} -> {big} -> {back}")

print("3.9 render page stays clean (on air)")
with Browser(port=9345) as b:
    b.open(BASE + "/stage.html?role=render")
    time.sleep(4)
    check("no HUD on ?role=render", b.eval("!document.getElementById('nova-hud')"))

print("3.11 smoothing opt-in (filter numbers: tests/test_smoothing.mjs)")
with Browser() as b:
    b.open(BASE + "/stage.html?smooth=oneeuro")
    b.wait(BOOTED, 120)
    hud = b.wait("(t => t.includes('MODE') && t)(document.getElementById('nova-hud')?.textContent || '')", 15) or ""
    check("?smooth=oneeuro boots and the HUD names the filter", "one-euro" in hud, hud[:200])

print("3.2 worker mode")
with Browser() as b:
    b.open(BASE + "/stage.html?perf=1&track=worker")
    b.wait(BOOTED, 120)
    perf_w = b.wait("window.__trackPerf && window.__trackPerf.frames > 60 && window.__trackPerf", 60)
    check("?track=worker runs MediaPipe in a worker", perf_w and perf_w["mode"] == "worker", perf_w)
    check("worker results arrive (detection timed)", perf_w and perf_w["detect_ms_avg"] > 0, perf_w)

print("3.3 failure screens")
with Browser(auto_allow=False, extra=("--deny-permission-prompts",), port=9341) as b:
    b.open(BASE + "/stage.html")
    kind = b.wait("document.getElementById('boot')?.dataset.camError", 60)
    check("permission denied -> 'blocked' explanation + Retry", kind == "denied" and
          b.eval("!!document.getElementById('cam-retry')"), kind)
# This machine may have a real webcam, so "no camera" and "camera busy" are
# injected at the API: getUserMedia rejects exactly as Chrome does in those cases.
for err, want, label in (("NotFoundError", "none", "no camera -> 'no camera found'"),
                         ("NotReadableError", "busy", "camera in use -> 'in use by another app'")):
    with Browser(port=9343) as b:
        b.call("Page.addScriptToEvaluateOnNewDocument", source=(
            "navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('x', '%s'));"
            "navigator.mediaDevices.enumerateDevices = () => Promise.resolve([]);" % err))
        b.open(BASE + "/stage.html")
        kind = b.wait("document.getElementById('boot')?.dataset.camError", 60)
        check(label + " explanation + Retry", kind == want and b.eval("!!document.getElementById('cam-retry')"), kind)

for _ in range(3):
    urllib.request.urlopen(urllib.request.Request(BASE + "/state", b'{"cursors":[],"items":[]}',
                                                  {"Content-Type": "application/json"}))
print("\nperf (HEADLESS fake camera; not target hardware - see the manual session):")
for name, p in (("main", perf_main), ("worker", perf_w)):
    print(f"  {name:7s} {json.dumps(p)}")
failed = [r for r in results if not r[0]]
print(f"\n{len(results) - len(failed)}/{len(results)} passed")
sys.exit(1 if failed else 0)
