// Shared filename convention for document/PDF exports across the app:
// "YYMMDD ProjectName DocType", e.g. "260826 Barton Solar Farm Planning Statement".
// Callers append their own extension.

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function formatExportDate(date = new Date()) {
  const yy = String(date.getFullYear()).slice(-2);
  return `${yy}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`;
}

export function projectNameFor(project) {
  return project?.project_name || project?.site_name || project?.project_reference || project?.project_code || 'Project';
}

// Strips only characters illegal in Windows/Mac filenames, keeping spaces
// and punctuation intact so exported names stay human-readable.
export function sanitizeFilename(name) {
  return String(name).replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Builds "YYMMDD ProjectName DocType" (no extension). Accepts either a
 * project object (looked up via projectNameFor) or a plain name string.
 */
export function buildExportFilename(projectOrName, docType) {
  const name = typeof projectOrName === 'string' ? projectOrName : projectNameFor(projectOrName);
  return sanitizeFilename(`${formatExportDate()} ${name} ${docType}`);
}
