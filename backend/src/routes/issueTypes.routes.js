import express from 'express';
import {
  listIssueTypes,
  createIssueType,
  updateIssueType,
  deleteIssueType,
} from '../controllers/issueTypes.controller.js';

const router = express.Router();

router.get('/', listIssueTypes);
router.post('/', createIssueType);
router.patch('/:id', updateIssueType);
router.delete('/:id', deleteIssueType);

export default router;
