# Bloom — restart checkpoint

**Last updated:** 2026-10-04
**Active project checkout:** `/Users/ajayrajendran/Documents/ChatGPT/Bloom`
**Current feature checkout:** `/Users/ajayrajendran/.codex/worktrees/activity-voiceover/Bloom` on `codex/activity-voiceover`, based on `origin/main` at `6671240`.
**GitHub:** PRs #2 and #3 are merged. PR #4 (`codex/randomized-activity-presentation`) remains open for physical iPad verification. The voice-over implementation is being prepared on `codex/activity-voiceover`.

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
- Added pre-generated Tara M4A/ALAC instructions for all 17 indexed activities and one shared “Well done!” clip. The selected pack is configuration data and only its clips are published. Runtime instructions play before the board, support retry/adult-led start on failure and preserve the board during replay. Completion speaks once, waits for speech end or failure plus the two-second minimum, and restores activity-list scroll. Browser speech and in-game progress guidance remain deferred. Physical iPad verification is still pending.
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


## Current pilot gate — randomized activity presentation

**Status:** Runtime implementation and automated verification are committed in managed worktree `/Users/ajayrajendran/.codex/worktrees/randomized-activity/Bloom`, branch `codex/randomized-activity-presentation`, based on `origin/main` at `67ac251` (merged PR #3). Commits: `7b7cbc4`, `714f509`, `82b08f6`, and `2a3ca4b`.

**Plan:** `docs/superpowers/plans/2026-09-30-randomized-activity-presentation.md`.

The runtime now seeds each attempt's find-choice and drag-row presentation with `ActivityScene.sessionId`. Choice correctness, matching `targetId` mappings, and category-sort membership remain on their original activity records. The library-wide seed sweep, 290/290 tests, root and runtime TypeScript checks, production build, and `git diff --check` passed. The build retains the existing >500 kB JavaScript chunk warning.

**Outstanding gate:** PR [#4](https://github.com/ajayrajen7/bloom/pull/4) is open. Physical iPad verification has not been performed; do not claim the pilot presentation is fully verified until the iPad checks in the plan are completed.

## Current voice-over pilot gate

**Plan:** `docs/superpowers/plans/2026-10-04-activity-voiceover.md`. **Approved spec:** `docs/superpowers/specs/2026-10-02-activity-voiceover-design.md`.

Implementation is on `codex/activity-voiceover`. It includes authored pre-generated narration, active-pack publication, instruction-before-board, replay, failure controls, spoken completion, and scroll restoration. Final checks passed: 296/296 tests, root and runtime TypeScript, production build, and `git diff --check`. The build publishes exactly 17 selected prompts and one completion clip; authoring scripts/manifests and inactive packs are excluded. Vite reports the existing >500 kB JavaScript chunk warning. Physical iPad checks and a human listen-through have not been performed and must be recorded as pending until tested. Verify actual voice/pronunciation, M4A playback, initial user-gesture unlock, and screen sizing on the target device.

## Resume instructions

1. Continue from `/Users/ajayrajendran/.codex/worktrees/activity-voiceover/Bloom` on `codex/activity-voiceover` and read the voice-over plan/ledger.
2. Review the open voice-over PR and preserve all unperformed listening/iPad checks as pending.
3. On the pilot iPad, verify the voice-over plan's instruction, retry/start fallback, replay for both mechanics, completion timing, and scroll restoration. Also complete PR #4's randomized-presentation checks if they are still outstanding.
4. Preserve existing unusable legacy activity files without migrating or repairing them.
