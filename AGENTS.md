# Bloom — restart checkpoint

**Last updated:** 2026-09-30
**Active project checkout:** `/private/tmp/bloom-doc-review-source`
**Branch:** `codex/fix-activity-switch-feedback`
**GitHub:** PR #2 is merged. Ajay authorized the PR/push workflow; GitHub CLI is authenticated. The activity-switch and completion-flow follow-up is being prepared on this branch.

## Project objective and current direction

Bloom is being restarted to test two things: whether AI can produce a consistent visual asset library, and whether activities built with those assets and mechanics are enjoyable to the child. The immediate scope is fruit and vegetable sprites, then two mechanics and a manual activity experience. ChatGPT image generation is the chosen provider; do not add Recraft or another provider/account workflow. Every generated asset is manually reviewed; deterministic checks provide evidence and do not replace that review.

## Mandatory reading at the start of every session

Before making a recommendation, plan, or change in a new Bloom session, verify that the active checkout contains this file and the project documents. Read these sources in order; do not rely on a prior-session summary as a substitute:

1. `BLOOM_VISION.md` — enduring product purpose.
2. `bloom-v1.1-mvp-spec.md` — current experiment scope, sequence, and exclusions.
3. `BLOOM_V1_ARCHITECTURE_CANONICAL.md` and `BLOOM_V1_ARCHITECTURE_CANONICAL.mermaid` — system boundaries and flow.
4. The current design spec and implementation plan for the task; verify each document's status before treating it as approved. Read relevant interface/contracts from `BLOOM_V1_IMPLEMENTATION.md` only where needed.
5. This checkpoint and the relevant asset/review records when the task touches generated assets.

`BLOOM_V1_PRD.md` is a pointer to the restart spec and vision. Treat `BLOOM_V1_ARCHITECTURE.md` and `BLOOM_V1_IMPLEMENTATION.md` as historical where they conflict with current sources. Before substantive work, tell Ajay which documents were read and identify any conflict that affects the task. An explicit later user decision can supersede an older document, but record the decision and reconcile the current spec/architecture before implementation. If the expected docs are missing from the active checkout, locate the correct project checkout before proceeding.

The asset-library design spec is `docs/superpowers/specs/2026-09-27-fruit-vegetable-asset-library-design.md`; its implementation record is `docs/superpowers/plans/2026-09-27-fruit-vegetable-asset-library.md`. The approved activity/theme contract is `docs/superpowers/specs/2026-09-28-activity-theme-contract-design.md` (approved 2026-09-28); the implementation plan at `docs/superpowers/plans/2026-09-28-activity-theme-implementation.md` was approved for delegated execution on 2026-09-29. Existing unusable activities are out of scope; do not migrate or preserve them.

## Completed work

- Built the manifest schema, PNG alpha/framing validator, contact-sheet workflow, style anchor/prompt contract, controlled banana/carrot text-only versus style-anchor comparison, eight canonical fruit/vegetable objects, and one green-apple color variant.
- Ajay approved the visible candidates. Nine approved sprites are in `library/assets/sprites/`; two visually approved text-only comparison controls remain in staging because the PNG validator detects opaque corner pixels and edge-touching subjects.
- See `library/assets/manifest.json`, `library/assets/reviews/chatgpt-pilot-001.json`, `library/assets/reviews/chatgpt-pilot-002.json`, `library/assets/reviews/chatgpt-pilot-summary.md`, and `library/assets/reviews/contact-sheet.html` for provenance, decisions, results, and previews.
- Current branch verification on 2026-09-30: `pnpm test` passed 277/277; root and runtime TypeScript checks passed; `pnpm build` succeeded and emitted 17 activities (two pilots plus 15 approved activities); `git diff --check` passed. The production build excludes staged sources, review previews, and the authoring asset manifest. Vite reports a >500 kB JavaScript chunk warning.
- The 15 additional Kitchen produce activities have been individually tested in the runtime and approved by Ajay on 2026-09-30 for the one-child iPad pilot. They are stored directly under `library/activities/` and indexed alongside the two initial pilots. Child enjoyment and learning efficacy remain untested until observations are recorded.
- For the pilot, do not ask for in-app parent feedback after completion. Show the existing brief celebration, record completion without a parent rating, and return automatically to the activity list. Parent observations stay outside the app.

## Agreed architecture direction for the next phase

Ajay approved this layered model as the design direction on 2026-09-28:

- **Concept:** captures age range, skill/experience goal, and difficulty; it provides the learning/activity intent.
- **Mechanic:** defines the interaction pattern (the confirmed pilot pair is `tap-to-select` and `drag-to-target`) and receives resolved activity data.
- **Theme:** supplies a reusable setting and visual treatment, such as a picnic or kitchen environment.
- **Asset catalog/storage:** provides approved object sprites, variants, and setting artwork with stable references and provenance.
- **Activity composition:** combines a concept, mechanic, theme, and selected assets into one activity definition.
- **Runtime:** reads the activity definition, loads the theme/assets, renders the scene, runs the mechanic, and records outcomes.

Keep the mechanic focused on interaction. The approved contract is explicit: Activity Composition binds concept, mechanic, theme, and approved assets; each new pilot activity stores a `themeId`; Runtime loads that theme and the resolved assets; mechanics own interaction behavior only. Implementation is in progress under the approved plan.

## Runtime integration status

The versioned PNG sprite registry is wired into Phaser and the Kitchen theme resolves in the runtime. The 15 additional approved activities are in `library/activities/` and in the active production index for Ajay's iPad test.

The detailed continuation is in the implementation plan under **Phase 2: Runtime asset handshake and two-mechanic pilot**. Ajay confirmed the existing `tap-to-select` and `drag-to-target` pair on 2026-09-27. Do not ask him to confirm again. Ajay selected a shared Kitchen theme with theme colors only, no backdrop, and approved its palette. He selected red apple, banana, orange, and carrot for the pilot; tap to find the red apple among those four, and drag red apple, banana, and orange to matching picture targets. Do not claim child enjoyment until the activities are manually tried and observations are recorded.

## Resume instructions

1. Open this checkout and branch, not the separate desktop checkout at `/Users/ajayrajendran/Documents/ChatGPT/Bloom` (that checkout did not contain this feature-branch work when checked).
2. Read this checkpoint, `BLOOM_VISION.md`, `bloom-v1.1-mvp-spec.md`, both canonical architecture files, and the current activity-set spec and plan.
3. Current follow-up: activity JSON loads must use activity-specific Phaser cache keys; completion must not ask for parent ratings and should celebrate briefly, record completion without a rating, then return to the activity list. The code is on `codex/fix-activity-switch-feedback`; push and open a PR against `main`. Let Ajay test the preview on iPad before merging it to production.
4. Preserve existing unusable legacy activity files without migrating or repairing them.
