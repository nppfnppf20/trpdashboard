/**
 * Tracker Refresh Signal
 * Advancements can be saved from places that aren't ancestors of the widgets
 * showing them (e.g. the "Add to Project Tracker?" hop after saving a meeting
 * note). Bumping this version lets the Overview Trackers widget and the
 * Project Tracker tab refetch straight away instead of only on next page load.
 */

import { writable } from 'svelte/store';

export const trackerVersion = writable(0);

export function bumpTrackerVersion() {
  trackerVersion.update(n => n + 1);
}
