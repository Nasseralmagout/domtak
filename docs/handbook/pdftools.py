"""Helpers for build.mjs.

pages <body.pdf>                    -> prints {"h1": 3, ...}: the page of each heading marker (QQh1QQ)
merge <cover.pdf> <body.pdf> <out>  -> cover + body, with document metadata
"""
import json
import logging
import re
import sys

import pdfplumber
from pypdf import PdfReader, PdfWriter

logging.getLogger('pdfminer').setLevel(logging.ERROR)


def pages(pdf_path):
    found = {}
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            text = re.sub(r'\s+', '', page.extract_text() or '')
            for m in re.finditer(r'QQ(h\d+)QQ', text):
                found.setdefault(m.group(1), i)
    print(json.dumps(found))


def merge(cover, body, out):
    writer = PdfWriter()
    for src in (cover, body):
        for page in PdfReader(src).pages:
            writer.add_page(page)
    writer.add_metadata({
        '/Title': 'Domtak V1 - Technical Handbook (Android, iOS, Web)',
        '/Subject': 'Implementation, deployment and service activation guide for the frontend and backend teams',
        '/Author': 'Domtak',
    })
    with open(out, 'wb') as fh:
        writer.write(fh)


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'pages':
        pages(sys.argv[2])
    elif cmd == 'merge':
        merge(*sys.argv[2:5])
