# Reproducible sample screenshots

`npm run verify` runs `tests/browser/notebook.spec.ts`, saving all 19 listed routes at 390, 768 and 1280 pixels in light/dark themes under `screenshots/` (114 images after a complete pass).

Files are named `<width>-<theme>-<route-index>.png`; the route order is the `routes` array in that test. Images are sample fixtures and are not live capture evidence. Audio pages explicitly have no recording. These generated files are excluded from the source checkpoint to keep the recovery patch small; regenerate with the pinned lockfile.

The same browser suite tests join consent/focus, sample action refresh persistence, source navigation/keyboard tabs, and a 320-pixel navigation focus trap. Automated axe checks do not establish full WCAG conformance or replace screen reader/zoom/manual review.
