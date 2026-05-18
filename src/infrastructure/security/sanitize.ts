const PROMPT_INJECTION_PATTERNS = [
  /ignore (all |previous |above )?instructions/i,
  /disregard (all |previous |above )?instructions/i,
  /forget (all |previous |above )?instructions/i,
  /you are now/i,
  /new (system |base )?instructions/i,
  /override (system |base )?prompt/i,
];

/**
 * Sanitizes user-provided knowledge base text.
 * Strips potentially dangerous patterns without being overly aggressive.
 */
export function sanitizeKnowledgeBase(input: string): string {
  let result = input;
  result = result.replace(/\x00/g, "");
  result = result.replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  return result.trim();
}

/**
 * Checks if a user message contains known prompt injection patterns.
 * Returns true if suspicious — used for logging/alerting, not blocking.
 */
export function detectPromptInjection(message: string): boolean {
  return PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Sanitizes system prompt input from the dashboard.
 */
export function sanitizeSystemPrompt(input: string): string {
  let result = input;
  result = result.replace(/\x00/g, "");
  result = result.replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  return result.trim();
}
