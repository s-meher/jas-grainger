# NOVA · Grainger pitch deck

A paged, website-style slide deck for the 10-minute Grainger Computing Innovation Prize pitch. It is 10 slides, planned at 8:05.

## Run it

```bash
cd presentation
python3 -m http.server 8765
# open http://127.0.0.1:8765/index.html in Chrome
```

Use a local server rather than opening the file directly, or the fonts and the heart model may not load.

## Keys

| Key | Action |
|---|---|
| ← / → / Space | Previous / next slide |
| P | Presenter window: notes, timers, next slide |
| R | Rehearsal mode: logs time per slide and shows planned vs actual |
| T | Clock |
| F | Fullscreen |

## Assets

- `film.mp4`: AI-generated concept film. It is not footage of the product.
- `heart.js`: the prototype's 16-part heart. BodyParts3D, © DBCLS, CC BY 4.0.
- `fonts/`: Geist, Geist Mono (SIL OFL) and Instrument Serif (SIL OFL).
