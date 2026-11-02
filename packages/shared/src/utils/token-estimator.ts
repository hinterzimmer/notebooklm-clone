/**
 * Default configuration parameters.
 * Note: EMBEDDING_DIMENSIONS (1024 for halfvec) and MAX_CHUNK_TOKENS (default 1024)
 * are separate, independent parameters.
 */
export const DEFAULT_MAX_CHUNK_TOKENS = 1024;
export const DEFAULT_EMBEDDING_DIMENSIONS = 1024;
export const DEFAULT_TOKEN_SAFETY_BUFFER_PERCENT = 0.15; // 15% safety buffer

/**
 * Naive token estimator using statistical word & punctuation ratio.
 * In English/Latin prose and Markdown, 1 token is ~3.5 - 4 characters or ~0.75 words.
 * In code/tables/garbled OCR, token-to-character ratio can be higher.
 */
export function estimateTokens(text: string): number {
  if (!text || text.length === 0) {
    return 0;
  }

  // Count words and punctuation/whitespace segments
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const charEstimate = Math.ceil(text.length / 3.8);
  const wordEstimate = Math.ceil(words * 1.33);

  // Take the safer (higher) estimate to avoid exceeding LLM context windows
  return Math.max(charEstimate, wordEstimate);
}

/**
 * Checks if a text block fits within token limits with a safety buffer applied.
 * Formula: estimated_tokens * (1 + errorRateBuffer) <= maxTokens
 */
export function fitsWithinTokenLimit(
  text: string,
  maxTokens: number = DEFAULT_MAX_CHUNK_TOKENS,
  errorRateBuffer: number = DEFAULT_TOKEN_SAFETY_BUFFER_PERCENT,
): boolean {
  const tokens = estimateTokens(text);
  const bufferedTokens = tokens * (1 + errorRateBuffer);
  return bufferedTokens <= maxTokens;
}

/**
 * Calculates how many safe characters can fit inside maxTokens.
 */
export function maxSafeCharLength(
  maxTokens: number = DEFAULT_MAX_CHUNK_TOKENS,
  errorRateBuffer: number = DEFAULT_TOKEN_SAFETY_BUFFER_PERCENT,
): number {
  const safeTokens = maxTokens / (1 + errorRateBuffer);
  return Math.floor(safeTokens * 3.5);
}
