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

describe("runtime publication boundary", () => {
  it("includes a referenced theme only for a valid human-approved indexed activity", () => {
    const libraryDir = mkdtempSync(join(tmpdir(), "bloom-allowlist-"));
    try {
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
