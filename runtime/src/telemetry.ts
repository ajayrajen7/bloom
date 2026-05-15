import type { SessionRecord } from "shared/types.js";

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const SESSIONS_KEY = "bloom_sessions_v1";

export function buildSessionRecord(
  sessionId: string,
  activityId: string,
  startedAt: string,
  outcome: "completed" | "abandoned",
  parentRating?: "loved" | "fine" | "bailed"
): SessionRecord {
  const endedAt = new Date().toISOString();
  const durationSeconds = Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 1000);
  return {
    sessionId,
    activityId,
    startedAt,
    endedAt,
    outcome,
    durationSeconds,
    parentRating,
    events: [],
  };
}

export function appendSession(record: SessionRecord, storage: KeyValueStorage): void {
  const raw = storage.getItem(SESSIONS_KEY);
  const sessions: SessionRecord[] = raw ? (JSON.parse(raw) as SessionRecord[]) : [];
  sessions.push(record);
  storage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function getSessions(storage: KeyValueStorage): SessionRecord[] {
  const raw = storage.getItem(SESSIONS_KEY);
  return raw ? (JSON.parse(raw) as SessionRecord[]) : [];
}
