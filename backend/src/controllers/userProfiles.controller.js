import * as userProfilesService from '../services/userProfiles.service.js';

export async function getAllUserProfiles(req, res) {
  try {
    const profiles = await userProfilesService.getAllUserProfiles();
    res.json(profiles);
  } catch (error) {
    console.error('Error fetching user profiles:', error);
    res.status(500).json({ error: 'Failed to fetch user profiles', details: error.message });
  }
}

export async function getProjectsForUser(req, res) {
  try {
    const projects = await userProfilesService.getProjectsForUser(req.params.id);
    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects for user:', error);
    res.status(500).json({ error: 'Failed to fetch projects for user', details: error.message });
  }
}

export async function syncMyProfile(req, res) {
  try {
    const fallbackDisplayName = req.user.user_metadata?.full_name || req.user.email;
    const avatarUrl = req.user.user_metadata?.avatar_url || null;
    const profile = await userProfilesService.upsertUserProfile({
      id: req.user.id,
      email: req.user.email,
      fallbackDisplayName,
      avatarUrl
    });
    res.json(profile);
  } catch (error) {
    console.error('Error syncing user profile:', error);
    res.status(500).json({ error: 'Failed to sync user profile', details: error.message });
  }
}
