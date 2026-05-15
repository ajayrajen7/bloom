import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { ActivityJSON } from "shared/types.js";
import type { LLMReviewResult } from "./llm-review.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STAGED_DIR = join(__dirname, "../../library/staged");
const REVIEW_UI_DIR = join(__dirname, "../review-ui/staged");

export interface StagedActivity {
  activityPath: string;
  previewPath: string;
}

export function stageActivity(
  activity: ActivityJSON,
  reviewResult: LLMReviewResult
): StagedActivity {
  mkdirSync(STAGED_DIR, { recursive: true });
  mkdirSync(REVIEW_UI_DIR, { recursive: true });

  const activityPath = join(STAGED_DIR, `${activity.id}.json`);
  writeFileSync(activityPath, JSON.stringify(activity, null, 2) + "\n");

  const previewPath = join(REVIEW_UI_DIR, `${activity.id}.html`);
  writeFileSync(previewPath, buildPreviewHTML(activity, reviewResult));

  return { activityPath, previewPath };
}

function buildPreviewHTML(activity: ActivityJSON, review: LLMReviewResult): string {
  const items   = (activity.filledSlots["items"]   ?? []) as Array<{ id: string; label: string; targetId: string }>;
  const targets = (activity.filledSlots["targets"] ?? []) as Array<{ id: string; label: string }>;

  const scoreColor = review.response.score >= 0.85
    ? "#22c55e"
    : review.response.score >= 0.70
    ? "#f59e0b"
    : "#ef4444";

  const itemsHTML = items
    .map(
      (item) => `
      <div class="item">
        <span class="label">${item.label}</span>
        <span class="arrow">→</span>
        <span class="target">${targets.find((t) => t.id === item.targetId)?.label ?? item.targetId}</span>
      </div>`
    )
    .join("");

  const dimensionRows = Object.entries(review.response.dimensionScores)
    .map(
      ([key, val]) =>
        `<tr><td>${camelToLabel(key)}</td><td>${val}/25</td></tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Review: ${activity.id}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 900px; margin: 40px auto; padding: 0 24px; background: #0f0f1a; color: #e2e8f0; }
    h1 { color: #a78bfa; font-size: 1.4rem; margin-bottom: 4px; }
    h2 { color: #94a3b8; font-size: 1rem; text-transform: uppercase; letter-spacing: .08em; margin: 32px 0 12px; }
    .meta { color: #64748b; font-size: 0.85rem; margin-bottom: 32px; }
    .score-badge { display: inline-block; padding: 6px 16px; border-radius: 99px; background: ${scoreColor}22; color: ${scoreColor}; font-weight: 700; font-size: 1.6rem; border: 2px solid ${scoreColor}; }
    .verdict { font-size: 1.1rem; margin: 12px 0; }
    .notes { background: #1e1e30; padding: 16px; border-radius: 8px; line-height: 1.6; }
    .reject-reason { background: #3f1515; border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 0 8px 8px 0; color: #fca5a5; }
    .item { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid #1e1e30; }
    .label { background: #1e1e30; padding: 4px 10px; border-radius: 6px; font-weight: 600; }
    .target { background: #162032; padding: 4px 10px; border-radius: 6px; color: #7dd3fc; }
    .arrow { color: #475569; }
    .prompt-text { font-size: 1.3rem; color: #f1f5f9; background: #1e1e30; padding: 16px; border-radius: 8px; border-left: 4px solid #a78bfa; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 8px 12px; border-bottom: 1px solid #1e1e30; }
    td:last-child { text-align: right; font-weight: 600; }
    .json-block { background: #0a0a14; padding: 16px; border-radius: 8px; overflow-x: auto; font-family: monospace; font-size: 0.78rem; line-height: 1.5; white-space: pre; color: #94a3b8; max-height: 400px; overflow-y: auto; }
    .actions { display: flex; gap: 12px; margin: 32px 0; }
    .btn { padding: 12px 28px; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; border: none; }
    .btn-approve { background: #22c55e; color: #fff; }
    .btn-reject  { background: #ef4444; color: #fff; }
    .btn-regen   { background: #f59e0b; color: #fff; }
  </style>
</head>
<body>

  <h1>Activity Review: ${activity.id}</h1>
  <div class="meta">Concept: ${activity.conceptId} · Mechanic: ${activity.mechanicId} · Difficulty: ${activity.metadata.difficulty} · Generated: ${activity.generatedAt}</div>

  <h2>LLM Review Score</h2>
  <div class="score-badge">${(review.response.score * 100).toFixed(0)} / 100</div>
  <div class="verdict">${review.response.passed ? "✅ Passed threshold (≥85)" : "❌ Below threshold (<85)"}</div>
  <div class="notes">${review.response.notes}</div>
  ${review.response.rejectReason ? `<div class="reject-reason">Reject reason: ${review.response.rejectReason}</div>` : ""}

  <h2>Dimension Scores</h2>
  <table>${dimensionRows}</table>

  <h2>Prompt</h2>
  <div class="prompt-text">"${activity.prompt.text}"</div>

  <h2>Items → Targets</h2>
  ${itemsHTML}

  <h2>Approve / Reject</h2>
  <p style="color:#64748b;font-size:.85rem">Run <code>pnpm review</code> in the terminal to approve or reject interactively.</p>
  <div class="actions">
    <button class="btn btn-approve" onclick="alert('Run: pnpm review')">✓ Approve</button>
    <button class="btn btn-reject"  onclick="alert('Run: pnpm review')">✗ Reject</button>
    <button class="btn btn-regen"   onclick="alert('Run: pnpm review')">↺ Regenerate</button>
  </div>

  <h2>Full Activity JSON</h2>
  <div class="json-block">${JSON.stringify(activity, null, 2).replace(/</g, "&lt;")}</div>

</body>
</html>`;
}

function camelToLabel(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
}

export { STAGED_DIR, REVIEW_UI_DIR };
export function stagedActivityExists(activityId: string): boolean {
  return existsSync(join(STAGED_DIR, `${activityId}.json`));
}
