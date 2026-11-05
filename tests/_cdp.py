"""Minimal Chrome DevTools Protocol driver, stdlib only, for the browser suites.

Unlike `chrome --dump-dom --virtual-time-budget`, this runs the page in REAL
time. That matters: virtual time does not advance worker threads or network
waits reliably, which is why the tracker page "hung" headless before.

    with Browser(fake_camera=True) as b:
        b.open("http://127.0.0.1:8794/stage.html")
        b.wait("!document.getElementById('boot')", 90)
        b.eval("1 + 1")
"""
import base64
import json
import os
import shutil
import socket
import struct
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path


def chrome_path():
    c = os.environ.get("CHROME") or shutil.which("google-chrome") or shutil.which("chromium")
    if c:
        return c
    for p in (Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
              Path(os.environ.get("PROGRAMFILES", "C:/Program Files")) / "Google/Chrome/Application/chrome.exe"):
        if p.is_file():
            return str(p)
    raise SystemExit("Chrome not found. Set CHROME to the browser executable path.")


class _WS:
    """RFC 6455 client: text frames, client masking, enough for CDP."""

    def __init__(self, url):
        assert url.startswith("ws://")
        hostport, path = url[5:].split("/", 1)
        host, port = hostport.split(":")
        self.s = socket.create_connection((host, int(port)), timeout=60)
        key = base64.b64encode(os.urandom(16)).decode()
        self.s.sendall((f"GET /{path} HTTP/1.1\r\nHost: {hostport}\r\nUpgrade: websocket\r\n"
                        f"Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n").encode())
        buf = b""
        while b"\r\n\r\n" not in buf:
            buf += self.s.recv(4096)
        if b" 101 " not in buf.split(b"\r\n", 1)[0]:
            raise ConnectionError("websocket upgrade refused")
        self.rest = buf.split(b"\r\n\r\n", 1)[1]

    def _read(self, n):
        while len(self.rest) < n:
            chunk = self.s.recv(65536)
            if not chunk:
                raise ConnectionError("socket closed")
            self.rest += chunk
        out, self.rest = self.rest[:n], self.rest[n:]
        return out

    def send(self, text):
        data = text.encode()
        mask = os.urandom(4)
        n = len(data)
        head = bytes([0x81]) + (bytes([0x80 | n]) if n < 126 else
                                bytes([0x80 | 126]) + struct.pack(">H", n) if n < 65536 else
                                bytes([0x80 | 127]) + struct.pack(">Q", n))
        self.s.sendall(head + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))

    def recv(self):
        msg = b""
        while True:
            b0, b1 = self._read(2)
            n = b1 & 0x7F
            if n == 126:
                n = struct.unpack(">H", self._read(2))[0]
            elif n == 127:
                n = struct.unpack(">Q", self._read(8))[0]
            payload = self._read(n)
            op = b0 & 0x0F
            if op in (0x1, 0x0, 0x2):
                msg += payload
                if b0 & 0x80:
                    return msg.decode()
            elif op == 0x8:
                raise ConnectionError("websocket closed")


class Browser:
    def __init__(self, *, fake_camera=True, auto_allow=True, extra=(), port=9339):
        self.args = ["--headless=new", f"--remote-debugging-port={port}", "--no-first-run",
                     "--window-size=1280,800"]
        if fake_camera:
            self.args.append("--use-fake-device-for-media-stream")
        if auto_allow:
            self.args.append("--use-fake-ui-for-media-stream")
        self.args += list(extra)
        self.port, self.n = port, 0

    def __enter__(self):
        self.prof = tempfile.mkdtemp()
        self.p = subprocess.Popen([chrome_path(), *self.args, f"--user-data-dir={self.prof}", "about:blank"],
                                  stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(100):
            try:
                tabs = json.load(urllib.request.urlopen(f"http://127.0.0.1:{self.port}/json"))
                page = [t for t in tabs if t["type"] == "page"][0]
                break
            except Exception:
                time.sleep(0.2)
        else:
            raise RuntimeError("Chrome DevTools did not come up")
        self.ws = _WS(page["webSocketDebuggerUrl"])
        self.call("Page.enable")          # required for addScriptToEvaluateOnNewDocument
        # collect page errors so a failing check can say why
        self.call("Page.addScriptToEvaluateOnNewDocument", source=(
            "window.__errors=[];addEventListener('error',e=>__errors.push(String(e.message)));"
            "addEventListener('unhandledrejection',e=>__errors.push('rejection: '+String(e.reason&&e.reason.message||e.reason)));"))
        return self

    def __exit__(self, *a):
        try:
            self.p.kill()
            self.p.wait(10)
        finally:
            shutil.rmtree(self.prof, ignore_errors=True)

    def call(self, method, **params):
        self.n += 1
        self.ws.send(json.dumps({"id": self.n, "method": method, "params": params}))
        while True:
            r = json.loads(self.ws.recv())
            if r.get("id") == self.n:
                if "error" in r:
                    raise RuntimeError(f"{method}: {r['error']}")
                return r.get("result", {})

    def open(self, url):
        self.call("Page.navigate", url=url)

    def eval(self, expr):
        r = self.call("Runtime.evaluate", expression=expr, returnByValue=True, awaitPromise=True)
        if "exceptionDetails" in r:
            raise RuntimeError(r["exceptionDetails"].get("text", "page exception"))
        return r.get("result", {}).get("value")

    def wait(self, expr, timeout=60, every=0.5):
        t = time.time()
        while time.time() - t < timeout:
            try:
                v = self.eval(expr)
                if v:
                    return v
            except RuntimeError:
                pass
            time.sleep(every)
        return None

    def key(self, ch):
        self.call("Input.dispatchKeyEvent", type="keyDown", key=ch, text=ch, code="Key" + ch.upper())
        self.call("Input.dispatchKeyEvent", type="keyUp", key=ch, code="Key" + ch.upper())

    def mouse(self, kind, x, y, **kw):
        self.call("Input.dispatchMouseEvent", type=kind, x=x, y=y, **kw)
