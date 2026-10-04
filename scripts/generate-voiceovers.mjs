#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = join(root, "library/activities/index.json");
const scriptPath = join(root, "library/assets/audio/voiceover-scripts.json");
const configPath = join(root, "library/assets/audio/voiceover.json");
const voice = "Tara";
const locale = "en_IN";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function validateInputs() {
  const index = readJson(indexPath);
  const authored = readJson(scriptPath);
  const config = readJson(configPath);
  const ids = index.activities.map(({ id }) => id);
  const scriptIds = Object.keys(authored.prompts ?? {});
  const packId = config.activePackId;

  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(packId ?? "")) {
    throw new Error(`Invalid active voice pack ID: ${String(packId)}`);
  }
  if (new Set(ids).size !== ids.length) throw new Error("Activity index contains duplicate IDs");
  const missing = ids.filter((id) => !Object.hasOwn(authored.prompts, id));
  const extra = scriptIds.filter((id) => !ids.includes(id));
  if (missing.length || extra.length) {
    throw new Error(`Voiceover script IDs do not match activity index; missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"}`);
  }
  for (const id of ids) {
    const text = authored.prompts[id];
    if (typeof text !== "string" || !text.trim()) throw new Error(`Missing spoken prompt text for ${id}`);
  }
  if (authored.completionText !== "Well done!") {
    throw new Error('Completion script must be exactly "Well done!"');
  }

  return { ids, prompts: authored.prompts, completionText: authored.completionText, packId };
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} failed (${result.status}): ${result.stderr || result.stdout}`);
  }
}

function renderClip(text, outputPath) {
  run("say", ["-v", voice, "-o", outputPath, "--data-format=alac", text]);
  if (statSync(outputPath).size <= 4096) throw new Error(`Voice output is empty: ${outputPath}`);
}

function generate() {
  const { ids, prompts, completionText, packId } = validateInputs();
  const packRoot = join(root, "library/assets/audio/voice-packs", packId);
  const promptRoot = join(packRoot, "prompts");
  mkdirSync(promptRoot, { recursive: true });

  const clips = [];
  for (const id of ids) {
    const relativePath = `audio/voice-packs/${packId}/prompts/${id}.m4a`;
    const outputPath = join(root, "library/assets", relativePath);
    renderClip(prompts[id], outputPath);
    clips.push({ kind: "prompt", activityId: id, text: prompts[id], path: relativePath });
  }

  const completionPath = `audio/voice-packs/${packId}/well-done.m4a`;
  renderClip(completionText, join(root, "library/assets", completionPath));
  clips.push({ kind: "completion", text: completionText, path: completionPath });

  const manifest = {
    packId,
    sourceVoice: { name: voice, locale, rate: "macOS say default" },
    generatedAt: new Date().toISOString(),
    generationTool: { speech: "macOS say --data-format=alac", container: "M4A/ALAC" },
    clips,
  };
  writeFileSync(join(packRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`Generated ${ids.length} prompt clips and one completion clip for ${packId}.\n`);
}

try {
  if (process.argv.includes("--dry-run")) {
    const { ids, packId } = validateInputs();
    process.stdout.write(`Validated ${ids.length} prompt scripts and completion text for ${packId}.\n`);
  } else if (process.argv.includes("--help")) {
    process.stdout.write("Usage: node scripts/generate-voiceovers.mjs [--dry-run]\n");
  } else {
    generate();
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
