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
import { STAGED_DIR } from "./stage.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ACTIVITIES_DIR = join(__dirname, "../../library/activities");
const REJECTED_DIR   = join(__dirname, "../../library/rejected");

export function approveActivityDirect(activity: ActivityJSON): ActivityJSON {
  mkdirSync(ACTIVITIES_DIR, { recursive: true });

  const approvedPath = join(ACTIVITIES_DIR, `${activity.id}.json`);

  const layoutId = activity.parameters["layoutId"] as string | undefined;
  const mechSpec = getMechanicSpec(activity.mechanicId);
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
      humanApprover: "pipeline-auto",
    },
  };

  writeFileSync(approvedPath, JSON.stringify(approved, null, 2) + "\n");
  regenerateActivityIndex();

  console.log(`✓ Auto-approved: library/activities/${activity.id}.json`);
  return approved;
}

export function approveActivity(activityId: string, approver: string): ActivityJSON {
  mkdirSync(ACTIVITIES_DIR, { recursive: true });

  const stagedPath   = join(STAGED_DIR, `${activityId}.json`);
  const approvedPath = join(ACTIVITIES_DIR, `${activityId}.json`);

  const raw = readFileSync(stagedPath, "utf-8");
  const activity = ActivityJSONSchema.parse(JSON.parse(raw));

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
      humanApprover: approver,
    },
  };

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

// Logs a Gate 1 (validate) or Gate 2 (llm_review) failure directly, without
// requiring a prior stageActivity() call — the auto-approve pipeline
// (generate-cli.ts) never stages, so there's no staged file to rename. This
// restores the CLAUDE.md invariant that every rejection, at every gate, is
// logged to library/rejected/ with a structured reason, even though Gate 3
// (manual review) is currently bypassed. Details carry the full failing
// activity/errors so a rejection can become an eval case without re-running
// the generation call.
export function rejectActivityDirect(
  stage: RejectionReason["stage"],
  reason: string,
  details: Record<string, unknown>
): RejectionReason {
  mkdirSync(REJECTED_DIR, { recursive: true });

  const activityId = (details["activityId"] as string | undefined) ?? `rejected_${Date.now()}`;
  const rejectedPath = join(REJECTED_DIR, `${activityId}.json`);

  const rejection: RejectionReason = RejectionReasonSchema.parse({
    stage,
    reason,
    details,
    rejectedAt: new Date().toISOString(),
  });

  writeFileSync(rejectedPath, JSON.stringify(rejection, null, 2) + "\n");

  console.log(`✗ Rejected: library/rejected/${activityId}.json`);
  console.log(`  Reason: ${reason}`);
  return rejection;
}

function regenerateActivityIndex() {
  const files = readdirSync(ACTIVITIES_DIR)
    .filter((f) => f.endsWith(".json") && !f.endsWith(".approved.json") && f !== "index.json")
    .sort();

  const entries = [];
  for (const file of files) {
    try {
      const raw = JSON.parse(readFileSync(join(ACTIVITIES_DIR, file), "utf-8"));
      const activity = ActivityJSONSchema.parse(raw);
      entries.push({
        id:         activity.id,
        conceptId:  activity.conceptId,
        mechanicId: activity.mechanicId,
        prompt:     activity.prompt.text,
        difficulty: activity.metadata.difficulty,
      });
    } catch {
      // skip malformed files
    }
  }

  const index = ActivityIndexSchema.parse({ activities: entries });
  writeFileSync(
    join(ACTIVITIES_DIR, "index.json"),
    JSON.stringify(index, null, 2) + "\n"
  );
  console.log(`  index.json updated (${entries.length} activities)`);
}
