import express from 'express';
import {
  listDocumentStyleTemplates,
  createDocumentStyleTemplate,
  updateDocumentStyleTemplate,
  deleteDocumentStyleTemplate,
} from '../controllers/documentStyleTemplates.controller.js';

const router = express.Router();

router.get('/',        listDocumentStyleTemplates);
router.post('/',       createDocumentStyleTemplate);
router.patch('/:id',   updateDocumentStyleTemplate);
router.delete('/:id',  deleteDocumentStyleTemplate);

export default router;
