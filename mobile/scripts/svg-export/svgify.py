"""Convert a one-page screen PDF into two SVGs.
  outlined: pdftocairo output - exact visuals, text drawn as vector outlines (opens identically everywhere)
  editable: PyMuPDF output with real <text> elements (Poppins / DM Sans / Lilita One) for Figma & Illustrator
Usage: svgify.py screen.pdf outlined.svg editable.svg width_px height_px title
"""
import base64
import io
import re
import subprocess
import sys

import pymupdf
from PIL import Image

pdf, out_outlined, out_editable, w_px, h_px, title = sys.argv[1:7]
FONTS_CSS = (
    "@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700"
    "&amp;family=Poppins:wght@500;600;700&amp;family=Lilita+One&amp;display=swap');"
)
FAMILY = {
    'DM Sans': ('DM Sans', 400),
    'DM Sans Medium': ('DM Sans', 500),
    'DM Sans Bold': ('DM Sans', 700),
    'Poppins': ('Poppins', 400),
    'Poppins Medium': ('Poppins', 500),
    'Poppins SemiBold': ('Poppins', 600),
    'Poppins Bold': ('Poppins', 700),
    'Lilita One': ('Lilita One', 400),
}
WS = re.compile(r'\s+')


def recompress(svg):
    def fix(m):
        data = m.group(2)
        try:
            im = Image.open(io.BytesIO(base64.b64decode(data)))
            im.load()
        except Exception:
            return m.group(0)
        if max(im.size) > 900:
            im.thumbnail((900, 900), Image.LANCZOS)
        buf = io.BytesIO()
        rgba = im.convert('RGBA')
        if rgba.getchannel('A').getextrema()[0] < 255:
            rgba.save(buf, 'PNG', optimize=True)
            kind = 'png'
        else:
            im.convert('RGB').save(buf, 'JPEG', quality=80, optimize=True, progressive=True)
            kind = 'jpeg'
        new = base64.b64encode(buf.getvalue()).decode()
        return f'data:image/{kind};base64,{new}' if len(new) < len(data) else m.group(0)

    return re.sub(r'data:image/(png|jpeg);base64,([A-Za-z0-9+/=\s]+)', fix, svg)


def size_and_title(svg):
    svg = re.sub(r'(<svg\b[^>]*?)\swidth="[^"]+"', rf'\1 width="{w_px}"', svg, count=1)
    svg = re.sub(r'(<svg\b[^>]*?)\sheight="[^"]+"', rf'\1 height="{h_px}"', svg, count=1)
    svg = re.sub(r'(<svg\b[^>]*?>)', rf'\1\n<title>{title}</title>', svg, count=1)
    return svg


def fix_text_tag(m):
    tag = m.group(0)
    fm = re.search(r'font-family="([^"]+)"', tag)
    if not fm:
        return tag
    family, weight = FAMILY.get(fm.group(1), (fm.group(1), 400))
    wm = re.search(r'font-weight="([^"]+)"', tag)
    if wm:
        w = wm.group(1)
        if w == 'bold':
            weight = max(weight, 700)
        elif w.isdigit():
            weight = int(w)
        tag = tag.replace(wm.group(0), '')
    tag = tag.replace(fm.group(0), f'font-family="{family}" font-weight="{weight}"')
    return WS.sub(' ', tag).replace(' >', '>')


# Outlined (exact)
subprocess.run(['pdftocairo', '-svg', '-f', '1', '-l', '1', pdf, out_outlined], check=True)
with open(out_outlined, encoding='utf-8') as fh:
    s = fh.read()
with open(out_outlined, 'w', encoding='utf-8') as fh:
    fh.write(size_and_title(recompress(s)))

# Editable text
doc = pymupdf.open(pdf)
s = doc[0].get_svg_image(text_as_path=False)
s = re.sub(r'<text\b[^>]*>', fix_text_tag, s)
s = s.replace('xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" ', '')
s = re.sub(r'(<svg\b[^>]*?>)', rf'\1\n<style>{FONTS_CSS}</style>', s, count=1)
with open(out_editable, 'w', encoding='utf-8') as fh:
    fh.write(size_and_title(recompress(s)))
