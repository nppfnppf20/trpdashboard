# CSS Tokenization — Remaining Work

Status as of 2026-08-28: the color centralization effort is functionally complete.
Every solid color across the app (`frontend/src`) now references the shared token
system in `frontend/src/app.css`. This doc tracks the two things that were
deliberately left undone, for whoever picks this up later.

## 1. Translucent `rgba()` calls (~188 remaining, low priority)

**What they are:** modal shadows, glass/overlay effects, and faint focus rings
that use partial transparency, e.g. `rgba(0, 0, 0, 0.1)` or
`rgba(59, 130, 246, 0.15)`.

**Why they're not tokenized:** the token system only has solid colors
(`--color-primary-500` etc.). There's no way to say "this token, but 15%
opaque" without a second layer of tokens. All ~188 have already had their
R/G/B values normalized to match the nearest palette color — they're visually
consistent with everything else, just not routed through `var()`.

**Check current count:**
```bash
cd frontend
npm run lint:css
```
(Everything reported at this point should be `function-disallowed-list` /
`rgba` — if `color-no-hex` violations reappear, something regressed and is a
higher priority than this cleanup.)

**How to actually fix it, if wanted:**
1. In `frontend/src/app.css`, add RGB-triplet-only companion tokens for the
   palette values that actually appear in these `rgba()` calls (a first pass
   over the current codebase found black, white, `--color-primary-500`,
   `--color-teal-600`, `--color-violet-600`, and `--color-slate-900` cover
   the majority) — e.g.:
   ```css
   --color-black-rgb: 0, 0, 0;
   --color-white-rgb: 255, 255, 255;
   --color-primary-500-rgb: 59, 130, 246;
   ```
2. Replace each literal `rgba(r, g, b, a)` with `rgba(var(--color-x-rgb), a)`.
3. Change the stylelint rule in `frontend/stylelint.config.js` from a blanket
   `function-disallowed-list: ['rgb', 'rgba']` to something that only flags
   `rgba()`/`rgb()` calls with literal numeric color arguments (allowing
   `rgba(var(--x), a)` through) — a custom regex-based rule, since stylelint's
   built-in `function-disallowed-list` can't distinguish the two.

Rough effort: 20–30 minutes, no visible change to the app.

## 2. Stylelint enforcement (Phase 4 of the original plan — not started)

`npm run lint:css` exists and works, but is **not wired into the build or
CI** — it's purely advisory. Nothing currently stops a future PR from adding
a new raw hex color.

**To close this out:**
1. Confirm the exception list: `trpformatting.css` (already in
   `stylelint.config.js`'s `ignoreFiles`), the SVG data-URI fills in
   `badges.css` (pinned via comments, not literally ignorable — they'll show
   as clean already since data-URIs use `%23` not `#`), and the ~188
   translucent `rgba()` calls from section 1 above (only relevant if those
   get fixed — otherwise they'll just always show as violations, which is
   fine as long as everyone knows why).
2. If this repo has a CI workflow (check for `.github/workflows/`), add
   `npm run lint:css` as a step. If it doesn't have CI at all, this is
   lower priority — consider a pre-commit hook only if the repo already
   uses one elsewhere (per project convention, don't introduce new
   infra unprompted).

## Reference

- Token definitions: `frontend/src/app.css` (`:root` block, lines ~1-179)
- Lint config: `frontend/stylelint.config.js`
- Check anytime: `cd frontend && npm run lint:css`
