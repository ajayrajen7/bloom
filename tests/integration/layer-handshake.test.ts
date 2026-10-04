/**
 * Integration test: Framework → Concept → Mechanics three-layer handshake.
 *
 * Verifies that a ConceptBrief's targetDivisionId resolves in the Framework,
 * and that the mechanic implied by the concept exists in the Mechanics layer.
 * This is the cross-layer contract test required by BLOOM_V1_ARCHITECTURE.md.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { getDivisionById, _resetCache as resetFramework } from "../../framework/loader.js";
import { getConceptBrief, listConceptBriefs, _resetCache as resetConcepts } from "../../concepts/loader.js";
import { getMechanicSpec, listMechanicSpecs, _resetCache as resetMechanics } from "../../mechanics/loader.js";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { ActivityIndexSchema, ActivityJSONSchema } from "../../shared/types.js";
import { validateActivity } from "../../generation/pipeline/validate.js";

const activitiesDir = join(dirname(fileURLToPath(import.meta.url)), "../../library/activities");

beforeEach(() => {
  resetFramework();
  resetConcepts();
  resetMechanics();
});

describe("Framework → Concept handshake", () => {
  it("every ConceptBrief targetDivisionId resolves in the Framework", () => {
    const briefs = listConceptBriefs();
    expect(briefs.length).toBeGreaterThan(0);

    for (const brief of briefs) {
      const division = getDivisionById(brief.targetDivisionId);
      expect(
        division,
        `Brief ${brief.id} references unknown division: ${brief.targetDivisionId}`
      ).toBeDefined();
    }
  });

  it("every optional secondaryDivisionId also resolves in the Framework", () => {
    const briefs = listConceptBriefs().filter((b) => b.secondaryDivisionId);
    for (const brief of briefs) {
      const division = getDivisionById(brief.secondaryDivisionId!);
      expect(
        division,
        `Brief ${brief.id} secondary division not found: ${brief.secondaryDivisionId}`
      ).toBeDefined();
    }
  });

  it("concept_001 targets fine_motor.pincer_grip with correct age band", () => {
    const brief = getConceptBrief("concept_001");
    const division = getDivisionById(brief!.targetDivisionId);
    expect(division?.id).toBe("fine_motor.pincer_grip");
    expect(brief!.ageMonths.min).toBeGreaterThanOrEqual(division!.ageRangeMonths[0]);
    expect(brief!.ageMonths.max).toBeLessThanOrEqual(division!.ageRangeMonths[1]);
  });
});

describe("Mechanics layer integrity", () => {
  it("both V1 mechanics load with slotSchema and parameterSchema", () => {
    for (const spec of listMechanicSpecs()) {
      expect(spec.slotSchema, `${spec.id} missing slotSchema`).toBeDefined();
      expect(spec.parameterSchema, `${spec.id} missing parameterSchema`).toBeDefined();
      expect(spec.deviceCompatibility).toContain("ipad");
    }
  });

  it("drag-to-target and tap-to-select are both present", () => {
    expect(getMechanicSpec("drag-to-target")).toBeDefined();
    expect(getMechanicSpec("tap-to-select")).toBeDefined();
  });
});

describe("Full three-layer lookup", () => {
  it("concept_001 → division → mechanic spec all resolve", () => {
    const brief = getConceptBrief("concept_001");
    expect(brief).toBeDefined();

    const division = getDivisionById(brief!.targetDivisionId);
    expect(division).toBeDefined();
    expect(division!.designPrinciples.length).toBeGreaterThan(0);

    // concept_001 targets drag-to-target (pincer grip)
    const spec = getMechanicSpec("drag-to-target");
    expect(spec).toBeDefined();
    expect(spec!.id).toBe("drag-to-target");
  });
});

describe("active activity publication handshake", () => {
  it("indexes only valid activities with explicit human approval and excludes legacy files", () => {
    const index = ActivityIndexSchema.parse(JSON.parse(readFileSync(join(activitiesDir, "index.json"), "utf8")));
    const indexedIds = new Set(index.activities.map((entry) => entry.id));
    const legacyIds: string[] = [];
    for (const file of readdirSync(activitiesDir).filter((name) => name.endsWith(".json") && name !== "index.json")) {
      const raw = JSON.parse(readFileSync(join(activitiesDir, file), "utf8"));
      if (!ActivityJSONSchema.safeParse(raw).success) {
        legacyIds.push(raw.id);
        expect(indexedIds.has(raw.id)).toBe(false);
        continue;
      }
      if (!indexedIds.has(raw.id)) continue;
      expect(index.activities.find((entry) => entry.id === raw.id)?.themeId).toBe(raw.themeId);
      expect(raw.metadata.humanApprovedAt).toBeTruthy();
      expect(raw.metadata.humanApprover).toBeTruthy();
      expect(raw.metadata.humanApprover).not.toBe("pipeline-auto");
      expect(validateActivity(raw).passed).toBe(true);
    }
    expect(legacyIds.length).toBeGreaterThan(0);
  });
});
