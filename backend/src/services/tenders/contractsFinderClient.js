/**
 * Contracts Finder OCDS client.
 * Docs: https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search
 * No auth required. Carries lower-value and below-threshold notices that don't
 * appear on Find a Tender, plus historic notices from before Find a Tender existed.
 */

import { createOcdsClient } from './ocdsClient.js';

const CONTRACTS_FINDER_BASE = 'https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search';

export const { fetchReleases } = createOcdsClient(CONTRACTS_FINDER_BASE, 'Contracts Finder');
