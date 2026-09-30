import { readFileSync, writeFileSync, mkdirSync, renameSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  ActivityJSONSchema,
  ActivityIndexSchema,
  RejectionReasonSchema,
  type ActivityJSON,
  type RejectionReason,
} from "shared/types.js";
import { getMechanicSpec } from "../../mechanics/loader.js";
import { getConceptBrief } from "../../concepts/loader.js";
import { validateActivity } from "./validate.js";
import { STAGED_DIR } from "./stage.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ACTIVITIES_DIR = join(__dirname, "../../library/activities");
const REJECTED_DIR   = join(__dirname, "../../library/rejected");

export function approveActivity(activityId: string, approver: string): ActivityJSON {
  const namedApprover = approver.trim();
  if (!namedApprover || namedApprover === "pipeline-auto") throw new Error("A named human approver is required");
  if (!/^[A-Za-z0-9_-]+$/.test(activityId)) throw new Error("Invalid activity ID");
  mkdirSync(ACTIVITIES_DIR, { recursive: true });

  const stagedPath   = join(STAGED_DIR, `${activityId}.json`);
  const approvedPath = join(ACTIVITIES_DIR, `${activityId}.json`);

  const raw = readFileSync(stagedPath, "utf-8");
  const activity = ActivityJSONSchema.parse(JSON.parse(raw));
  if (activity.id !== activityId) throw new Error("Staged activity ID does not match its filename");
  const concept = getConceptBrief(activity.conceptId);
  if (!concept) throw new Error(`Unknown concept ID: ${activity.conceptId}`);

  // Inline the selected layout variant so the runtime is self-contained.
  const layoutId  = activity.parameters["layoutId"] as string | undefined;
  const mechSpec  = getMechanicSpec(activity.mechanicId);
  const layoutVariant = mechSpec?.layouts.find((l) => l.id === layoutId);

  const approved: ActivityJSON = {
    ...activity,
    parameters: {
      ...activity.parameters,
      ...(layoutVariant ? { layout: layoutVariant } : {}),
    },
    metadata: {
      ...activity.metadata,
      humanApprovedAt: new Date().toISOString(),
      humanApprover: namedApprover,
    },
  };

  const validation = validateActivity(approved, concept);
  if (!validation.passed) throw new Error(`Activity cannot be approved: ${validation.errors.join("; ")}`);

  writeFileSync(approvedPath, JSON.stringify(approved, null, 2) + "\n");
  renameSync(stagedPath, stagedPath.replace(".json", ".approved.json"));

  regenerateActivityIndex();

  console.log(`✓ Approved: library/activities/${activityId}.json`);
  return approved;
}

export function rejectActivity(
  activityId: string,
  stage: RejectionReason["stage"],
  reason: string
): RejectionReason {
  mkdirSync(REJECTED_DIR, { recursive: true });

  const stagedPath   = join(STAGED_DIR, `${activityId}.json`);
  const rejectedPath = join(REJECTED_DIR, `${activityId}.json`);

  const rejection: RejectionReason = RejectionReasonSchema.parse({
    stage,
    reason,
    details: { activityId },
    rejectedAt: new Date().toISOString(),
  });

  writeFileSync(rejectedPath, JSON.stringify(rejection, null, 2) + "\n");
  renameSync(stagedPath, stagedPath.replace(".json", ".rejected.json"));

  console.log(`✗ Rejected: library/rejected/${activityId}.json`);
  console.log(`  Reason: ${reason}`);
  return rejection;
}

export function buildApprovedIndex(
  candidates: unknown[],
  conceptLookup: (id: string) => ReturnType<typeof getConceptBrief> = getConceptBrief
) {
  const entries = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const parsed = ActivityJSONSchema.safeParse(candidate);
    if (!parsed.success) continue;
    const activity = parsed.data;
    const approval = activity.metadata;
    if (!approval.humanApprovedAt || !approval.humanApprover?.trim() || approval.humanApprover.trim() === "pipeline-auto") continue;
    const concept = conceptLookup(activity.conceptId);
    if (!/^[A-Za-z0-9_-]+$/.test(activity.id) || !concept) continue;
    if (seen.has(activity.id) || !validateActivity(activity, concept).passed) continue;
    seen.add(activity.id);
    entries.push({
      id: activity.id,
      conceptId: activity.conceptId,
      mechanicId: activity.mechanicId,
      prompt: activity.prompt.text,
      difficulty: activity.metadata.difficulty,
    });
  }
  return ActivityIndexSchema.parse({ activities: entries });
}

export function regenerateActivityIndex(
  activitiesDir = ACTIVITIES_DIR,
  conceptLookup: (id: string) => ReturnType<typeof getConceptBrief> = getConceptBrief
) {
  const files = readdirSync(activitiesDir)
    .filter((f) => f.endsWith(".json") && !f.endsWith(".approved.json") && f !== "index.json")
    .sort();

  const candidates: unknown[] = [];
  for (const file of files) {
    try {
      const raw = JSON.parse(readFileSync(join(activitiesDir, file), "utf-8"));
      if (raw.id === file.slice(0, -".json".length)) candidates.push(raw);
    } catch {
      // skip malformed files
    }
  }

  const index = buildApprovedIndex(candidates, conceptLookup);
  writeFileSync(
    join(activitiesDir, "index.json"),
    JSON.stringify(index, null, 2) + "\n"
  );
  console.log(`  index.json updated (${index.activities.length} activities)`);
}
