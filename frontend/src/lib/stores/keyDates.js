/**
 * Key Dates Refresh Signal
 * Key dates (Conditions/Issues/Consultation) and programme events can be
 * added from several unrelated places — Add Advancement's post-save toast,
 * each tracker tab's own inline "generate summary" flow, Draft from Meeting
 * Notes, and the Meeting Notes summarise flow — none of which are ancestors
 * of KeyDatesWidget.svelte. Bumping this version lets that widget (or
 * anything else caching this data) know to refetch instead of only picking
 * up the change on next page load.
 */

import { writable } from 'svelte/store';

export const keyDatesVersion = writable(0);

export function bumpKeyDatesVersion() {
  keyDatesVersion.update(n => n + 1);
}
