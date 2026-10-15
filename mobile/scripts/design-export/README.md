# Design export (wireframe + final artboards)

`export-dc.js` opens every screen from `../svg-export/shots.py` in the web build and writes two editable
Design-canvas artboards per screen:

- `<name>.final.dc.html`: the V1 design with the app's exact layout, colours, fonts and icons. Photos become
  neutral placeholders; brand artwork (logo, onboarding illustrations) is referenced as `ASSET:<key>`.
- `<name>.wireframe.dc.html`: the same layout in greyscale, with photos as crossed boxes.

Each element becomes an absolutely positioned box or text layer. Clipping containers are kept, so rounded
cards and scrollers still crop their content.

```bash
EXPO_OFFLINE=1 npx expo export --platform web --output-dir /tmp/dist
python3 scripts/svg-export/serve.py /tmp/dist &           # serves on :8099
python3 scripts/svg-export/shots.py /tmp/shots.json
node scripts/design-export/export-dc.js /tmp/shots.json /tmp/dc
```
