# Frontend conventions

## CSS — always use the design tokens, never hardcode colors

This app has a centralized color/shadow token system defined in
`src/app.css` (the `:root` block, imported globally — no per-component
import needed). **Never write a raw hex color (`#3b82f6`), `rgb()`/`rgba()`
with literal numbers, or a named color (`white`, `black`) in a `<style>`
block or a `style="..."` attribute.** Always reference the matching token
with `var(--token-name)` instead.

Read `src/app.css` for the full, current list before styling anything new —
it changes over time. As of writing, the categories are:

- **Neutrals**: `--color-slate-50` through `--color-slate-900` — the one
  canonical grey/neutral scale. (A `--color-gray-*` scale also exists in the
  file but is deprecated — don't use it for new work.)
- **Primary accent**: `--color-primary-50/100/200/500/600/700/800` — the
  app's single interactive/brand color (blue). Use for buttons, links, focus
  rings, active/hover/selected states, spinners. Don't introduce a different
  hue for "the button color" — if something needs emphasis, it's primary.
- **Status/semantic**: `--color-badge-{warning,info,success,danger,indigo,purple,orange}-{bg,fg}`
  for status pills/badges (pending, completed, error, etc.), plus raw hue
  primitives (`--color-red-*`, `--color-amber-*`, `--color-emerald-*`, etc.)
  for anything else that needs to carry meaning through color.
- **Recurring UI patterns**: `--overlay-bg` (modal backdrop), `--focus-ring-blue`
  (input focus box-shadow), `--shadow-sm/md/lg/dropdown/modal` (the standard
  shadow scale — check these before inventing a new box-shadow value).
- **Spacing/type**: `--space-1..8`, `--radius-sm/md/lg/pill`, `--font-size-xs..2xl`,
  `--font-sans`. These exist but aren't rolled out everywhere yet — using them
  for new work is encouraged, but you'll still see plenty of raw `rem`/`px`
  values in older components; that's expected, not a bug to fix in passing.

**If a component needs a color that doesn't fit an existing token:** prefer
the *closest* existing token over inventing a new one-off value, unless the
color is genuinely decorative and needs to stay visually distinct (e.g. a
category/type differentiator, not a repeated interactive control) — in which
case add a new primitive to `app.css`'s `:root` block rather than hardcoding
it locally, so it stays centrally discoverable.

**Known deliberate exceptions** (don't try to "fix" these):
- `src/lib/styles/trpformatting.css` — mimics Word document styling, kept
  separate on purpose.
- The SVG chevron `background-image` data-URIs in `badges.css`'s
  `.badge-select-*` rules — CSS variables can't resolve inside data-URIs, so
  those stay literal (each is comment-pinned to the token it must match).
- Translucent `rgba()` shadows/overlays — CSS vars can't carry partial
  opacity without extra token infrastructure. See
  `docs/plans/CSS_TOKENIZATION_REMAINING_WORK.md` for the (optional, low
  priority) plan to fix this properly.

**Checking your work**: `cd frontend && npm run lint:css` flags any raw hex/rgb
left in `<style>` blocks or `style="..."` attributes. It's not wired into the
build (no CI exists in this repo yet), so it won't block anything — run it
manually after touching CSS to catch regressions before they land.
