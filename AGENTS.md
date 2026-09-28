# Bloom — restart checkpoint

**Last updated:** 2026-09-27
**Active project checkout:** `/private/tmp/bloom-doc-review-source`
**Branch:** `codex/restart-doc-alignment`
**GitHub:** nothing has been committed or pushed from this work.

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

The asset-library design spec is `docs/superpowers/specs/2026-09-27-fruit-vegetable-asset-library-design.md`; its implementation record is `docs/superpowers/plans/2026-09-27-fruit-vegetable-asset-library.md`. The proposed activity/theme contract is `docs/superpowers/specs/2026-09-28-activity-theme-contract-design.md` and is not approved until Ajay reviews it.

## Completed work

- Built the manifest schema, PNG alpha/framing validator, contact-sheet workflow, style anchor/prompt contract, controlled banana/carrot text-only versus style-anchor comparison, eight canonical fruit/vegetable objects, and one green-apple color variant.
- Ajay approved the visible candidates. Nine approved sprites are in `library/assets/sprites/`; two visually approved text-only comparison controls remain in staging because the PNG validator detects opaque corner pixels and edge-touching subjects.
- See `library/assets/manifest.json`, `library/assets/reviews/chatgpt-pilot-001.json`, `library/assets/reviews/chatgpt-pilot-002.json`, `library/assets/reviews/chatgpt-pilot-summary.md`, and `library/assets/reviews/contact-sheet.html` for provenance, decisions, results, and previews.
- Last verification: `pnpm test` passed 154/154; `pnpm typecheck` passed; the nine runtime sprites passed validation. The full-manifest validator exits nonzero only for the two staged text-only controls, for their recorded alpha/framing issues.

## Agreed architecture direction for the next phase

Ajay agreed to defer execution and use this layered model as the design direction:

- **Concept:** captures age range, skill/experience goal, and difficulty; it provides the learning/activity intent.
- **Mechanic:** defines the interaction pattern (the confirmed pilot pair is `tap-to-select` and `drag-to-target`) and receives resolved activity data.
- **Theme:** supplies a reusable setting and visual treatment, such as a picnic or kitchen environment.
- **Asset catalog/storage:** provides approved object sprites, variants, and setting artwork with stable references and provenance.
- **Activity composition:** combines a concept, mechanic, theme, and selected assets into one activity definition.
- **Runtime:** reads the activity definition, loads the theme/assets, renders the scene, runs the mechanic, and records outcomes.

Keep the mechanic focused on interaction. The activity composition/runtime boundary should supply the selected theme and resolved asset references. This is the agreed direction, not an implemented or fully specified contract. Execution is explicitly deferred; refine the activity definition and theme contract before changing code.

## Runtime integration gap to handle next

The new versioned PNGs are present under `library/assets/sprites/`, but they are not yet wired into Phaser. `runtime/src/scenes/activity.ts` still preloads a hardcoded `SPRITES` list of legacy basenames and does not read `library/assets/manifest.json`. Activity JSON carries `assetRef` paths such as `sprites/apple-red-v1.png`; `ActivityScene` passes those refs to the mechanics. The mechanics derive a Phaser texture key from the basename and use the image only when that texture exists; otherwise they draw a fallback shape. Thus, merely adding a file and activity `assetRef` is not enough: the new basenames must be loaded and the texture keys must match. The new sprites also have not been added to `library/assets/sprites/taxonomy.yaml`, which generation uses for asset selection.

The detailed continuation is in the implementation plan under **Phase 2: Runtime asset handshake and two-mechanic pilot**. Ajay confirmed the existing `tap-to-select` and `drag-to-target` pair on 2026-09-27. Do not ask him to confirm again; select the small produce set/activity rules with him before creating activity content. Do not claim child enjoyment until the activities are manually tried and observations are recorded.

## Resume instructions

1. Open this checkout and branch, not the separate desktop checkout at `/Users/ajayrajendran/Documents/ChatGPT/Bloom` (that checkout did not contain this feature-branch work when checked).
2. Read this checkpoint, then the asset-library plan and design spec.
3. The mechanic pair is already confirmed: `tap-to-select` and `drag-to-target`. Resume at Phase 2 Task 8, then agree the produce set and activity rules before drafting.
4. Preserve the current local work and review records. Do not push or commit unless Ajay asks.
