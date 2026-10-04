import express from 'express';
import { createUpload } from '../middleware/upload.js';
import * as draftCommentsController from '../controllers/draftComments.controller.js';

const router = express.Router();

const upload = createUpload({ exts: ['pdf', 'txt', 'md'], fieldSizeMB: 10 });

router.get('/', draftCommentsController.listComments);
router.post('/', upload.single('file'), draftCommentsController.createComment);
router.put('/:id', draftCommentsController.updateComment);
router.delete('/:id', draftCommentsController.deleteComment);

export default router;
