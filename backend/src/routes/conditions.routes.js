import express from 'express';
import {
  feeQuoteWorks,
  getConditionsData,
  createCondition,
  updateCondition,
  deleteCondition,
  createRequirement,
  updateRequirement,
  deleteRequirement,
  createAdvancements,
  suggestAdvancements,
  advancementsSummaryEmail,
  updateAdvancement,
  deleteAdvancement,
  listProjectQuotes,
  linkConditionQuote,
  unlinkConditionQuote,
  markExported,
  markIssuedToClient,
} from '../controllers/conditions.controller.js';

const router = express.Router();

router.get('/projects/:projectId', getConditionsData);
router.post('/projects/:projectId/conditions', createCondition);
router.post('/projects/:projectId/export', markExported);
router.post('/projects/:projectId/issue-to-client', markIssuedToClient);
router.put('/conditions/:conditionId', updateCondition);
router.delete('/conditions/:conditionId', deleteCondition);
router.post('/conditions/:conditionId/requirements', createRequirement);
router.put('/requirements/:requirementId', updateRequirement);
router.delete('/requirements/:requirementId', deleteRequirement);
router.post('/projects/:projectId/advancements', createAdvancements);
router.post('/projects/:projectId/advancements/suggest', suggestAdvancements);
router.post('/projects/:projectId/advancements/summary-email', advancementsSummaryEmail);
router.post('/projects/:projectId/fee-quote-works', feeQuoteWorks);
router.put('/advancements/:advancementId', updateAdvancement);
router.delete('/advancements/:advancementId', deleteAdvancement);
router.get('/projects/:projectId/quotes', listProjectQuotes);
router.post('/conditions/:conditionId/quote-links', linkConditionQuote);
router.delete('/conditions/:conditionId/quote-links/:quoteId', unlinkConditionQuote);

export default router;
