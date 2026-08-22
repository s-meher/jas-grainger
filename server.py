#!/usr/bin/env python3
# barehands: move things on your screen with your bare hands.
# Copyright (C) 2026 Jared Rhodenizer
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published
# by the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program. If not, see <https://www.gnu.org/licenses/>.
#
# SPDX-License-Identifier: AGPL-3.0-or-later
"""barehands server — serves the hand-tracked air-board on localhost.

localhost = a secure context, which is what lets the browser open your
camera for the tracker page. Nothing here ever leaves your machine.

Endpoints:
  GET  /stage.html, /media/*   the pages + the media airlock
  POST /state                  tracker's ~45Hz scene heartbeat; the response
                               carries queued commands (the command channel)
  GET  /state                  the render page mirrors the scene from here
  POST /cmd                    board commands (your AI -> the board)
  GET  /config                 the barehands.json config (name + orbs)
  GET  /tree?orb=N             a notes orb's folder tree — read-only, JAILED
  GET  /note?f=N/<rel>         one note's text — read-only, JAILED
  GET  /props                  the media airlock as a browsable tree
  GET  /orb                    your assistant's live state (the ring reads it)

Config lives in barehands.json next to this file:
  { "name": "Assistant", "port": 8794,
    "orbs": [ { "title": "Notes", "path": "sample-notes", "kind": "notes" },
              { "title": "Props", "path": "media",        "kind": "media" } ] }

"notes" orbs may point at ANY folder of markdown (an Obsidian vault is
just a folder of markdown). The "media" orb is always the repo's ./media
folder — the airlock: the only place images/models ever stage from.

Your AI drives the ring by writing tiny files into ./state/ :
  state/state      one word: idle | listening | thinking | speaking
  state/mood.json  {"mood": "green"|"amber"|"red", "ts": <unix time>}
  state/wave.json  {"samples": [0..1 x 64], "ts": <unix time>}
Missing files are fine — the ring just idles.
"""
import json
import re
import time
import urllib.parse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent


def load_config():
    cfg = {"name": "Assistant", "port": 8794, "orbs": []}
    try:
        cfg.update(json.loads((HERE / "barehands.json").read_text()))
    except Exception:
        pass
    if not cfg.get("orbs"):
        cfg["orbs"] = [
            {"title": "Notes", "path": "sample-notes", "kind": "notes"},
            {"title": "Props", "path": "media", "kind": "media"},
        ]
    for orb in cfg["orbs"]:
        orb["path"] = str(Path(str(orb.get("path", ""))).expanduser())
    return cfg


CONFIG = load_config()


def orb_root(i):
    """Resolve a notes orb's jail root, or None."""
    try:
        orb = CONFIG["orbs"][int(i)]
        assert orb.get("kind") == "notes"
        p = Path(orb["path"])
        if not p.is_absolute():
            p = HERE / p
        return p.resolve()
    except Exception:
        return None


_STATE = b"{}"          # latest scene state: tracker POSTs, render GETs
_CMDS = []              # queued board commands (your AI -> tracker)
_ALLOWED = ("add_img", "add_card", "clear", "reset", "hand", "give",
            "yank", "hover", "scroll_note", "widget", "explode", "assemble",
            "present",
            # anatomy-education fork: see the MEDICAL VERB EXTENSION below
            "cut", "isolate", "hide", "label", "xray", "lesion", "layer")

# ---------------------------------------------------------------------------
# MEDICAL VERB EXTENSION (anatomy-education fork) — cut / isolate / hide /
# label / xray / lesion / layer. Each validator below either raises (any
# Exception — ValueError/TypeError/KeyError all work) to reject the command,
# which do_POST's existing try/except already turns into a plain 400, or
# returns after optionally coercing/normalizing fields on `cmd` in place
# (e.g. clamping "t", normalizing a plane normal to unit length). None of
# these verbs carry "src", so they never touch the media-airlock jail above.
# See schemas/verbs.md for the full argument contract these enforce.
# ---------------------------------------------------------------------------
_STRUCT_RE = re.compile(r'^[a-z0-9_]{1,64}$')   # structure/lesion ids
_CASE_RE = re.compile(r'^[a-z0-9-]{1,64}$')     # case ids (cases/<id>.json)
_PLANES = ("sagittal", "coronal", "axial")


def _num(v):
    """float()-guarded numeric coercion — bools aren't numbers here, and
    anything that can't become a float raises instead of silently NaN'ing."""
    if isinstance(v, bool):
        raise ValueError("bool is not a number")
    return float(v)


def _v_title(cmd):
    """All medical verbs accept an optional "title" that targets a model
    item exactly like explode's title does (title-match first, else the
    freshest model on the board — client-side, see stage.html findItem)."""
    if "title" in cmd:
        t = cmd["title"]
        if not isinstance(t, str) or len(t) > 200:
            raise ValueError("bad title")


def _v_off(cmd):
    """Normalizes + consumes an "off": 1 request. Returns True if present
    (and valid), so callers can skip their "otherwise required" fields."""
    if "off" in cmd:
        if cmd["off"] != 1:
            raise ValueError("off must be 1")
        cmd["off"] = 1
        return True
    return False


def _v_structure_id(v):
    if not isinstance(v, str) or not _STRUCT_RE.match(v):
        raise ValueError("bad structure id")


def _v_cut(cmd):
    # plane: "sagittal"|"coronal"|"axial", OR {"o":[x,y,z], "n":[x,y,z]}
    # (n is normalized here; a zero-length n is rejected outright).
    have = False
    if "plane" in cmd:
        have = True
        p = cmd["plane"]
        if isinstance(p, str):
            if p not in _PLANES:
                raise ValueError("bad plane")
        elif isinstance(p, dict):
            o, n = p.get("o"), p.get("n")
            if not (isinstance(o, list) and len(o) == 3):
                raise ValueError("bad plane.o")
            if not (isinstance(n, list) and len(n) == 3):
                raise ValueError("bad plane.n")
            o = [_num(x) for x in o]
            if not all(-1.0 <= x <= 1.0 for x in o):
                raise ValueError("plane.o out of range")
            n = [_num(x) for x in n]
            mag = sum(x * x for x in n) ** 0.5
            if mag < 1e-9:
                raise ValueError("zero plane normal")
            cmd["plane"] = {"o": o, "n": [x / mag for x in n]}
        else:
            raise ValueError("bad plane")
    if "t" in cmd:
        have = True
        cmd["t"] = max(0.0, min(1.0, _num(cmd["t"])))
    if "arm" in cmd:
        have = True
        if cmd["arm"] not in (0, 1):
            raise ValueError("bad arm")
        cmd["arm"] = int(cmd["arm"])
    if _v_off(cmd):
        have = True
    if not have:
        raise ValueError("cut needs at least one of plane/t/arm/off")


def _v_isolate(cmd):
    if _v_off(cmd):
        return
    _v_structure_id(cmd.get("structure"))


def _v_hide(cmd):
    if _v_off(cmd):
        return
    _v_structure_id(cmd.get("structure"))


def _v_label(cmd):
    if _v_off(cmd):
        return
    s = cmd.get("structures")
    if s == "all":
        return
    if not isinstance(s, list) or not (1 <= len(s) <= 12):
        raise ValueError("bad structures")
    for x in s:
        _v_structure_id(x)


def _v_xray(cmd):
    _v_off(cmd)  # xray has nothing else required — plain {"a":"xray"} is OK
    if "focus" in cmd:
        _v_structure_id(cmd["focus"])


def _v_lesion(cmd):
    if _v_off(cmd):
        return
    c = cmd.get("case")
    if not isinstance(c, str) or not _CASE_RE.match(c):
        raise ValueError("bad case id")
    _v_structure_id(cmd.get("lesion"))


def _v_layer(cmd):
    if _v_off(cmd):
        return
    d = int(_num(cmd.get("depth")))
    if not (0 <= d <= 8):
        raise ValueError("depth out of range")
    cmd["depth"] = d


_MEDICAL_VERBS = {
    "cut": _v_cut, "isolate": _v_isolate, "hide": _v_hide,
    "label": _v_label, "xray": _v_xray, "lesion": _v_lesion,
    "layer": _v_layer,
}
# ---------------------------------------------------------------------------
# end MEDICAL VERB EXTENSION
# ---------------------------------------------------------------------------


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # no-store on the page itself so a plain reload always serves
        # current code (Chrome happily caches through reloads otherwise)
        p = self.path.split("?")[0]
        # ...and the same for the medical ES modules the page imports: they
        # are code exactly like stage.html is, and a cached core.js behind a
        # freshly-reloaded page is a debugging trap (you edit, you reload,
        # nothing changes, you doubt the edit).
        if p.endswith("stage.html") or p.startswith("/js/medical/"):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(HERE), **k)

    def log_message(self, *a):
        pass

    def _json(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        global _STATE
        n = int(self.headers.get("Content-Length", 0) or 0)
        body = self.rfile.read(n) if 0 < n < 262144 else b"{}"
        if self.path == "/state":
            # the tracker's heartbeat doubles as the command channel
            _STATE = body
            out = json.dumps(_CMDS[:8]).encode()
            del _CMDS[:8]
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(out)))
            self.end_headers()
            self.wfile.write(out)
            return
        if self.path == "/cmd":
            try:
                cmd = json.loads(body)
                assert cmd.get("a") in _ALLOWED
                if cmd["a"] in ("add_img", "hand", "give", "present") and cmd.get("src"):
                    # THE AIRLOCK: only files really inside ./media/ ever
                    # stage — subfolders allowed, escapes 400. If the
                    # exact path misses, a UNIQUE basename match anywhere
                    # inside the airlock self-heals a wrong-folder guess;
                    # zero or many matches still 400.
                    rel = str(cmd.get("src", "")).lstrip("/")
                    if rel.startswith("media/"):
                        rel = rel[6:]
                    media = (HERE / "media").resolve()
                    target = (media / rel).resolve()
                    if media not in target.parents or not target.is_file():
                        name = Path(rel).name.lower()
                        hits = [p for p in media.rglob("*")
                                if p.is_file()
                                and p.name.lower() == name] if name else []
                        if len(hits) != 1:
                            raise ValueError("not in the media airlock")
                        target = hits[0]
                    cmd["src"] = "/media/" + target.relative_to(media).as_posix()
                if cmd["a"] in _MEDICAL_VERBS:
                    # anatomy-education fork: validate + coerce, then queue
                    # exactly like every other verb — see _MEDICAL_VERBS above
                    _v_title(cmd)
                    _MEDICAL_VERBS[cmd["a"]](cmd)
                _CMDS.append(cmd)
                self.send_response(204)
            except Exception:
                self.send_response(400)
            self.end_headers()
            return
        self.send_response(404)
        self.end_headers()

    def do_GET(self):
        if self.path == "/config":
            # the page builds its ring name + orb bloom from this
            self._json({"name": CONFIG.get("name", "Assistant"),
                        "orbs": [{"title": o.get("title", "?"),
                                  "kind": o.get("kind", "notes")}
                                 for o in CONFIG["orbs"]]})
            return
        if self.path.startswith("/tree"):
            # a notes orb's folder tree. Jailed to that orb's configured
            # folder, .md only, CLAUDE.md (AI config, not a note) excluded.
            q = urllib.parse.parse_qs(
                urllib.parse.urlparse(self.path).query)
            idx = (q.get("orb") or ["0"])[0]
            root = orb_root(idx)
            if root is None or not root.is_dir():
                self._json({"name": "?", "notes": [], "dirs": []}, 404)
                return

            def walk(d):
                out = {"name": d.name, "notes": [], "dirs": []}
                for p in sorted(d.iterdir()):
                    if p.name.startswith("."):
                        continue
                    if p.is_dir():
                        sub = walk(p)
                        if sub["notes"] or sub["dirs"]:
                            out["dirs"].append(sub)
                    elif p.suffix == ".md" and p.name != "CLAUDE.md":
                        # note files travel as "<orb>/<relpath>" so /note
                        # knows which jail to resolve them against
                        out["notes"].append(
                            {"title": p.stem,
                             "file": f"{int(idx)}/{p.relative_to(root)}"})
                return out
            try:
                tree = walk(root)
                tree["name"] = CONFIG["orbs"][int(idx)].get("title", tree["name"])
                self._json(tree)
            except Exception:
                self._json({"name": "?", "notes": [], "dirs": []}, 500)
            return
        if self.path == "/props":
            # the media airlock as a browsable tree — live filesystem
            # read: drop a file in media/, reopen the orb, it's there
            EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".webm",
                    ".glb", ".gltf"}
            media_root = (HERE / "media").resolve()

            def walkm(d):
                out = {"name": d.name, "items": [], "dirs": []}
                for p in sorted(d.iterdir()):
                    if p.name.startswith("."):
                        continue
                    if p.is_dir():
                        sub = walkm(p)
                        if sub["items"] or sub["dirs"]:
                            out["dirs"].append(sub)
                    elif p.suffix.lower() in EXTS:
                        out["items"].append(str(p.relative_to(media_root)))
                return out
            try:
                tree = walkm(media_root)
                tree["name"] = "Props"
                self._json(tree)
            except Exception:
                self._json({"name": "Props", "items": [], "dirs": []}, 500)
            return
        if self.path.startswith("/case-render"):
            # anatomy-education fork: the LEARNER-VISIBLE view of a case —
            # only enough to render the scene (model + variant + where the
            # lesions live). Everything answer-bearing (vignette, diagnosis,
            # grading_rubric, teaching, sources, review, a lesion's
            # "finding") is deliberately never read into `out` below; see
            # schemas/case.schema.md for the full (private) case shape.
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            cid = (q.get("id") or [""])[0]
            cases_root = (HERE / "cases").resolve()
            if not _CASE_RE.match(cid):
                self.send_response(404)
                self.end_headers()
                return
            target = (cases_root / f"{cid}.json").resolve()
            if cases_root not in target.parents or not target.is_file():
                self.send_response(404)
                self.end_headers()
                return
            try:
                data = json.loads(target.read_text(encoding="utf-8"))
                lesions = []
                for l in (data.get("lesions") or []):
                    if isinstance(l, dict):
                        lesions.append({"id": l.get("id"),
                                         "structure": l.get("structure"),
                                         "render": l.get("render")})
                out = {"id": data.get("id"),
                       "model": data.get("model"),
                       "variant_model": data.get("variant_model"),
                       "lesions": lesions}
                self._json(out)
            except Exception:
                # malformed JSON (or anything else unexpected) 404s rather
                # than 500ing — a broken case file should look absent
                self.send_response(404)
                self.end_headers()
            return
        if self.path == "/orb":
            # the ring's heartbeat: your assistant's live state, read from
            # tiny files in ./state/. Every read fails soft — no files,
            # no assistant, no problem: the ring just breathes.
            s_dir = HERE / "state"
            out = {"state": "idle", "mood": "green", "wave": None}
            try:
                s = (s_dir / "state").read_text().strip().lower()
                if s in ("idle", "listening", "thinking", "speaking"):
                    out["state"] = s
            except Exception:
                pass
            try:
                m = json.loads((s_dir / "mood.json").read_text())
                if time.time() - float(m.get("ts", 0)) < 45.0:
                    out["mood"] = m.get("mood", "green")
            except Exception:
                pass
            if out["state"] == "speaking":
                try:
                    w = json.loads((s_dir / "wave.json").read_text())
                    if time.time() - float(w.get("ts", 0)) < 0.6:
                        out["wave"] = w.get("samples", [])[:64]
                except Exception:
                    pass
            self._json(out)
            return
        if self.path == "/state":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(_STATE)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(_STATE)
            return
        if not self.path.startswith("/note?"):
            return super().do_GET()
        # one note's text: f=<orb>/<relpath>, resolved against that orb's
        # jail. Inside the root, .md only, must exist — anything else 404s.
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        rel = (q.get("f") or [""])[0]
        idx, _, rel = rel.partition("/")
        root = orb_root(idx)
        if root is None:
            self.send_response(404)
            self.end_headers()
            return
        target = (root / rel).resolve()
        if (root not in target.parents) or target.suffix != ".md" \
                or not target.is_file():
            self.send_response(404)
            self.end_headers()
            return
        body = target.read_text(encoding="utf-8", errors="replace").encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    (HERE / "state").mkdir(exist_ok=True)   # the ring's runtime files land here
    port = int(CONFIG.get("port", 8794))
    print(f"barehands up: http://127.0.0.1:{port}/stage.html", flush=True)
    print("  tracker (camera): open that URL in Chrome", flush=True)
    print("  render (overlay): same URL + ?role=render", flush=True)
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
