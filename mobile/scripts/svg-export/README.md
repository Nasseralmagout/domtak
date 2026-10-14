# SVG export

Renders every Domtak screen and state from the running app and writes them to `design/svg/` at the repo root.

```bash
pip install -r scripts/svg-export/requirements.txt   # PyMuPDF + Pillow
sudo apt install poppler-utils                         # pdftocairo
npm i -g playwright && npx playwright install chromium
./scripts/svg-export/run.sh                            # or: run.sh /some/other/output/dir
```

How it works:

1. `expo export --platform web` builds the app, and `serve.py` serves it as a single-page app on port 8099.
2. `shots.py` writes `shots.json`: the list of screens (route, role, taps and text to enter to reach a state).
   To add a screen, add one `add(...)` line there.
3. `capture.js` opens each shot in headless Chromium at 412 × 892, signs in as the right role, performs
   the actions, and prints a **vector** PDF of the phone frame. Screens that scroll are also printed at
   full length (the viewport is grown until nothing scrolls).
4. `convert.py` runs `svgify.py` on every PDF and writes:
   - `phone/` and `full-length/`: `pdftocairo` output, text outlined, pixel-identical to the app.
   - `figma-editable/`: PyMuPDF output with live `<text>` in Poppins, DM Sans and Lilita One.

   Photos are recompressed (max 900 px) and embedded so each SVG is self-contained.
   It also regenerates `design/svg/README.md` (the index).

Env overrides for `capture.js`: `PLAYWRIGHT_MODULE` (path to the playwright package) and `CHROMIUM_PATH`.
