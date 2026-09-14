import express from 'express';
import * as emailTonesController from '../controllers/emailTones.controller.js';

const router = express.Router();

router.get('/', emailTonesController.listTones);
router.post('/', emailTonesController.createTone);
router.put('/:id', emailTonesController.updateTone);
router.delete('/:id', emailTonesController.deleteTone);

export default router;
