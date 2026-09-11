import express from 'express';
import * as userProfilesController from '../controllers/userProfiles.controller.js';

const router = express.Router();

router.get('/', userProfilesController.getAllUserProfiles);
router.post('/me/sync', userProfilesController.syncMyProfile);

export default router;
