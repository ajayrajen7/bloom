import { describe, it, expect, beforeEach } from "vitest";
import {
  getDivisionsForAge,
  getDivisionById,
  listDivisions,
  _resetCache,
} from "./loader.js";

beforeEach(() => _resetCache());

describe("listDivisions", () => {
  it("returns all 3 V1 divisions", () => {
    const divisions = listDivisions();
    expect(divisions).toHaveLength(3);
  });

  it("includes all expected division ids", () => {
    const ids = listDivisions().map((d) => d.id);
    expect(ids).toContain("fine_motor.pincer_grip");
    expect(ids).toContain("cognitive.visual_discrimination");
    expect(ids).toContain("language.receptive_language");
  });
});

describe("getDivisionsForAge", () => {
  it("returns divisions valid for 30 months", () => {
    const divisions = getDivisionsForAge(30);
    expect(divisions.length).toBeGreaterThan(0);
    divisions.forEach((d) => {
      expect(d.ageRangeMonths[0]).toBeLessThanOrEqual(30);
      expect(d.ageRangeMonths[1]).toBeGreaterThanOrEqual(30);
    });
  });

  it("returns all 3 divisions for 30 months (all cover 24-36 band)", () => {
    expect(getDivisionsForAge(30)).toHaveLength(3);
  });

  it("returns empty array for age outside all ranges (e.g. 6 months)", () => {
    expect(getDivisionsForAge(6)).toHaveLength(0);
  });

  it("returns divisions at the exact lower bound", () => {
    // fine_motor.pincer_grip starts at 18 months
    const at18 = getDivisionsForAge(18);
    expect(at18.some((d) => d.id === "fine_motor.pincer_grip")).toBe(true);
  });
});

describe("getDivisionById", () => {
  it("returns the correct division", () => {
    const d = getDivisionById("fine_motor.pincer_grip");
    expect(d?.name).toBe("Pincer Grip / Finger Isolation");
    expect(d?.domain).toBe("fine_motor");
  });

  it("returns undefined for unknown id", () => {
    expect(getDivisionById("does_not_exist")).toBeUndefined();
  });

  it("returned division has all required fields", () => {
    const d = getDivisionById("cognitive.visual_discrimination");
    expect(d?.description.length).toBeGreaterThan(10);
    expect(d?.designPrinciples.length).toBeGreaterThan(0);
    expect(d?.relatedMilestones.length).toBeGreaterThan(0);
  });
});
