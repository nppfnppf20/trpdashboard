import express from 'express';
import {
  triggerSync,
  triggerBackfill,
  triggerClassify,
  listNotices,
  getNoticeStats,
  listSyncRuns,
  updateNotice,
  getUnmatchedBuyers,
  matchBuyer,
  listAuthorities,
  getFilterRules,
  createFilterRule,
  deleteFilterRule,
  updateLlmPrompt,
} from '../controllers/tenders.controller.js';

const router = express.Router();

router.post('/sync', triggerSync);
router.post('/backfill', triggerBackfill);
router.post('/classify', triggerClassify);

router.get('/', listNotices);
router.get('/stats', getNoticeStats);
router.get('/runs', listSyncRuns);
router.get('/authorities', listAuthorities);
router.get('/unmatched-buyers', getUnmatchedBuyers);
router.post('/match-buyer', matchBuyer);

router.get('/filter-rules', getFilterRules);
router.post('/filter-rules', createFilterRule);
router.put('/filter-rules/llm-prompt', updateLlmPrompt);
router.delete('/filter-rules/:id', deleteFilterRule);

router.patch('/:id', updateNotice);

export default router;
