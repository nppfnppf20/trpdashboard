// Svelte action: grows a <textarea> to fit its text (and shrinks back), so long text wraps instead of
// scrolling sideways. Pass the bound value as the parameter so it re-fits whenever the text changes,
// including when the box first appears:  <textarea use:autoGrow={value} bind:value rows="1"></textarea>
export function autoGrow(node, _text) {
  const fit = () => {
    node.style.height = 'auto';
    node.style.height = `${node.scrollHeight}px`;
  };
  fit();
  return { update: fit };
}
