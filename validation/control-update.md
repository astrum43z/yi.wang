# Gallery and environment control update

Scope: gallery blank-slot behavior, discoverability of light/season/weather settings, and motion/sound toggle semantics. Existing six PHOTOS records, photos, WRITING content, artwork, and CNAME remain unchanged.

## Changes

- All six gallery slots remain. The four empty buttons are disabled, removed from keyboard tab order by native HTML behavior, and do not register opening handlers. Empty figures do not have a hover lift.
- The viewer filters navigation, counter, and announcements to records with a real `src` or `full`. Buttons, arrow keys, and swipe all use the same step function. Out-of-range and empty-slot opening requests are ignored. Endpoints remain non-wrapping.
- The environment entry displays “光线·季节·天气”, with its existing live time/status beneath it. The compact two-line layout retains the existing control colors and typography.
- Motion and sound have stable accessible names. Both use `aria-pressed=true` for enabled. System reduced-motion also marks the motion control `aria-disabled=true`; the existing explanatory notice remains available.

## Verification performed

- `node validation/control-regression.cjs`: 64 focused logic/markup assertions passed, including non-contiguous photos, zero photos, one full-only photo, boundaries, counts, motion/reduced-motion combinations, sound states, and preserved six-slot markup.
- `node --check` passed for all root JavaScript files.
- `git -c core.whitespace=cr-at-eol diff --check` passed. Source HTML/JS retain repository CRLF line endings.
- PHOTOS and WRITING declarations compared unchanged against base commit 1a4ebac; no image files changed.

## Not verified

The local browser regression harness could not start Chromium: the execution environment rejects its local process socket (`Operation not permitted`), including after an approved escalation attempt. The supported cloud browser separately rejected the local preview URL with `ERR_BLOCKED_BY_CLIENT`. No rendering, keyboard-focus, swipe, mobile-layout, actual screen-reader, Safari, or physical-device pass is claimed. This focused report does not rerun or supersede historical V6 reports.

A full Playwright regression harness was prepared separately for a browser-capable preview environment. Before release, verify desktop 1440×960, mobile viewports 390×844 / 412×915 / 360×640, reduced-motion, keyboard open/close and focus return, viewer navigation boundaries, environment dialogs, and control overlap.

At the time of local verification, publication had not yet been performed. The checkout tracks `origin/main`, contains a root `CNAME` for yi.wang and `.nojekyll`, and has no checked-in GitHub Actions workflow. README documents reusing existing GitHub Pages configuration; GitHub's latest successful Pages workflow was verified against `main` commit `1a4ebac2721e704283dcb7ce04294d7ea712317b` before publication.
