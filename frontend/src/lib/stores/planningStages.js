/**
 * Planning Stages Refresh Signal
 * A stage can be changed from places that are not ancestors of the header strip (accepting a stage-change
 * suggestion on a meeting note review or in Project Chat). Bumping this lets the strip refetch instead of
 * only picking the change up on the next page load.
 */

import { writable } from 'svelte/store';

export const planningStagesVersion = writable(0);

export function bumpPlanningStagesVersion() {
  planningStagesVersion.update(n => n + 1);
}
