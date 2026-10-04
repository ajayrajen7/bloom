export interface RuntimeVoiceoverConfig {
  activePackId: string;
  promptScripts: Record<string, string>;
  promptPathPattern: string;
  completionPathPattern: string;
}

const SAFE_ID = /^[a-z0-9][a-z0-9_-]{0,127}$/i;
const SAFE_PACK_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const PROMPT_PATTERN = "/assets/audio/voice-packs/{packId}/prompts/{activityId}.m4a";
const COMPLETION_PATTERN = "/assets/audio/voice-packs/{packId}/well-done.m4a";

function assertPackId(packId: string) {
  if (!SAFE_PACK_ID.test(packId)) throw new Error("Invalid voice pack ID");
}

export function promptAudioUrl(packId: string, activityId: string): string {
  assertPackId(packId);
  if (!SAFE_ID.test(activityId)) throw new Error("Invalid activity ID for voiceover");
  return PROMPT_PATTERN.replace("{packId}", packId).replace("{activityId}", activityId);
}

export function completionAudioUrl(packId: string): string {
  assertPackId(packId);
  return COMPLETION_PATTERN.replace("{packId}", packId);
}

export function parseRuntimeVoiceoverConfig(value: unknown): RuntimeVoiceoverConfig {
  if (!value || typeof value !== "object") throw new Error("Invalid voiceover configuration");
  const config = value as Partial<RuntimeVoiceoverConfig>;
  const valid = typeof config.activePackId === "string"
    && SAFE_PACK_ID.test(config.activePackId)
    && !!config.promptScripts
    && typeof config.promptScripts === "object"
    && !Array.isArray(config.promptScripts)
    && Object.entries(config.promptScripts).every(([id, text]) => SAFE_ID.test(id) && typeof text === "string" && !!text.trim())
    && config.promptPathPattern === PROMPT_PATTERN
    && config.completionPathPattern === COMPLETION_PATTERN;
  if (!valid) throw new Error("Invalid voiceover configuration");
  return value as RuntimeVoiceoverConfig;
}

export async function loadRuntimeVoiceoverConfig(fetcher: typeof fetch = fetch): Promise<RuntimeVoiceoverConfig> {
  const response = await fetcher("/voiceover.json");
  if (!response.ok) throw new Error("Could not load voiceover configuration");
  const data: unknown = await response.json();
  return parseRuntimeVoiceoverConfig(data);
}
