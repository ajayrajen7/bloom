/**
 * Integration tests for M4 telemetry module.
 * Uses injectable storage — no jsdom needed, runs in Node.
 */

import { describe, it, expect } from "vitest";
import {
  buildSessionRecord,
  appendSession,
  getSessions,
  type KeyValueStorage,
} from "../../runtime/src/telemetry.js";

function makeStorage(): KeyValueStorage {
  const store: Record<string, string> = {};
  return {
    getItem:  (k) => store[k] ?? null,
    setItem:  (k, v) => { store[k] = v; },
  };
}

describe("buildSessionRecord", () => {
  it("sets all required fields", () => {
    const r = buildSessionRecord("s1", "act_dev_001", "2026-05-08T10:00:00.000Z", "completed", "loved");
    expect(r.sessionId).toBe("s1");
    expect(r.activityId).toBe("act_dev_001");
    expect(r.outcome).toBe("completed");
    expect(r.parentRating).toBe("loved");
    expect(r.events).toEqual([]);
    expect(typeof r.durationSeconds).toBe("number");
    expect(r.durationSeconds).toBeGreaterThanOrEqual(0);
  });

  it("durationSeconds is non-negative even for same-second calls", () => {
    const r = buildSessionRecord("s1", "act_dev_001", new Date().toISOString(), "completed");
    expect(r.durationSeconds).toBeGreaterThanOrEqual(0);
  });

  it("parentRating is absent when not provided", () => {
    const r = buildSessionRecord("s1", "act_dev_001", "2026-05-08T10:00:00.000Z", "abandoned");
    expect(r.parentRating).toBeUndefined();
    expect(r.outcome).toBe("abandoned");
  });
});

describe("getSessions", () => {
  it("returns empty array from fresh storage", () => {
    expect(getSessions(makeStorage())).toEqual([]);
  });
});

describe("appendSession", () => {
  it("stores a record and retrieves it", () => {
    const s = makeStorage();
    const r = buildSessionRecord("s1", "act_dev_001", "2026-05-08T10:00:00.000Z", "completed", "loved");
    appendSession(r, s);
    const sessions = getSessions(s);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].sessionId).toBe("s1");
    expect(sessions[0].parentRating).toBe("loved");
  });

  it("accumulates multiple sessions in order", () => {
    const s = makeStorage();
    appendSession(buildSessionRecord("s1", "act_dev_001", "2026-05-08T10:00:00.000Z", "completed", "loved"), s);
    appendSession(buildSessionRecord("s2", "act_dev_001", "2026-05-08T10:01:00.000Z", "completed", "fine"), s);
    appendSession(buildSessionRecord("s3", "act_dev_001", "2026-05-08T10:02:00.000Z", "abandoned"), s);
    const sessions = getSessions(s);
    expect(sessions).toHaveLength(3);
    expect(sessions[0].sessionId).toBe("s1");
    expect(sessions[1].parentRating).toBe("fine");
    expect(sessions[2].outcome).toBe("abandoned");
  });

  it("persists across multiple getSessions calls", () => {
    const s = makeStorage();
    appendSession(buildSessionRecord("s1", "act_dev_001", "2026-05-08T10:00:00.000Z", "completed"), s);
    expect(getSessions(s)).toHaveLength(1);
    expect(getSessions(s)).toHaveLength(1); // idempotent read
  });
});
