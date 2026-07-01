/** Default Claude model for new orgs and fallbacks. */
export const DEFAULT_AGENT_MODEL = "claude-haiku-4-5-20251001";

export const AGENT_MODEL_OPTIONS = [
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (recomendado)" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (mais rápido/barato)" },
] as const;

const DEPRECATED_MODEL_ALIASES: Record<string, string> = {
  "claude-sonnet-4-20250514": "claude-sonnet-4-6",
  "claude-sonnet-4-0": "claude-sonnet-4-6",
  "claude-opus-4-20250514": "claude-opus-4-8",
  "claude-opus-4-0": "claude-opus-4-8",
  "claude-haiku-3-5-20241022": "claude-haiku-4-5-20251001",
  "claude-3-haiku-20240307": "claude-haiku-4-5-20251001",
};

/** Maps retired model IDs stored in the DB to current Anthropic API IDs. */
export function resolveAgentModel(model: string | null | undefined): string {
  const trimmed = model?.trim();
  if (!trimmed) return DEFAULT_AGENT_MODEL;
  return DEPRECATED_MODEL_ALIASES[trimmed] ?? trimmed;
}
