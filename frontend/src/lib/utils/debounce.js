// Coalesces rapid-fire calls (e.g. a burst of checkbox toggles) into one
// trailing call after `delay` ms of quiet.
export function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
