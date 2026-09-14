import express from 'express';
import * as draftCommentsController from '../controllers/draftComments.controller.js';

const router = express.Router();

router.get('/', draftCommentsController.listComments);
router.post('/', draftCommentsController.createComment);
router.put('/:id', draftCommentsController.updateComment);
router.delete('/:id', draftCommentsController.deleteComment);

export default router;
