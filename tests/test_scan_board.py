"""Phase 3 acceptance through the tracker page with a verified scan bundle.

Run against an idle local server. Chrome uses a fake capture device and the
normal board commands and controls. Geometry and real hands are tested separately.
"""
import argparse
import json
import time
import urllib.request

from _cdp import Browser

BASE = "http://127.0.0.1:8794"
PANEL = "document.querySelector('.jas-scan-controls:not([hidden])')"


def command(**values):
    request = urllib.request.Request(BASE + "/cmd", json.dumps(values).encode(),
                                     {"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=5) as response:
        assert response.status == 204


def check(browser, label, expression, timeout=15):
    if not browser.wait(expression, timeout):
        snapshot = browser.eval(f"({PANEL})?.innerText || JSON.stringify(window.__errors)")
        raise AssertionError(f"{label}: {snapshot}")
    print("PASS", label, flush=True)


def click(browser, label):
    browser.eval(f"Array.from(({PANEL}).querySelectorAll('button')).find(b=>b.textContent==={json.dumps(label)}).click()")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--case", choices=("hepaticvessel_424", "liver_39"),
                        help="verify an approved local MSD bundle instead of the synthetic phantom")
    case = parser.parse_args().case
    model = f"local/{case}/model.glb" if case else "models/phantom/model.glb"
    expected = case or "synthetic-asymmetric-phantom"
    with Browser(extra=("--enable-unsafe-swiftshader",), port=9351) as browser:
        browser.open(BASE + "/stage.html")
        check(browser, "tracker boots", "!document.getElementById('boot') && document.getElementById('cam').videoWidth > 0", 80)
        try:
            command(a="hand", src=model)
            check(browser, "verified scan opens controls", f"({PANEL})?.textContent.includes({json.dumps(expected)})", 45)
            time.sleep(2.5)  # let the board's hand-delivery animation finish
            point = browser.eval("(() => { const r=document.querySelector('.modelcard canvas').getBoundingClientRect(); return [r.left+r.width/2,r.top+r.height/2,r.width,r.height]; })()")
            x, y, w, h = point
            picked = False
            for dx, dy in [(0, 0), (0.1, 0), (-0.1, 0), (0, -0.1), (0, 0.1)]:
                click(browser, "Mouse pick")
                browser.mouse("mousePressed", x + dx*w, y + dy*h, button="left", clickCount=1)
                browser.mouse("mouseReleased", x + dx*w, y + dy*h, button="left", clickCount=1)
                if browser.wait(f"({PANEL})?.innerText.includes('teaching unreviewed or unavailable')", 1):
                    picked = True
                    break
                browser.eval(f"Array.from(({PANEL}).querySelectorAll('button')).find(b=>b.textContent==='Mouse pick' && b.getAttribute('aria-pressed')==='true')?.click()")
            assert picked, "mouse could not select the staged scan"
            print("PASS mouse selects anatomy and reports teaching status", flush=True)
            click(browser, "CT slices")
            image_data = f"""Array.from(({PANEL}).querySelectorAll('.jas-scan-slices canvas'))
                .slice(0, 3).map(c => c.width === 300 ? [] :
                    c.getContext('2d').getImageData(0, 0, c.width, c.height).data)"""
            check(browser, "three MPR canvases have sampled CT pixels",
                  f"({image_data}).every(data => data.some((n, i) => i % 4 === 0 && n > 0 && n === data[i + 2]))", 45)
            check(browser, "MPR includes a mesh contour",
                  f"({image_data}).some(data => data.some((n, i) => i % 4 === 0 && data[i + 2] - n > 20))")
            command(a="cut", plane={"o": [0, 0, 0], "n": [0.3, 0.4, 0.866]}, t=0.5)
            check(browser, "custom cut activates the oblique MPR panel", f"({PANEL}).querySelector('[aria-label^=cut]')?.parentElement.hidden === false && ({PANEL}).innerText.includes('Active cut')")
            click(browser, "Arm cut")
            check(browser, "gesture arming and lock control", f"({PANEL}).innerText.includes('Lock cut')")
            click(browser, "Lock cut")
            check(browser, "locking freezes manual depth", f"({PANEL}).innerText.includes('Locked') && Array.from(({PANEL}).querySelectorAll('label')).find(l=>l.innerText.includes('Cut depth')).querySelector('input').disabled")
            click(browser, "3D volume")
            check(browser, "real board enters 3D volume mode", f"({PANEL}).innerText.includes('3D CT with surface overlay')")
            click(browser, "Surface")
            check(browser, "real board returns to surface mode", f"({PANEL}).innerText.includes('Surface view')")
        finally:
            command(a="clear")
        check(browser, "removing scan disposes controls", f"!({PANEL})")
