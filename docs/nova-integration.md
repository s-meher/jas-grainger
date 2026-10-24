# NOVA baseline in JAS Grainger

## Provenance and layout

The `integrate-nova-baseline` branch merges NOVA's `main` at
`3376bbb` from https://github.com/AbdulMueedd/NOVA.git into JAS's
`main` at `b4cf2dc`. The merge retains both repositories' commit histories.
There were no overlapping paths or file conflicts. NOVA lives at the repository
root so its relative asset paths, server, scripts, and documentation keep working.

The existing JAS files remain unchanged:

- `Ideation.md`
- `KNOWLEDGE_Ledger.pdf`
- `README.pdf`

NOVA's AGPL-3.0-or-later license, copyright notices, and model attribution are
preserved. The heart data retains its separate CC-BY 4.0 attribution in
`media/models/heart/LICENSE.md`.

The application code and educational content are unchanged from this NOVA
revision. Follow-up changes make the test harness portable: Node copies test
fixtures through its filesystem API, the contract suite invokes Git Bash on
Windows and passes its Python interpreter to `board-state.sh`, and the visual
suite discovers Chrome or accepts a `CHROME` executable override.

## Run on Windows

Use Python 3.9+, Chrome, and a webcam. From the repository root in PowerShell:

```powershell
Copy-Item barehands.json.example barehands.json
python server.py
```

Open http://127.0.0.1:8794/stage.html in Chrome and allow the camera.
The personal `barehands.json` config is ignored by Git. Frontend dependencies
load from public CDNs; the first browser load needs internet access.

While reviewing the PR, clone this branch explicitly if needed:

```powershell
git clone --branch integrate-nova-baseline https://github.com/s-meher/jas-grainger.git
```

## Validation

Keep the server running in a separate terminal. Close tracker tabs and run the
suites sequentially because contract and visual checks share the state bus:

```powershell
$env:PYTHONUTF8 = '1'
node tests/test_gesture.mjs
python schemas/validate.py media/models/heart/anatomy.json media/models/heart/heart.glb
python schemas/validate.py --case cases/heart-anterior-stemi-01.json media/models/heart/anatomy.json
python tests/test_contract.py
python tests/test_visual.py
```

The contract suite needs Git Bash on Windows, defaulting to
`C:/Program Files/Git/bin/bash.exe`; set `BASH` if it is installed elsewhere.
The visual suite additionally needs Pillow (`python -m pip install Pillow`) and
Chrome; set `CHROME` to its executable path if discovery fails. Other shell
helpers still expect a Unix-like shell and `python3`; `bin/narrate.sh` uses
macOS's `say` command.

Automated checks cannot confirm webcam pointing accuracy or how gesture
thresholds feel with a real hand. Follow `tests/README.md` for those manual
acceptance checks before treating the baseline as ready for production.

## Future updates

The local `nova` remote points at the NOVA source. To take a later NOVA revision,
fetch it and merge it on another integration branch, review the changes, run
the checks, and open a PR. `update.sh` and `update.bat` compare against
`jaredrhod/barehands`, NOVA's underlying board project; they do not update NOVA
or merge changes automatically.
