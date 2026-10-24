# anatomy.json — the mesh → structure sidecar

One `anatomy.json` sits next to a GLB in `media/models/<organ>/`, e.g.:

```
media/models/heart/heart.glb
media/models/heart/anatomy.json
```

It maps the GLB's raw mesh/node names to a clinically meaningful structure
tree, so the client (and `schemas/validate.py`) can go from "a triangle the
user is pointing at" to "the left ventricle" without either side
hardcoding mesh names.

## Top-level shape

```json
{
  "schema": "barehands-anatomy/1",
  "model": "heart.glb",
  "source": {
    "name": "Human Heart (BioDigital)",
    "url": "https://example.org/heart-model",
    "license": "CC-BY-4.0",
    "modifications": "retopologized, materials baked, renamed meshes to snake_case"
  },
  "system": "cardiovascular",
  "structures": {
    "left_ventricle": {
      "name": "Left Ventricle",
      "meshes": ["LV_*", "lv_wall"],
      "parent": "heart",
      "children": [],
      "layer": 2,
      "fma": "FMA:9466",
      "teach": {
        "function": "pumps oxygenated blood into the aorta and systemic circulation",
        "connects": ["aorta", "mitral_valve"],
        "diseased_appearance": "wall thickening (hypertrophy) or thinning/dilation in cardiomyopathy",
        "sources": ["Gray's Anatomy 42e, ch. 60"]
      }
    },
    "heart": {
      "name": "Heart",
      "meshes": ["Heart_outer"],
      "parent": null,
      "children": ["left_ventricle"],
      "layer": 0
    }
  },
  "aliases": {
    "lv": "left_ventricle",
    "left ventricle": "left_ventricle"
  }
}
```

## Field reference

| field | type | required | notes |
|---|---|---|---|
| `schema` | string | yes | must be exactly `"barehands-anatomy/1"` |
| `model` | string | yes | GLB filename (or relative path) alongside this file |
| `source` | object | yes | `{name, url, license, modifications}` — all strings; provenance for the asset |
| `system` | string | yes | free text, e.g. `"cardiovascular"`, `"skeletal"` |
| `axes` | object | no | how the model sits in its own space: `{"superior": "+z", "left": "+x", "anterior": "-y"}`. Each value is a signed axis (`+x`/`-x`/`+y`/`-y`/`+z`/`-z`). **This is what makes the `cut` presets anatomical**: sagittal cuts perpendicular to `left`, coronal to `anterior`, axial to `superior`. Omit it and the client assumes the glTF Y-up convention (`superior:+y, left:+x, anterior:+z`), which is wrong for most segmented medical datasets — measure your model and state it. |
| `structures` | object | yes | keyed by **snake_case id**, `^[a-z0-9_]{1,64}$` — see below |
| `aliases` | object | yes (may be `{}`) | `{"<free-text alias>": "<structure id>"}` |

### A `structures.<id>` entry

| field | type | required | notes |
|---|---|---|---|
| `name` | string | yes | human-readable display name |
| `meshes` | array of string | yes, ≥1 entry | GLB mesh/node names this structure owns. `*` globs allowed (`fnmatch` rules), e.g. `"LV_*"` matches `LV_wall`, `LV_trabeculae`, ... |
| `parent` | string id or `null` | yes | the id of the enclosing structure, or `null` at the tree root |
| `children` | array of string id | yes (may be `[]`) | ids of structures nested inside this one |
| `layer` | integer ≥ 0 | yes | dissection depth — layer 0 is outermost/skin-level, higher numbers are deeper. Drives the `layer` verb (see `schemas/verbs.md`) |
| `fma` | string | no | Foundational Model of Anatomy ontology id, e.g. `"FMA:9466"` |
| `teach` | object | no | `{function, connects[], diseased_appearance, sources[]}` — all optional within `teach`; `connects` is a list of structure ids |

### Ids

Every structure key, every `parent`, every entry of `children`/`connects`,
and every alias target must be a **snake_case id** matching
`^[a-z0-9_]{1,64}$`, and must resolve to a key that actually exists in
`structures`. `schemas/validate.py` checks all of this.

### `meshes` globs

Patterns are matched against GLB mesh/node names with Python's `fnmatch`
(case-sensitive, `*`/`?`/`[seq]` supported). A mesh should match exactly
one structure's glob list — `validate.py <anatomy.json> <model.glb>`
reports orphan meshes (matched by nothing) and structures matching zero
meshes.
