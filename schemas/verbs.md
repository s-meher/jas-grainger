# board verbs — the anatomy-education extension

`POST /cmd` with `{"a": "<verb>", ...}` (see `bin/board.sh`). The server
validates and queues; the client (`stage.html`, owned by the Renderer
track) drains the queue via `/state`'s response body and applies it to a
model item on the board. This doc is the contract between the two: the
server enforces every row of the "validation" column exactly; the
"client behavior" column is what the Renderer track should build.

All seven verbs below additionally accept an optional **`title`** (string,
≤200 chars) that targets a model item exactly like the existing `explode`
verb does: title-match first (case-insensitive substring against the
item's title or src), else the freshest model item on the board. See
`stage.html`'s `findItem`.

## Verb table

| verb | args | validation (server) | client behavior |
|---|---|---|---|
| `cut` | `plane`, `t`, `arm`, `off` | At least one of `plane`/`t`/`arm`/`off` must be present. `plane` is either the string `"sagittal"`, `"coronal"`, or `"axial"`, **or** an object `{"o":[x,y,z], "n":[x,y,z]}` — `o` is a point in model space with each component clamped to `-1..1`, `n` is a normal the server re-normalizes to unit length (a zero-length `n` is rejected). `t` is a float, clamped to `0..1` (how far along the axis the cut plane sits). `arm` is `0` or `1`. `off` is `1`. | Slice the model at the plane; `t` scrubs the cut position; `arm` arms/primes the cut-plane gesture handle; `off:1` turns cutting off entirely. |
| `isolate` | `structure`, `off` | `structure` is a structure id (`^[a-z0-9_]{1,64}$`), required unless `off:1`. | Show only that structure (and hide/dim the rest of the model); `off:1` restores the full model. |
| `hide` | `structure`, `off` | Same as `isolate`. | Hide that one structure (rest of the model stays visible); `off:1` un-hides. |
| `label` | `structures`, `off` | `structures` is either the literal string `"all"` or a list of 1–12 structure ids, required unless `off:1`. | Show floating labels for the given structures (or every structure, for `"all"`); `off:1` clears labels. |
| `xray` | `focus`, `off` | Both optional — a bare `{"a":"xray"}` is valid. `focus`, if present, is a structure id. `off`, if present, must be `1`. | Switch the model to a translucent/x-ray shading mode; `focus` keeps one structure opaque/highlighted inside the x-ray view; `off:1` returns to solid shading. |
| `lesion` | `case`, `lesion`, `off` | `case` is a case id (`^[a-z0-9-]{1,64}$`) and `lesion` is a lesion id (`^[a-z0-9_]{1,64}$`), both required unless `off:1`. | Fetch `/case-render?id=<case>`, find the matching entry in its `lesions[]`, and apply that lesion's `render` (tint/decal/variant) to `structure` on the model; `off:1` clears any applied lesion rendering. |
| `layer` | `depth`, `off` | `depth` is an integer `0..8`, required unless `off:1`. | Peel/reveal structures up to that dissection `layer` (see `anatomy.json`'s per-structure `layer` field) — e.g. depth 0 shows skin only, higher depths reveal deeper structures; `off:1` resets to the default layer view. |

### Coercion notes

- Numbers are coerced with `float()`/`int()`, guarded — non-numeric input
  (including `null`/missing where a number is required) is a 400, not a
  silent default.
- `plane`'s object form is rewritten server-side to the normalized form
  `{"o": [float,float,float], "n": [unit-vector]}` before it's queued —
  the client never has to normalize `n` itself.
- `off` is only ever accepted as literal `1`; any other value 400s.

### Examples

```
board.sh '{"a":"cut","plane":"sagittal","t":0.5}'
board.sh '{"a":"cut","plane":{"o":[0,0,0],"n":[0,0,1]},"arm":1}'
board.sh '{"a":"isolate","structure":"left_ventricle"}'
board.sh '{"a":"isolate","off":1}'
board.sh '{"a":"hide","structure":"skin"}'
board.sh '{"a":"label","structures":["left_ventricle","aorta","mitral_valve"]}'
board.sh '{"a":"label","structures":"all"}'
board.sh '{"a":"xray","focus":"heart"}'
board.sh '{"a":"lesion","case":"cardiomyopathy-1","lesion":"septal_hypertrophy"}'
board.sh '{"a":"layer","depth":3}'
```

---

## STATE-BUS field names

The tracker's `/state` heartbeat (what `render`/`board-state.sh` read) is
size-capped — the tracker heartbeat has a **256KB** budget — so these are
deliberately short. The Renderer track publishes these on the state JSON;
`bin/board-state.sh` reads them (degrading gracefully when absent).

### Per model item

| field | shape | meaning |
|---|---|---|
| `cut` | `{"plane": <as queued>, "t": float}` | the active cut, if any |
| `iso` | `"<structure id>"` | the currently isolated structure, if any |
| `hid` | `["<structure id>", ...]` | currently hidden structure ids |
| `lb` | `["<structure id>", ...]` | currently labeled structure ids |

### Top-level

| field | shape | meaning |
|---|---|---|
| `pt` | `{"model": "<src>", "structure": "<structure id>", "mesh": "<raw mesh name>"}` | what the user's cursor is currently pointing at, across the whole scene (not per-item) |

All four per-item fields and the top-level `pt` are optional — an item
with none of them present renders exactly as it does today.
