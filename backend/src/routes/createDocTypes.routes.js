import express from 'express';
import {
  listCreateDocTypes,
  createCreateDocType,
  updateCreateDocType,
  deleteCreateDocType,
} from '../controllers/createDocTypes.controller.js';

const router = express.Router();

router.get('/',        listCreateDocTypes);
router.post('/',       createCreateDocType);
router.patch('/:id',   updateCreateDocType);
router.delete('/:id',  deleteCreateDocType);

export default router;
