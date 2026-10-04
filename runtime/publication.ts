import { existsSync, readFileSync, statSync } from "fs";
import { join, resolve, sep, dirname } from "path";
import { fileURLToPath } from "url";
import type { IncomingMessage, ServerResponse } from "http";
import type { Plugin } from "vite";
import { ActivityIndexSchema, ActivityJSONSchema, ThemeSpecSchema } from "../shared/types.js";
import { validateActivity } from "../generation/pipeline/validate.js";
import { getConceptBrief, _resetCache } from "../concepts/loader.js";
import { APPROVED_SPRITE_REFS } from "./src/assets/sprite-registry.js";
import { approvedRuntimeVisualRefs } from "../generation/assets/approved-runtime.js";
import { requireSupportedThemeArtwork } from "../shared/theme-catalog.js";

const LIBRARY_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../library");
const SAFE_ACTIVITY_ID = /^[A-Za-z0-9_-]+$/;
const SAFE_VOICE_PACK_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const PROMPT_AUDIO_PATH_PATTERN = "/assets/audio/voice-packs/{packId}/prompts/{activityId}.m4a";
const COMPLETION_AUDIO_PATH_PATTERN = "/assets/audio/voice-packs/{packId}/well-done.m4a";

interface RuntimeVoiceoverConfig {
  activePackId: string;
  promptScripts: Record<string, string>;
  promptPathPattern: string;
  completionPathPattern: string;
}

/** URL path to its reviewed source file. Never walks the library tree. */
export function collectRuntimeFiles(
  libraryDir = LIBRARY_DIR,
  conceptLookup: (id: string) => ReturnType<typeof getConceptBrief> = getConceptBrief
): Map<string, string | Buffer> {
  const files = new Map<string, string | Buffer>();
  const assetsDir = join(libraryDir, "assets");
  const approvedRefs = approvedRuntimeVisualRefs(assetsDir);
  const indexPath = join(libraryDir, "activities/index.json");
  const index = ActivityIndexSchema.parse(JSON.parse(readFileSync(indexPath, "utf8")));
  files.set("/activities/index.json", indexPath);

  const voiceoverRoot = join(assetsDir, "audio");
  const voiceoverConfigPath = join(voiceoverRoot, "voiceover.json");
  if (!existsSync(voiceoverConfigPath)) throw new Error("Voiceover configuration missing: assets/audio/voiceover.json");
  const voiceoverConfig = JSON.parse(readFileSync(voiceoverConfigPath, "utf8")) as { activePackId?: unknown };
  const activePackId = voiceoverConfig.activePackId;
  if (typeof activePackId !== "string" || !SAFE_VOICE_PACK_ID.test(activePackId)) {
    throw new Error(`Invalid active voice pack ID: ${String(activePackId)}`);
  }

  const scriptsPath = join(voiceoverRoot, "voiceover-scripts.json");
  if (!existsSync(scriptsPath)) throw new Error("Voiceover scripts missing: assets/audio/voiceover-scripts.json");
  const authoredScripts = JSON.parse(readFileSync(scriptsPath, "utf8")) as {
    completionText?: unknown;
    prompts?: unknown;
  };
  const promptScripts = authoredScripts.prompts;
  if (!promptScripts || typeof promptScripts !== "object" || Array.isArray(promptScripts)) {
    throw new Error("Voiceover prompt scripts must be a map keyed by activity ID");
  }
  if (authoredScripts.completionText !== "Well done!") {
    throw new Error('Voiceover completion script must be exactly "Well done!"');
  }
  const indexedIds = index.activities.map(({ id }) => id);
  const promptIds = Object.keys(promptScripts);
  const missingPromptScripts = indexedIds.filter((id) => !Object.hasOwn(promptScripts, id));
  const extraPromptScripts = promptIds.filter((id) => !indexedIds.includes(id));
  if (missingPromptScripts.length || extraPromptScripts.length) {
    throw new Error(`Voiceover script IDs do not match activity index; missing: ${missingPromptScripts.join(", ") || "none"}; extra: ${extraPromptScripts.join(", ") || "none"}`);
  }
  for (const id of indexedIds) {
    const text = (promptScripts as Record<string, unknown>)[id];
    if (typeof text !== "string" || !text.trim()) throw new Error(`Voiceover prompt text missing: ${id}`);
  }

  const packRoot = join(voiceoverRoot, "voice-packs", activePackId);
  const completionAsset = join(packRoot, "well-done.m4a");
  if (!existsSync(completionAsset) || statSync(completionAsset).size === 0) {
    throw new Error(`Voiceover completion audio missing or empty: audio/voice-packs/${activePackId}/well-done.m4a`);
  }
  files.set(`/assets/audio/voice-packs/${activePackId}/well-done.m4a`, completionAsset);
  for (const id of indexedIds) {
    if (!SAFE_ACTIVITY_ID.test(id)) throw new Error(`Unsafe indexed activity ID for voiceover: ${id}`);
    const relativePath = `audio/voice-packs/${activePackId}/prompts/${id}.m4a`;
    const source = join(assetsDir, relativePath);
    if (!existsSync(source) || statSync(source).size === 0) throw new Error(`Voiceover prompt audio missing or empty: ${relativePath}`);
    files.set(`/assets/${relativePath}`, source);
  }

  const runtimeVoiceoverConfig: RuntimeVoiceoverConfig = {
    activePackId,
    promptScripts: promptScripts as Record<string, string>,
    promptPathPattern: PROMPT_AUDIO_PATH_PATTERN,
    completionPathPattern: COMPLETION_AUDIO_PATH_PATTERN,
  };
  files.set("/voiceover.json", Buffer.from(`${JSON.stringify(runtimeVoiceoverConfig, null, 2)}\n`));

  for (const entry of index.activities) {
    if (!SAFE_ACTIVITY_ID.test(entry.id)) throw new Error(`Unsafe indexed activity ID: ${entry.id}`);
    const activityPath = join(libraryDir, "activities", `${entry.id}.json`);
    const activity = ActivityJSONSchema.parse(JSON.parse(readFileSync(activityPath, "utf8")));
    if (activity.id !== entry.id || activity.conceptId !== entry.conceptId ||
        activity.mechanicId !== entry.mechanicId || activity.prompt.text !== entry.prompt ||
        activity.metadata.difficulty !== entry.difficulty) {
      throw new Error(`Indexed activity metadata mismatch: ${entry.id}`);
    }
    if (!activity.metadata.humanApprovedAt || !activity.metadata.humanApprover?.trim() ||
        activity.metadata.humanApprover.trim() === "pipeline-auto") {
      throw new Error(`Indexed activity has no explicit human approval: ${entry.id}`);
    }
    const concept = conceptLookup(activity.conceptId);
    if (!concept) throw new Error(`Unknown concept ID: ${activity.conceptId}`);
    const validation = validateActivity(activity, concept, assetsDir);
    if (!validation.passed) throw new Error(`Indexed activity invalid: ${entry.id}: ${validation.errors.join("; ")}`);
    files.set(`/activities/${entry.id}.json`, activityPath);

    const themePath = join(libraryDir, "themes", `${activity.themeId}.json`);
    const theme = ThemeSpecSchema.parse(JSON.parse(readFileSync(themePath, "utf8")));
    if (theme.id !== activity.themeId) throw new Error(`Theme file ID mismatch: ${activity.themeId}`);
    requireSupportedThemeArtwork(theme);
    files.set(`/themes/${activity.themeId}.json`, themePath);
  }

  for (const ref of APPROVED_SPRITE_REFS) {
    const source = join(libraryDir, "assets", ref);
    if (!existsSync(source)) throw new Error(`Registered sprite missing: ${ref}`);
    if (!approvedRefs.has(ref)) throw new Error(`Registered sprite lacks an approved canonical manifest record: ${ref}`);
    files.set(`/assets/${ref}`, source);
  }
  return files;
}

export function runtimeAssetResponse(pathname: string, libraryDir = LIBRARY_DIR, allowStaged = false):
  { status: number; contentType?: string; body?: Buffer } | undefined {
  let path: string;
  try { path = decodeURIComponent(pathname); } catch { return { status: 404 }; }

  // Vite's module graph imports the known theme JSON from outside runtime/.
  // Block every other direct /@fs library read, including authoring files.
  if (path.startsWith("/@fs/")) {
    const source = path.slice("/@fs".length).replace(/^\/+/, "/");
    const libraryPrefix = resolve(libraryDir) + sep;
    if (source.startsWith(libraryPrefix)) {
      const relative = source.slice(libraryPrefix.length);
      if (relative === "themes/kitchen-v1.json") return undefined;
      return { status: 404 };
    }
    return undefined;
  }

  if (path === "/library" || path.startsWith("/library/")) return { status: 404 };
  if (path.startsWith("/staged/")) {
    if (!allowStaged) return { status: 404 };
    const match = /^\/staged\/([A-Za-z0-9_-]+)\.json$/.exec(path);
    if (!match) return { status: 404 };
    const id = match[1]!;
    const source = join(libraryDir, "staged", `${id}.json`);
    if (!existsSync(source)) return { status: 404 };
    try {
      const parsed = ActivityJSONSchema.safeParse(JSON.parse(readFileSync(source, "utf8")));
      if (!parsed.success || parsed.data.id !== id) return { status: 404 };
      // New staged concepts may be authored while the dev server remains open.
      _resetCache();
      const concept = getConceptBrief(parsed.data.conceptId);
      if (!concept || !validateActivity(parsed.data, concept, join(libraryDir, "assets")).passed) return { status: 404 };
      return { status: 200, contentType: "application/json; charset=utf-8", body: readFileSync(source) };
    } catch { return { status: 404 }; }
  }
  if (path !== "/voiceover.json" && !/^\/(activities|assets|themes|staged|rejected)(\/|$)/.test(path)) return undefined;
  const source = collectRuntimeFiles(libraryDir).get(path);
  if (!source) return { status: 404 };
  return {
    status: 200,
    contentType: path.endsWith(".png") ? "image/png" : path.endsWith(".m4a") ? "audio/mp4" : "application/json; charset=utf-8",
    body: Buffer.isBuffer(source) ? source : readFileSync(source),
  };
}

function serveRuntimeAsset(req: IncomingMessage, res: ServerResponse, next: () => void, allowStaged = false): void {
  const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
  try {
    const response = runtimeAssetResponse(pathname, LIBRARY_DIR, allowStaged);
    if (!response) return next();
    res.statusCode = response.status;
    if (response.contentType) res.setHeader("Content-Type", response.contentType);
    res.end(req.method === "HEAD" ? undefined : response.body);
  } catch (error) {
    res.statusCode = 500;
    res.end((error as Error).message);
  }
}

export function runtimePublicationPlugin(): Plugin {
  return {
    name: "bloom-runtime-publication",
    configureServer(server) { server.middlewares.use((req, res, next) => serveRuntimeAsset(req, res, next, true)); },
    configurePreviewServer(server) { server.middlewares.use((req, res, next) => serveRuntimeAsset(req, res, next, false)); },
    generateBundle() {
      for (const [url, source] of collectRuntimeFiles()) {
        this.emitFile({ type: "asset", fileName: url.slice(1), source: Buffer.isBuffer(source) ? source : readFileSync(source) });
      }
    },
  };
}
