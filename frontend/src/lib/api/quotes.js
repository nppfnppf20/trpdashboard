/**
 * Quotes API Client
 * Frontend API methods for quote management
 */

import { authFetch } from './client.js';

const API_BASE_URL = '/api/admin-console';

export async function getQuotes(filters = {}) {
  const params = new URLSearchParams();
  if (filters.projectId) params.append('projectId', filters.projectId);
  if (filters.instructionStatus) params.append('instructionStatus', filters.instructionStatus);
  if (filters.workStatus) params.append('workStatus', filters.workStatus);
  const queryString = params.toString();
  const url = `${API_BASE_URL}/quotes${queryString ? `?${queryString}` : ''}`;
  const response = await authFetch(url);
  if (!response.ok) throw new Error('Failed to fetch quotes');
  return await response.json();
}

export async function getQuoteById(id) {
  const response = await authFetch(`${API_BASE_URL}/quotes/${id}`);
  if (!response.ok) throw new Error('Failed to fetch quote');
  return await response.json();
}

export async function getProjectsWithStats() {
  const response = await authFetch(`${API_BASE_URL}/quotes/projects/with-stats`);
  if (!response.ok) throw new Error('Failed to fetch projects with stats');
  return await response.json();
}

export async function getQuoteKeyDates(projectId) {
  const response = await authFetch(`${API_BASE_URL}/quotes/projects/${projectId}/quote-key-dates`);
  if (!response.ok) throw new Error('Failed to fetch quote key dates');
  return await response.json();
}

export async function getProgrammeEvents(projectId) {
  const response = await authFetch(`${API_BASE_URL}/quotes/projects/${projectId}/programme-events`);
  if (!response.ok) throw new Error('Failed to fetch programme events');
  return await response.json();
}

export async function createQuote(quoteData) {
  const response = await authFetch(`${API_BASE_URL}/quotes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(quoteData)
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create quote');
  }
  return await response.json();
}

export async function updateQuoteInstructionStatus(quoteId, instructionStatus, selectedLineItems = null) {
  const response = await authFetch(`${API_BASE_URL}/quotes/${quoteId}/instruction-status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instruction_status: instructionStatus, selectedLineItems })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update instruction status');
  }
  return await response.json();
}

export async function updateQuoteNotes(quoteId, notes) {
  const response = await authFetch(`${API_BASE_URL}/quotes/${quoteId}/notes`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quote_notes: notes })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update quote notes');
  }
  return await response.json();
}

export async function deleteQuote(quoteId) {
  const response = await authFetch(`${API_BASE_URL}/quotes/${quoteId}`, { method: 'DELETE' });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete quote');
  }
  return await response.json();
}

export async function updateQuote(quoteId, quoteData) {
  const response = await authFetch(`${API_BASE_URL}/quotes/${quoteId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(quoteData)
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update quote');
  }
  return await response.json();
}

export async function updateQuoteWorkStatus(quoteId, workStatus) {
  const response = await authFetch(`${API_BASE_URL}/quotes/${quoteId}/work-status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ work_status: workStatus })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update work status');
  }
  return await response.json();
}

export async function updateQuoteDependencies(quoteId, dependencies) {
  const response = await authFetch(`${API_BASE_URL}/quotes/${quoteId}/dependencies`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dependencies })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update dependencies');
  }
  return await response.json();
}

export async function updateQuoteOperationalNotes(quoteId, operationalNotes) {
  const response = await authFetch(`${API_BASE_URL}/quotes/${quoteId}/operational-notes`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operational_notes: operationalNotes })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update operational notes');
  }
  return await response.json();
}

export async function updateQuoteReview(quoteId, reviewData) {
  const response = await authFetch(`${API_BASE_URL}/quotes/${quoteId}/review`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reviewData)
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update quote review');
  }
  return await response.json();
}

// Programme Events CRUD
export async function createProgrammeEvent(projectId, data) {
  const response = await authFetch(`${API_BASE_URL}/quotes/projects/${projectId}/programme-events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create programme event');
  }
  return await response.json();
}

export async function updateProgrammeEvent(eventId, data) {
  const response = await authFetch(`${API_BASE_URL}/quotes/programme-events/${eventId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update programme event');
  }
  return await response.json();
}

export async function deleteProgrammeEvent(eventId) {
  const response = await authFetch(`${API_BASE_URL}/quotes/programme-events/${eventId}`, {
    method: 'DELETE'
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete programme event');
  }
  return await response.json();
}

// Quote Key Dates CRUD
export async function createQuoteKeyDate(quoteId, data) {
  const response = await authFetch(`${API_BASE_URL}/quotes/${quoteId}/key-dates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create quote key date');
  }
  return await response.json();
}

export async function updateQuoteKeyDate(keyDateId, data) {
  const response = await authFetch(`${API_BASE_URL}/quotes/key-dates/${keyDateId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update quote key date');
  }
  return await response.json();
}

export async function deleteQuoteKeyDate(keyDateId) {
  const response = await authFetch(`${API_BASE_URL}/quotes/key-dates/${keyDateId}`, {
    method: 'DELETE'
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete quote key date');
  }
  return await response.json();
}
