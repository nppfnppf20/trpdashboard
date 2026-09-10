import { getProviderStatus } from '../services/llm.shared.js';

/**
 * GET /api/llm-status
 * Per-provider credit/quota status, tracked centrally in llm.shared.js by
 * watching every response that passes through the shared Anthropic/OpenAI
 * clients. null means the provider is fine.
 */
export function getLlmStatus(req, res) {
  res.json(getProviderStatus());
}
