"""Convert captured PDFs into the design/svg deliverable and write its README index.
Usage: convert.py <captureDir> <designDir>
"""
import json
import os
import shutil
import subprocess
import sys

cap, design = sys.argv[1], sys.argv[2]
here = os.path.dirname(os.path.abspath(__file__))
venv_py = sys.executable
data = json.load(open(os.path.join(cap, 'manifest.json')))
manifest = data['manifest']

SECTIONS = {
    '01': 'Onboarding & sign-in',
    '02': 'Home & social',
    '03': 'Events & tickets',
    '04': 'Artists & venues',
    '05': 'Booking (escrow)',
    '06': 'Calendar & messages',
    '07': 'Account',
    '08': 'Pro tools',
    '09': 'Admin console (demo)',
}

for sub in ('phone', 'full-length', 'figma-editable'):
    d = os.path.join(design, sub)
    if os.path.isdir(d):
        shutil.rmtree(d)
    os.makedirs(d)

rows = []
for m in manifest:
    if m.get('error'):
        print('skip (capture failed):', m['name'], m['error'])
        continue
    name, title = m['name'], m['title']
    phone_svg = os.path.join(design, 'phone', f'{name}.svg')
    tmp_editable = os.path.join(cap, f'{name}.editable.svg')
    subprocess.run([venv_py, os.path.join(here, 'svgify.py'), m['phonePdf'], phone_svg, tmp_editable, '412', '892', title], check=True)
    full = None
    if m.get('fullPdf'):
        full_svg = os.path.join(design, 'full-length', f'{name}.svg')
        editable = os.path.join(design, 'figma-editable', f'{name}.svg')
        subprocess.run([venv_py, os.path.join(here, 'svgify.py'), m['fullPdf'], full_svg, editable, '412', str(m['fullHeight']), title], check=True)
        full = m['fullHeight']
    else:
        shutil.copy(tmp_editable, os.path.join(design, 'figma-editable', f'{name}.svg'))
    rows.append((m['section'], name, title, full))
    print('ok', name)

def mb(path):
    total = 0
    for root, _, files in os.walk(path):
        total += sum(os.path.getsize(os.path.join(root, f)) for f in files)
    return total / 1e6

lines = [
    '# Domtak — all app screens as SVG',
    '',
    f'{len(rows)} screens and states, exported from the running app (Expo web build, 412 × 892 pt phone frame).',
    '',
    '| Folder | What it is | Use it for |',
    '|---|---|---|',
    f'| `phone/` | Exact phone-frame view (412 × 892). Text is outlined, so it looks identical everywhere. ({mb(os.path.join(design, "phone")):.1f} MB) | Presentations, docs, quick review |',
    f'| `full-length/` | Same screens at their full scroll length (only screens that scroll). ({mb(os.path.join(design, "full-length")):.1f} MB) | Seeing everything below the fold |',
    f'| `figma-editable/` | Full-length screens with **live text layers** (Poppins, DM Sans, Lilita One) and vector icons. ({mb(os.path.join(design, "figma-editable")):.1f} MB) | Import into Figma / Illustrator and edit |',
    '',
    'Figma: drag the SVG files from `figma-editable/` onto the canvas. Poppins, DM Sans and Lilita One are Google Fonts that Figma includes, so the text stays editable.',
    'Photos are embedded inside each SVG, so every file is self-contained.',
    '',
]
current = None
for section, name, title, full in rows:
    if section != current:
        current = section
        lines += ['', f'## {section} · {SECTIONS.get(section, section)}', '', '| # | Screen | Phone | Full length | Figma editable |', '|---|---|---|---|---|']
    num = name.split('-')[1]
    full_link = f'[full](full-length/{name}.svg)' if full else '—'
    lines.append(f'| {section}.{num} | {title} | [phone](phone/{name}.svg) | {full_link} | [edit](figma-editable/{name}.svg) |')
lines += ['', 'Regenerate: see `mobile/scripts/svg-export/README.md`.', '']
open(os.path.join(design, 'README.md'), 'w').write('\n'.join(lines))
print('README written;', len(rows), 'screens')
