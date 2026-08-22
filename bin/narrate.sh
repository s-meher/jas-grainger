#!/bin/bash
# barehands, anatomy edition — THE BOARD NARRATES ITSELF.
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Point at a structure with a bare hand and hear what it is. This watches
# the pointing field on the state bus, resolves whatever the cursor lands on
# through that model's anatomy.json, and speaks it aloud with macOS `say`.
# One direction only: you point, it talks. Nothing listens to you, nothing
# leaves the machine, and no AI is in the loop at runtime — every word it
# says is read out of the sidecar a human authored and a reviewer checked.
#
#   bin/narrate.sh              name only ("Left ventricle")
#   bin/narrate.sh --teach      name, then what it does
#   bin/narrate.sh --teach --voice Daniel     pick any macOS voice
#   bin/narrate.sh --seconds 60               stop on its own after a minute
#   bin/narrate.sh --dwell 3                  hold a structure 3s before it
#                                             speaks (default 2)
#
# Ctrl-C to stop (or use --seconds so it never outlives your session).
set -u
DIR="$(cd "$(dirname "$0")/.." && pwd)"
PORT=$(python3 -c "import json;print(json.load(open('$DIR/barehands.json')).get('port',8794))" 2>/dev/null || echo 8794)
MODE="brief"; VOICE=""; SECS=""; DWELL="2"
while [ $# -gt 0 ]; do
  case "$1" in
    --teach) MODE="teach" ;;
    --brief) MODE="brief" ;;
    --voice) shift; VOICE="${1:-}" ;;
    --seconds) shift; SECS="${1:-}" ;;
    --dwell) shift; DWELL="${1:-2}" ;;
    *) echo "usage: narrate.sh [--teach|--brief] [--voice <name>]" >&2; exit 1 ;;
  esac
  shift
done
export DIR PORT MODE VOICE SECS DWELL
python3 <<'PY'
import json, os, re, subprocess, time, urllib.request
from pathlib import Path

REPO = Path(os.environ["DIR"])
PORT, MODE, VOICE = os.environ["PORT"], os.environ["MODE"], os.environ["VOICE"]
DEADLINE = time.time() + float(os.environ["SECS"]) if os.environ.get("SECS") else None
# THE DWELL. The bus already demands a still hand, but "still" and
# "deliberately asking" are different bars: a hand resting near the organ
# while you think should not start a lecture. The structure must be
# continuously reported for this long before a word is spoken.
DWELL = float(os.environ.get("DWELL") or 2)
SIDECARS = {}


def sidecar(src):
    """The anatomy.json beside a staged GLB. A model staged out of holo/
    falls back to the solid copy's sidecar, exactly as the client does."""
    if src in SIDECARS:
        return SIDECARS[src]
    rel = re.sub(r"^/?media/", "", (src or "").split("?")[0]).lstrip("/")
    cands = [REPO / "media" / Path(rel).parent / "anatomy.json"]
    if rel.startswith("holo/"):
        cands.append(REPO / "media" / "models" /
                     Path(rel[5:]).parent / "anatomy.json")
    doc = None
    for c in cands:
        try:
            doc = json.loads(c.read_text())
            break
        except Exception:
            continue
    SIDECARS[src] = doc
    return doc


def first_sentence(t):
    m = re.match(r"\s*(.+?[.!?])(\s|$)", t or "")
    return (m.group(1) if m else (t or "")).strip()


def speak(text):
    cmd = ["say"] + (["-v", VOICE] if VOICE else []) + [text]
    try:
        subprocess.run(cmd, timeout=30)
    except Exception:
        pass


print("narrating — point at a structure and it will say what it is.", flush=True)
print(f"mode: {MODE}" + (f" · voice: {VOICE}" if VOICE else "") + " · Ctrl-C to stop\n", flush=True)
speak("Narration on. Point at a structure.")

last, last_t = None, 0.0
held, held_since = None, 0.0
while DEADLINE is None or time.time() < DEADLINE:
    try:
        d = json.loads(urllib.request.urlopen(
            f"http://127.0.0.1:{PORT}/state", timeout=2).read())
    except Exception:
        time.sleep(1)
        continue
    pt = d.get("pt") or {}
    sid = pt.get("structure")
    now = time.time()
    # speak a structure once: only on CHANGE, and never the same one twice
    # inside 8s (a hand hovering on a border flickers between neighbours)
    # track how long this structure has been continuously pointed at
    if sid != held:
        held, held_since = sid, now
    if not sid or now - held_since < DWELL or (sid == last and now - last_t < 8):
        time.sleep(0.25)
        continue
    src = None
    for i in (d.get("items") or []):
        if i.get("type") == "model" and (i.get("src") or "").endswith(
                pt.get("model", "\0")):
            src = i.get("src")
            break
    doc = sidecar(src) if src else None
    st = ((doc or {}).get("structures") or {}).get(sid)
    if not st:
        time.sleep(0.25)
        continue
    last, last_t = sid, now
    name = st.get("name") or sid.replace("_", " ")
    print(f"  {time.strftime('%H:%M:%S')}  {name}", flush=True)
    line = name
    if MODE == "teach":
        fn = first_sentence(((st.get("teach") or {}).get("function")) or "")
        if fn:
            line = f"{name}. {fn}"
            print(f"            {fn}", flush=True)
    speak(line)
PY
