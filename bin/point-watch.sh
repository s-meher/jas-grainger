#!/bin/bash
# barehands, anatomy edition — watch the pointing loop live.
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# board-state.sh prints one snapshot, which is useless for testing POINTING:
# by the time you have run it, your hand is on the keyboard. This polls the
# state bus for a while instead, so you can start it, put your hand over the
# organ, and watch what resolves.
#
#   bin/point-watch.sh [seconds]     (default 20)
#
# Reading the output:
#   hands 0            -> the tracker cannot see your hand at all
#   hands 1, pt none   -> hand seen, but the cursor is not resolving a
#                         structure: either it is not over the model, or it
#                         is over a gap between meshes, or it never held
#                         still long enough (the gate wants ~150ms)
#   POINTING <id>      -> it works; that is what the AI would name
set -u
DIR="$(cd "$(dirname "$0")/.." && pwd)"
PORT=$(python3 -c "import json;print(json.load(open('$DIR/barehands.json')).get('port',8794))" 2>/dev/null || echo 8794)
SECS="${1:-20}"
export PORT SECS
python3 <<'PY'
import json, os, time, urllib.request

port, secs = os.environ["PORT"], float(os.environ["SECS"])
end = time.time() + secs
last = object()
hits = {}
print(f"watching the pointing loop for {int(secs)}s — "
      "hold an open hand so the CURSOR RING sits on a structure\n")
while time.time() < end:
    try:
        d = json.loads(urllib.request.urlopen(
            f"http://127.0.0.1:{port}/state", timeout=2).read())
    except Exception:
        print("  the board is dark — is the server running?"); break
    cur = d.get("cursors") or []
    pt = d.get("pt")
    models = [i for i in (d.get("items") or []) if i.get("type") == "model"]
    key = json.dumps(pt, sort_keys=True) if pt else None
    if key != last:
        last = key
        stamp = time.strftime("%H:%M:%S")
        if pt:
            s = pt.get("structure", "?")
            hits[s] = hits.get(s, 0) + 1
            print(f"  {stamp}  POINTING  {s}   (mesh {pt.get('mesh','?')})")
        else:
            where = ""
            if cur and models:
                c = cur[0]
                m = models[0]
                where = (f"  cursor ({c['x']:.2f},{c['y']:.2f}) vs model "
                         f"({m.get('x',0):.2f},{m.get('y',0):.2f}) "
                         f"scale {m.get('scale',1)}")
            print(f"  {stamp}  pt none   hands {len(cur)}"
                  f" models {len(models)}{where}")
    time.sleep(0.25)

print()
if hits:
    print("resolved structures:")
    for s, n in sorted(hits.items(), key=lambda kv: -kv[1]):
        print(f"  {s}  ({n} separate holds)")
    print("\nDo the names match what you were actually touching? If they are "
          "the mirror image (you point left, it says right), say so — there "
          "is a one-line fix marked in js/medical/core.js.")
else:
    print("nothing resolved. Tell the agent what the lines above said — "
          "'hands 0' is a tracking problem, 'pt none' with hands seen is a "
          "pointing problem, and they have different fixes.")
PY
