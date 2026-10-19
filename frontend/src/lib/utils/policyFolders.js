/**
 * Helpers for the company policy folder tree. Folders arrive from the API as a flat list
 * ({ id, name, parent_id, sort_order }); these build the nesting and the pickers from it.
 * The same depth rules are enforced by the backend (policyFolders.service.js); the checks here
 * only keep the pickers from offering choices that would be refused.
 */

export const MAX_FOLDER_DEPTH = 4;

const byName = (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });

/** @param {any[]} folders */
export function childrenMap(folders) {
  /** @type {Map<number | null, any[]>} */
  const map = new Map();
  for (const f of folders) {
    const key = f.parent_id ?? null;
    if (!map.has(key)) map.set(key, []);
    map.get(key)?.push(f);
  }
  for (const list of map.values()) list.sort(byName);
  return map;
}

/** Top-level folder = 1. 0 for "no folder". */
export function depthOf(folders, id) {
  const byId = new Map(folders.map(f => [f.id, f]));
  let depth = 0;
  let cur = id == null ? null : byId.get(id);
  while (cur && depth <= folders.length) {
    depth++;
    cur = cur.parent_id == null ? null : byId.get(cur.parent_id);
  }
  return depth;
}

/** The folder and every folder inside it. */
export function scopeIds(folders, id) {
  const kids = childrenMap(folders);
  const out = [];
  const queue = [id];
  while (queue.length) {
    const next = queue.shift();
    if (out.includes(next)) continue;
    out.push(next);
    queue.push(...(kids.get(next) || []).map(f => f.id));
  }
  return out;
}

/** Levels in a folder's own subtree (a folder with no sub-folders = 1). */
export function subtreeHeight(folders, id) {
  const base = depthOf(folders, id);
  return scopeIds(folders, id).reduce((max, d) => Math.max(max, depthOf(folders, d)), base) - base + 1;
}

/**
 * Every folder in tree order with its depth, for pickers. `exclude` removes a folder and its
 * contents (so a folder can't be offered as its own parent); `movingId` also hides parents that
 * would push the moved folder's subtree past the depth limit.
 * @param {any[]} folders
 * @param {{ exclude?: number | null, movingId?: number | null }} [opts]
 */
export function folderOptions(folders, { exclude = null, movingId = null } = {}) {
  const kids = childrenMap(folders);
  const hidden = exclude == null ? [] : scopeIds(folders, exclude);
  const needed = movingId != null ? subtreeHeight(folders, movingId) : 1;
  /** @type {{ id: number, name: string, depth: number, label: string, canHoldChildren: boolean }[]} */
  const out = [];
  const walk = (parent, depth) => {
    for (const f of kids.get(parent) || []) {
      if (hidden.includes(f.id)) continue;
      out.push({ id: f.id, name: f.name, depth, label: `${' '.repeat(depth - 1)}${f.name}`, canHoldChildren: depth + needed <= MAX_FOLDER_DEPTH });
      walk(f.id, depth + 1);
    }
  };
  walk(null, 1);
  return out;
}

/** "HR / Leave / Annual" for a folder id, or '' */
export function folderPath(folders, id) {
  const byId = new Map(folders.map(f => [f.id, f]));
  const parts = [];
  let cur = id == null ? null : byId.get(id);
  while (cur && parts.length <= folders.length) {
    parts.unshift(cur.name);
    cur = cur.parent_id == null ? null : byId.get(cur.parent_id);
  }
  return parts.join(' / ');
}
