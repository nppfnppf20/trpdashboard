import express from 'express';
import * as userProfilesController from '../controllers/userProfiles.controller.js';

const router = express.Router();

router.get('/', userProfilesController.getAllUserProfiles);
router.post('/me/sync', userProfilesController.syncMyProfile);
router.get('/:id/projects', userProfilesController.getProjectsForUser);
router.get('/:id/actions', userProfilesController.getMeetingActionsForUser);

export default router;
