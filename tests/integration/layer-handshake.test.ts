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
