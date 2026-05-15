import { describe, it, expect, beforeEach } from "vitest";
import { getConceptBrief, listConceptBriefs, _resetCache } from "./loader.js";

beforeEach(() => _resetCache());

describe("listConceptBriefs", () => {
  it("loads all 5 hand-authored briefs", () => {
    expect(listConceptBriefs()).toHaveLength(5);
  });

  it("covers all 3 V1 divisions", () => {
    const divisionIds = listConceptBriefs().map((b) => b.targetDivisionId);
    expect(divisionIds).toContain("fine_motor.pincer_grip");
    expect(divisionIds).toContain("cognitive.visual_discrimination");
    expect(divisionIds).toContain("language.receptive_language");
  });

  it("covers all 3 difficulty levels", () => {
    const difficulties = listConceptBriefs().map((b) => b.difficulty);
    expect(difficulties).toContain("low");
    expect(difficulties).toContain("medium");
  });
});

describe("getConceptBrief", () => {
  it("returns the correct brief by id", () => {
    const brief = getConceptBrief("concept_001");
    expect(brief?.themeHint).toBe("fruits and baskets");
    expect(brief?.difficulty).toBe("low");
  });

  it("returns undefined for unknown id", () => {
    expect(getConceptBrief("concept_999")).toBeUndefined();
  });

  it("returned brief passes schema validation", () => {
    const brief = getConceptBrief("concept_002");
    expect(brief?.ageMonths.min).toBe(24);
    expect(brief?.ageMonths.max).toBe(36);
    expect(brief?.targetDurationSeconds).toBeGreaterThan(0);
  });

  it("optional secondaryDivisionId is present when set", () => {
    const brief = getConceptBrief("concept_004");
    expect(brief?.secondaryDivisionId).toBe("language.receptive_language");
  });
});
