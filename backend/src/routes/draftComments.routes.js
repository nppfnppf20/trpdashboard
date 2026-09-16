import express from 'express';
import multer from 'multer';
import * as draftCommentsController from '../controllers/draftComments.controller.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, fieldSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.split('.').pop().toLowerCase();
    const allowed = ['application/pdf', 'text/plain', 'text/markdown'];
    if (allowed.includes(file.mimetype) || ['pdf', 'txt', 'md'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, .txt, and .md files are accepted'));
    }
  }
});

router.get('/', draftCommentsController.listComments);
router.post('/', upload.single('file'), draftCommentsController.createComment);
router.put('/:id', draftCommentsController.updateComment);
router.delete('/:id', draftCommentsController.deleteComment);

export default router;
