// Inline style for a `position: fixed` popover anchored to a button, kept inside
// the viewport. Opens downward by default; flips upward when it doesn't fit
// below and there is more room above, and caps max-height (it then scrolls) so
// it can never push past the screen edge and stretch the page.
// Call after the popover has rendered (await tick()) so its natural height can
// be measured.
export function popoverStyle(anchorEl, popoverEl, width, { gap = 6, margin = 8 } = {}) {
  const r = anchorEl.getBoundingClientRect();
  const height = popoverEl.offsetHeight;
  const roomBelow = window.innerHeight - r.bottom - gap - margin;
  const roomAbove = r.top - gap - margin;
  const openUp = height > roomBelow && roomAbove > roomBelow;
  const maxHeight = Math.max(120, openUp ? roomAbove : roomBelow);
  const top = openUp ? Math.max(margin, r.top - gap - Math.min(height, maxHeight)) : r.bottom + gap;
  const left = Math.min(Math.max(margin, r.right - width), window.innerWidth - width - margin);
  return `top:${top}px; left:${left}px; max-height:${maxHeight}px; overflow-y:auto;`;
}
