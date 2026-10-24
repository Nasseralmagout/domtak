# Domtak technical handbook

Source of `docs/Domtak-Technical-Handbook.pdf`: the implementation, deployment and service-activation guide for the frontend and backend teams (Android, iOS, web).

- Edit the content in `parts/` (plain HTML, one file per section; files are joined in name order).
- Rebuild from the repository root (needs `npm ci` in `mobile/` for the brand fonts, Playwright with Chromium, and Python 3 with `pypdf` and `pdfplumber`):

```
node docs/handbook/build.mjs
```

`PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` can point to an existing Playwright install and Chromium binary. The build fills in the contents page numbers automatically.
