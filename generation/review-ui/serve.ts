#!/usr/bin/env tsx
/**
 * Manual review CLI.
 * Usage: pnpm review
 *
 * Lists all staged activities, opens their preview HTML, and prompts
 * approve / reject / regenerate for each.
 */

import { readdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createInterface } from "readline";
import { execSync } from "child_process";
import { approveActivity, rejectActivity } from "../pipeline/store.js";
import { STAGED_DIR, REVIEW_UI_DIR } from "../pipeline/stage.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
void __dirname;

const rl = createInterface({ input: process.stdin, output: process.stdout });

function ask(q: string): Promise<string> {
  return new Promise((resolve) => rl.question(q, (a) => resolve(a.trim().toLowerCase())));
}

function openFile(path: string) {
  try {
    execSync(`open "${path}"`, { stdio: "ignore" });
  } catch {
    console.log(`  (Could not auto-open. Open manually: ${path})`);
  }
}

async function main() {
  if (!existsSync(STAGED_DIR)) {
    console.log("No staged activities found. Run  pnpm generate <concept-id>  first.");
    process.exit(0);
  }

  const stagedFiles = readdirSync(STAGED_DIR).filter((f) => f.endsWith(".json"));
  if (stagedFiles.length === 0) {
    console.log("No staged activities pending review.");
    process.exit(0);
  }

  console.log(`\n── Manual Review: ${stagedFiles.length} activity/activities staged ──\n`);

  for (const file of stagedFiles) {
    const activityId = file.replace(".json", "");
    const previewPath = join(REVIEW_UI_DIR, `${activityId}.html`);

    console.log(`\nActivity: ${activityId}`);

    if (existsSync(previewPath)) {
      console.log(`Opening preview: ${previewPath}`);
      openFile(previewPath);
    } else {
      console.log(`  (No preview found for ${activityId})`);
    }

    const decision = await ask("\nDecision — [a]pprove / [r]eject / [s]kip: ");

    if (decision === "a" || decision === "approve") {
      approveActivity(activityId, "ajay");
    } else if (decision === "r" || decision === "reject") {
      const reason = await ask("Rejection reason (be specific): ");
      rejectActivity(activityId, "manual_review", reason);
      console.log("  → Add this as an eval case: pnpm eval:add");
    } else {
      console.log("  Skipped.");
    }
  }

  console.log("\n── Review complete ──\n");
  rl.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
