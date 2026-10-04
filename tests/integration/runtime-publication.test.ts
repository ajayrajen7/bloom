import { describe, it, expect } from "vitest";
import { build } from "vite";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, mkdirSync, writeFileSync, symlinkSync, copyFileSync } from "fs";
import { tmpdir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { APPROVED_SPRITE_REFS } from "../../runtime/src/assets/sprite-registry.js";
import { collectRuntimeFiles, runtimeAssetResponse } from "../../runtime/publication.js";
import type { ConceptBrief } from "../../shared/types.js";
import { getLayoutVariant } from "../../mechanics/loader.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const runtimeRoot = join(root, "runtime");
const configFile = join(runtimeRoot, "vite.config.ts");
const pilotConcept: ConceptBrief = {
  id: "concept_001", mechanicId: "drag-to-target", targetDivisionId: "fine_motor.pincer_grip",
  ageMonths: { min: 24, max: 36 }, difficulty: "low", targetDurationSeconds: 40,
  itemSprites: ["apple-red-v1.png", "banana-v1.png", "orange-v1.png"], targetSprites: [],
};
const pilotConceptLookup = (id: string) => id === pilotConcept.id ? pilotConcept : undefined;

function createLibraryFixture() {
  const libraryDir = mkdtempSync(join(tmpdir(), "bloom-allowlist-"));
  mkdirSync(join(libraryDir, "activities"));
  mkdirSync(join(libraryDir, "themes"));
  mkdirSync(join(libraryDir, "assets/sprites"), { recursive: true });
  copyFileSync(join(root, "library/themes/kitchen-v1.json"), join(libraryDir, "themes/kitchen-v1.json"));
  const manifestPath = join(libraryDir, "assets/manifest.json");
  copyFileSync(join(root, "library/assets/manifest.json"), manifestPath);
  for (const ref of APPROVED_SPRITE_REFS) {
    symlinkSync(join(root, "library/assets", ref), join(libraryDir, "assets", ref));
  }

  const activity = {
    id: "approved_pilot", conceptId: "concept_001", mechanicId: "drag-to-target", themeId: "kitchen-v1",
    generatedAt: "2026-09-29T00:00:00.000Z",
    filledSlots: {
      items: [
        { id: "apple", targetId: "fruit", assetRef: "sprites/apple-red-v1.png" },
        { id: "banana", targetId: "fruit", assetRef: "sprites/banana-v1.png" },
        { id: "orange", targetId: "fruit", assetRef: "sprites/orange-v1.png" },
      ],
      targets: [{ id: "fruit", label: "Fruit" }], distractors: [],
    },
    parameters: { layoutId: "horizontal-standard", layout: getLayoutVariant("drag-to-target", "horizontal-standard"), itemCount: 3, distractorCount: 0 },
    prompt: { text: "Put fruit here!", audioRef: "audio/prompts/PLACEHOLDER.mp3" },
    audioRefs: { successSfx: "audio/sfx/success_bright.mp3", errorSfx: "audio/sfx/try_again.mp3", completionSfx: "audio/sfx/celebration.mp3" },
    metadata: { targetDivisionId: "fine_motor.pincer_grip", ageMonths: { min: 24, max: 36 }, difficulty: "low", targetDurationSeconds: 40, reviewScore: 0.95, reviewerNotes: "Reviewed", humanApprovedAt: "2026-09-29T00:00:00.000Z", humanApprover: "ajay" },
  };
  writeFileSync(join(libraryDir, "activities/approved_pilot.json"), JSON.stringify(activity));
  writeFileSync(join(libraryDir, "activities/index.json"), JSON.stringify({ activities: [
    { id: activity.id, conceptId: activity.conceptId, mechanicId: activity.mechanicId, prompt: activity.prompt.text, difficulty: activity.metadata.difficulty },
  ] }));

  const activePackId = "fixture-v1";
  const packDir = join(libraryDir, "assets/audio/voice-packs", activePackId);
  const promptPath = join(packDir, "prompts/approved_pilot.m4a");
  const completionPath = join(packDir, "well-done.m4a");
  mkdirSync(dirname(promptPath), { recursive: true });
  writeFileSync(join(libraryDir, "assets/audio/voiceover.json"), JSON.stringify({ activePackId }));
  writeFileSync(join(libraryDir, "assets/audio/voiceover-scripts.json"), JSON.stringify({
    completionText: "Well done!",
    prompts: { approved_pilot: "Put three fruits on their matching pictures." },
  }));
  writeFileSync(promptPath, Buffer.from("fixture prompt audio"));
  writeFileSync(completionPath, Buffer.from("fixture completion audio"));
  const inactive = join(libraryDir, "assets/audio/voice-packs/unused/prompts/unused.m4a");
  mkdirSync(dirname(inactive), { recursive: true });
  writeFileSync(inactive, Buffer.from("inactive voice pack"));

  return { libraryDir, activity, manifestPath, promptPath, completionPath, inactive };
}

describe("runtime publication boundary", () => {
  it("includes a referenced theme only for a valid human-approved indexed activity", () => {
    const { libraryDir, activity, manifestPath } = createLibraryFixture();
    try {
      expect(() => collectRuntimeFiles(libraryDir)).toThrow("outside the concept");
      const files = collectRuntimeFiles(libraryDir, pilotConceptLookup);
      expect([...files.keys()]).toContain("/themes/kitchen-v1.json");
      expect([...files.keys()]).toContain("/activities/approved_pilot.json");
      expect([...files.keys()]).not.toContain("/assets/manifest.json");
      rmSync(manifestPath);
      expect(() => collectRuntimeFiles(libraryDir, pilotConceptLookup)).toThrow("manifest");
      copyFileSync(join(root, "library/assets/manifest.json"), manifestPath);
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      const apple = manifest.find((entry: { file: string }) => entry.file === "sprites/apple-red-v1.png");
      apple.manualReview.decision = "pending";
      writeFileSync(manifestPath, JSON.stringify(manifest));
      expect(() => collectRuntimeFiles(libraryDir, pilotConceptLookup)).toThrow("approved");
      copyFileSync(join(root, "library/assets/manifest.json"), manifestPath);
      const variantManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      variantManifest.find((entry: { id: string }) => entry.id === "style-anchor-apple-v1").manualReview.decision = "pending";
      writeFileSync(manifestPath, JSON.stringify(variantManifest));
      expect(() => collectRuntimeFiles(libraryDir, pilotConceptLookup)).toThrow("approved canonical");
      copyFileSync(join(root, "library/assets/manifest.json"), manifestPath);
      const theme = JSON.parse(readFileSync(join(libraryDir, "themes/kitchen-v1.json"), "utf8"));
      theme.decorationAssetRefs = ["decorations/star-v1.png"];
      writeFileSync(join(libraryDir, "themes/kitchen-v1.json"), JSON.stringify(theme));
      expect(() => collectRuntimeFiles(libraryDir, pilotConceptLookup)).toThrow("theme artwork");
      copyFileSync(join(root, "library/themes/kitchen-v1.json"), join(libraryDir, "themes/kitchen-v1.json"));
      writeFileSync(join(libraryDir, "activities/approved_pilot.json"), JSON.stringify({ ...activity, metadata: { ...activity.metadata, humanApprover: "pipeline-auto" } }));
      expect(() => collectRuntimeFiles(libraryDir, pilotConceptLookup)).toThrow("no explicit human approval");
      writeFileSync(join(libraryDir, "activities/approved_pilot.json"), JSON.stringify({ ...activity, conceptId: "missing_concept" }));
      writeFileSync(join(libraryDir, "activities/index.json"), JSON.stringify({ activities: [
        { id: activity.id, conceptId: "missing_concept", mechanicId: activity.mechanicId, prompt: activity.prompt.text, difficulty: activity.metadata.difficulty },
      ] }));
      expect(() => collectRuntimeFiles(libraryDir, pilotConceptLookup)).toThrow("Unknown concept ID");
    } finally {
      rmSync(libraryDir, { recursive: true, force: true });
    }
  });

  it("publication exposes only a complete selected voice pack", () => {
    const ids = JSON.parse(readFileSync(join(root, "library/activities/index.json"), "utf8")).activities.map(
      (entry: { id: string }) => entry.id
    );
    const files = collectRuntimeFiles();
    const expectedAudioPaths = [
      ...ids.map((id: string) => `/assets/audio/voice-packs/pilot-v1/prompts/${id}.m4a`),
      "/assets/audio/voice-packs/pilot-v1/well-done.m4a",
    ];

    for (const path of expectedAudioPaths) expect(files.has(path), path).toBe(true);
    expect([...files.keys()].filter((path) => path.includes("/voice-packs/")).sort()).toEqual(expectedAudioPaths.sort());
    expect(files.has("/library/assets/audio/voiceover-scripts.json")).toBe(false);
    expect(files.has("/assets/audio/voice-packs/pilot-v1/manifest.json")).toBe(false);
    const runtimeConfig = files.get("/voiceover.json");
    expect(Buffer.isBuffer(runtimeConfig)).toBe(true);
    if (!Buffer.isBuffer(runtimeConfig)) return;
    const config = JSON.parse(runtimeConfig.toString("utf8"));
    expect(config.activePackId).toBe("pilot-v1");
    expect(config.promptPathPattern).toBe("/assets/audio/voice-packs/{packId}/prompts/{activityId}.m4a");
    expect(config.completionPathPattern).toBe("/assets/audio/voice-packs/{packId}/well-done.m4a");
    expect(Object.keys(config.promptScripts).sort()).toEqual(ids.sort());
  });

  it("publication does not include a different voice pack", () => {
    const fixture = createLibraryFixture();
    try {
      const files = collectRuntimeFiles(fixture.libraryDir, pilotConceptLookup);
      expect(files.has("/assets/audio/voice-packs/fixture-v1/prompts/approved_pilot.m4a")).toBe(true);
      expect(files.has("/assets/audio/voice-packs/fixture-v1/well-done.m4a")).toBe(true);
      expect([...files.keys()].some((path) => path.includes("/voice-packs/unused/"))).toBe(false);
      expect(files.has("/assets/audio/voice-packs/unused/prompts/unused.m4a")).toBe(false);
    } finally {
      rmSync(fixture.libraryDir, { recursive: true, force: true });
    }
  });

  it("publication rejects incomplete or unsafe voice pack configuration", () => {
    const fixture = createLibraryFixture();
    const configPath = join(fixture.libraryDir, "assets/audio/voiceover.json");
    const writeConfig = (activePackId: string) => writeFileSync(configPath, JSON.stringify({ activePackId }));
    try {
      writeConfig("../outside");
      expect(() => collectRuntimeFiles(fixture.libraryDir, pilotConceptLookup)).toThrow("Invalid active voice pack ID");

      writeConfig("PLACEHOLDER.mp3");
      expect(() => collectRuntimeFiles(fixture.libraryDir, pilotConceptLookup)).toThrow("Invalid active voice pack ID");

      writeConfig("fixture-v1");
      rmSync(fixture.promptPath);
      expect(() => collectRuntimeFiles(fixture.libraryDir, pilotConceptLookup)).toThrow("approved_pilot.m4a");

      writeFileSync(fixture.promptPath, Buffer.alloc(0));
      expect(() => collectRuntimeFiles(fixture.libraryDir, pilotConceptLookup)).toThrow("approved_pilot.m4a");

      writeFileSync(fixture.promptPath, Buffer.from("fixture prompt audio"));
      rmSync(fixture.completionPath);
      expect(() => collectRuntimeFiles(fixture.libraryDir, pilotConceptLookup)).toThrow("well-done.m4a");
    } finally {
      rmSync(fixture.libraryDir, { recursive: true, force: true });
    }
  });

  it("publication serves selected narration with audio/mp4", () => {
    const promptPath = "/assets/audio/voice-packs/pilot-v1/prompts/act_pilot_kitchen_tap_v1.m4a";
    const completionPath = "/assets/audio/voice-packs/pilot-v1/well-done.m4a";
    expect(runtimeAssetResponse(promptPath)?.contentType).toBe("audio/mp4");
    expect(runtimeAssetResponse(completionPath)?.contentType).toBe("audio/mp4");
  });

  it("builds only the active index and registered runtime assets", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "bloom-runtime-publication-"));
    try {
      await build({ configFile, root: runtimeRoot, logLevel: "silent", build: { outDir, emptyOutDir: true } });
      const index = JSON.parse(readFileSync(join(outDir, "activities/index.json"), "utf8"));
      const sourceIndex = JSON.parse(readFileSync(join(root, "library/activities/index.json"), "utf8"));
      expect(index.activities).toEqual(sourceIndex.activities);
      expect(index.activities).toHaveLength(17);
      for (const entry of index.activities.filter((item: { id: string }) => item.id.startsWith("act_kitchen_"))) {
        expect(existsSync(join(outDir, "activities", `${entry.id}.json`))).toBe(true);
      }
      for (const ref of APPROVED_SPRITE_REFS) expect(existsSync(join(outDir, "assets", ref))).toBe(true);
      expect(existsSync(join(outDir, "assets/manifest.json"))).toBe(false);
      expect(existsSync(join(outDir, "assets/staging"))).toBe(false);
      expect(existsSync(join(outDir, "assets/reviews"))).toBe(false);
      expect(readdirSync(join(outDir, "themes"))).toEqual(["kitchen-v1.json"]);
      expect(existsSync(join(outDir, "staged"))).toBe(false);
      expect(existsSync(join(outDir, "rejected"))).toBe(false);
      expect(readdirSync(join(outDir, "activities")).sort()).toEqual([
        ...index.activities.map((entry: { id: string }) => `${entry.id}.json`),
        "index.json",
      ].sort());
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  }, 30_000);

  it("dev middleware rejects direct authoring URLs", () => {
    for (const path of ["/assets/manifest.json", "/assets/staging/", "/staged/", "/rejected/", "/library/assets/manifest.json", "/activities/act_dev_001.json"]) {
      expect(runtimeAssetResponse(path)?.status, path).toBe(404);
    }
    expect(runtimeAssetResponse("/activities/index.json")?.status).toBe(200);
    expect(runtimeAssetResponse("/assets/sprites/apple-red-v1.png")?.status).toBe(200);
    expect(runtimeAssetResponse(`/@fs/${join(root, "library/assets/manifest.json")}`)?.status).toBe(404);
  });

  it("serves validated staged activities in dev while denying production routes", () => {
    const id = "act_task1_publication_fixture";
    const staged = join(root, "library/staged", `${id}.json`);
    mkdirSync(dirname(staged), { recursive: true });
    if (existsSync(staged)) throw new Error(`Refusing to overwrite staged fixture: ${staged}`);
    const activity = JSON.parse(readFileSync(join(root, "library/activities/act_pilot_kitchen_drag_v1.json"), "utf8"));
    writeFileSync(staged, JSON.stringify({ ...activity, id }));
    try {
      expect(runtimeAssetResponse(`/staged/${id}.json`, join(root, "library"), true)?.status).toBe(200);
      expect(runtimeAssetResponse(`/staged/${id}.json`)?.status).toBe(404);
      expect(runtimeAssetResponse("/staged/../activities/index.json", join(root, "library"), true)?.status).toBe(404);
      expect(runtimeAssetResponse("/staged/unknown.json", join(root, "library"), true)?.status).toBe(404);
      expect([...collectRuntimeFiles().keys()].some(path => path.startsWith("/staged/"))).toBe(false);
    } finally { rmSync(staged); }
  });
});
