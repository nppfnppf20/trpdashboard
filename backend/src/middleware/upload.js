/**
 * Upload middleware
 * One place that defines how every file upload is limited and validated:
 *   1. multer enforces a size limit (files are held in memory, so the limit matters)
 *   2. the extension must be on the route's allowlist
 *   3. the file's leading bytes must match what the extension claims (ASVS V5.2.2)
 *
 * Usage (replaces a per-route `multer({...})`):
 *   const upload = createUpload({ exts: ['pdf', 'txt', 'md'] });
 *   router.post('/x', upload.single('file'), handler);
 */

import multer from 'multer';

const MB = 1024 * 1024;

export const DOC_EXTS = ['pdf', 'docx', 'txt', 'md'];

const hasBytes = (buf, bytes, offset = 0) =>
  buf.length >= offset + bytes.length && bytes.every((b, i) => buf[offset + i] === b);

// Plain text must not contain NUL bytes — a cheap, reliable "this is really binary" test.
const isPlainText = (buf) => !buf.subarray(0, 8192).includes(0x00);

const SIGNATURES = {
  // The PDF spec allows a little junk before the header, so look in the first KB.
  pdf: (buf) => buf.subarray(0, 1024).includes('%PDF'),
  docx: (buf) => hasBytes(buf, [0x50, 0x4b, 0x03, 0x04]), // ZIP container
  doc: (buf) => hasBytes(buf, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), // OLE2
  txt: isPlainText,
  md: isPlainText,
};

// Browser dictation clips: webm (Chrome/Firefox), mp4 (Safari), wav, ogg.
const isAudio = (buf) =>
  hasBytes(buf, [0x1a, 0x45, 0xdf, 0xa3]) ||   // EBML / webm
  hasBytes(buf, [0x66, 0x74, 0x79, 0x70], 4) ||  // 'ftyp' (mp4 / m4a)
  hasBytes(buf, [0x52, 0x49, 0x46, 0x46]) ||     // 'RIFF' (wav)
  hasBytes(buf, [0x4f, 0x67, 0x67, 0x53]);       // 'OggS'

const extOf = (name = '') => (name.includes('.') ? name.split('.').pop().toLowerCase() : '');

/**
 * Post-multer check. Skips quietly when no file was sent, because several
 * endpoints accept either a file or pasted text and their controllers handle that.
 */
export function validateUploadedFile(exts = DOC_EXTS) {
  return (req, res, next) => {
    const file = req.file;
    if (!file) return next();

    const ext = extOf(file.originalname);
    if (!exts.includes(ext)) {
      return res.status(400).json({ error: `Unsupported file type. Accepted: ${exts.map(e => `.${e}`).join(', ')}` });
    }
    if (!SIGNATURES[ext]?.(file.buffer)) {
      return res.status(400).json({ error: `The file contents do not look like a valid .${ext} file` });
    }
    next();
  };
}

function validateAudio(req, res, next) {
  if (req.file && !isAudio(req.file.buffer)) {
    return res.status(400).json({ error: 'The file contents do not look like a supported audio recording' });
  }
  next();
}

// Maps multer's own errors to client errors instead of letting them surface as 500s.
function handleMulterError(maxMB) {
  return (err, req, res, next) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: `File is too large. The limit is ${maxMB}MB.` });
    }
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: 'Invalid upload' });
    }
    return next(err);
  };
}

/**
 * @param {object}  [opts]
 * @param {number}  [opts.maxMB=20]        Max file size in MB
 * @param {string[]} [opts.exts]           Allowed extensions (documents)
 * @param {'document'|'audio'} [opts.kind] 'audio' skips the extension check and checks audio signatures
 * @param {number}  [opts.fieldSizeMB]     Max size of a non-file form field (multer default is 1MB)
 */
export function createUpload({ maxMB = 20, exts = DOC_EXTS, kind = 'document', fieldSizeMB } = {}) {
  const limits = { fileSize: maxMB * MB, ...(fieldSizeMB ? { fieldSize: fieldSizeMB * MB } : {}) };
  const instance = multer({ storage: multer.memoryStorage(), limits });
  const check = kind === 'audio' ? validateAudio : validateUploadedFile(exts);

  return {
    // Express accepts an array of middleware, so this drops into `router.post(path, upload.single('file'), handler)`
    single: (field) => [instance.single(field), handleMulterError(maxMB), check],
  };
}
