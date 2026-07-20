/**
 * Find a Tender OCDS client.
 * Docs: https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages
 * No auth required. Above-threshold + (post Feb 2025) all-value UK notices.
 */

import { createOcdsClient } from './ocdsClient.js';

const FTS_BASE = 'https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages';

export const { fetchReleases } = createOcdsClient(FTS_BASE, 'FTS');
