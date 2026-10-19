/**
 * Policy Folders Service
 * Rules for the company policy folder tree: how deep it may go, what a folder may be moved into,
 * and which folders a "search this folder" scope covers. Pure functions over the flat folder rows
 * ({ id, parent_id }), so they can be tested without a database. The folder table is small, so the
 * whole tree is loaded and checked in memory.
 */

export const MAX_FOLDER_DEPTH = 4;

const toMap = (rows) => new Map(rows.map((r) => [r.id, r]));

/** Top-level folder = 1, its children = 2, and so on. 0 for "no folder". */
export function depthOf(rows, id) {
  const map = toMap(rows);
  let depth = 0;
  let cur = id == null ? null : map.get(id);
  while (cur && depth <= rows.length) { // the bound stops a corrupted cycle from looping forever
    depth++;
    cur = cur.parent_id == null ? null : map.get(cur.parent_id);
  }
  return depth;
}

/** Ids of every folder below this one, at any depth (not including the folder itself). */
export function descendantIds(rows, id) {
  const childrenOf = new Map();
  for (const r of rows) {
    if (r.parent_id == null) continue;
    if (!childrenOf.has(r.parent_id)) childrenOf.set(r.parent_id, []);
    childrenOf.get(r.parent_id).push(r.id);
  }
  const out = [];
  const queue = [...(childrenOf.get(id) || [])];
  while (queue.length) {
    const next = queue.shift();
    if (out.includes(next)) continue;
    out.push(next);
    queue.push(...(childrenOf.get(next) || []));
  }
  return out;
}

/** The folder plus everything inside it: what a "search this folder" scope covers. */
export const scopeIds = (rows, id) => [id, ...descendantIds(rows, id)];

/** Levels in the folder's own subtree: a folder with no sub-folders is 1. */
export function subtreeHeight(rows, id) {
  const base = depthOf(rows, id);
  const deepest = descendantIds(rows, id).reduce((max, d) => Math.max(max, depthOf(rows, d)), base);
  return deepest - base + 1;
}

/**
 * Checks that a folder can sit under `parentId` (null = top level). Pass `folderId` when moving or
 * renaming an existing folder, omit it when creating one. Returns an error message, or null if fine.
 */
export function checkPlacement(rows, { folderId = null, parentId = null }) {
  if (parentId == null) return null;
  if (!rows.some((r) => r.id === parentId)) return 'The parent folder was not found.';

  if (folderId != null) {
    if (parentId === folderId || descendantIds(rows, folderId).includes(parentId)) {
      return "A folder can't be moved into itself or one of its own sub-folders.";
    }
  }
  const levels = depthOf(rows, parentId) + (folderId != null ? subtreeHeight(rows, folderId) : 1);
  if (levels > MAX_FOLDER_DEPTH) return `Folders can only go ${MAX_FOLDER_DEPTH} levels deep.`;
  return null;
}
