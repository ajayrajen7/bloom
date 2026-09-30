# Activity and Theme Contract Implementation Plan

**Status:** Approved by Ajay for delegated execution on 2026-09-29; implementation in progress.

> **For Codex:** Ajay approved this plan and delegated execution on 2026-09-29. Follow the TDD workflow for each behavior change and verify against the acceptance criteria.

**Goal:** Implement the approved Concept + Mechanic + Theme + Asset Composition → QA → Library → Runtime contract for the two-mechanic Bloom pilot.

**Architecture:** Keep the existing A1–A8 and C3 boundaries. Add a versioned theme definition and explicit `themeId` to the shared activity contract. Activity composition supplies the theme; a shared runtime theme/asset resolver loads it; mechanics continue receiving resolved item/target data and own only interaction behavior. Register the nine approved versioned sprites for the pilot. Existing activities are out of scope: do not migrate them, preserve their appearance, or promise they remain playable under the new contract.

**Technology:** TypeScript, Zod, Vitest, Phaser, JSON asset/activity/theme files, Vite static assets.

**Approved references:** `docs/superpowers/specs/2026-09-28-activity-theme-contract-design.md`, `BLOOM_V1_ARCHITECTURE_CANONICAL.md`, `BLOOM_V1_ARCHITECTURE_CANONICAL.mermaid`, and `bloom-v1.1-mvp-spec.md`.

## Constraints and decisions

- Mechanics are `tap-to-select` and `drag-to-target`; do not re-confirm the pair or add a third mechanic.
- ChatGPT ImageGen is the asset-generation path; do not add provider comparison code.
- Keep theme selection explicit. Do not derive `themeId` from `ConceptBrief.themeHint`, mechanic ID, or runtime defaults.
- Use one shared Kitchen theme for both pilot activities, with theme colors only and no backdrop asset. Ajay approved the palette: ivory `#F6F2E8`, sage `#DDE8D2`, deep green-gray `#26352A`.
- Ajay selected the activity content on 2026-09-29: show red apple, banana, orange, and carrot; tap “Find the apple” with red apple as the only correct item and the other three as distractors; drag red apple, banana, and orange to targets showing the matching pictures.
- The new `ActivityJSON` contract and runtime target only the two new pilot activities. Leave existing unusable activity files untouched; do not migrate them or build compatibility behavior for them. Ensure only the reviewed pilot activities enter the active activity index.
- Do not expose `library/assets/manifest.json` as a runtime API; it contains authoring provenance and review data.
- Runtime must make no AI/provider calls. Keep QA and manual visual review between composition and publication/child observation.
- Preserve staged/rejected assets and the existing asset review records.

## Task 1: Define and validate versioned theme/activity contracts

**Files:**
- Modify `shared/types.ts`
- Modify `shared/types.test.ts`
- Modify `generation/pipeline/prompt.ts`
- Modify `generation/pipeline/prompt-tap-to-select.ts`
- Modify `generation/generate-cli.ts`
- Modify `tests/integration/generation-pipeline.test.ts`
- Add the selected pilot theme definition under `library/themes/`
- Update generation/integration fixtures to use the new required `themeId`

**Steps:**

1. Add a failing schema test for a `ThemeSpec` with stable `id`, `version`, setting, descriptive visual treatment, structured presentation colors (`backgroundColor`, `promptPanelColor`, `foregroundColor`), and optional asset refs. Theme refs must be versioned PNG paths under `sprites/`, `backgrounds/`, or `decorations/`; reject absolute paths, traversal, staging paths, and other suffixes. The sprite runtime resolver remains limited to registered `sprites/` refs.
2. Add a failing schema test showing `ActivityJSON.themeId` is required and non-empty. Verify absent or unknown theme IDs fail contract validation where the theme catalog is available.
3. Implement the theme and activity schemas/types. Keep `themeHint` as an optional/content-generation hint only; it is never converted to a theme ID.
4. Add `kitchen-v1` with structured presentation colors `#F6F2E8`, `#DDE8D2`, and `#26352A`; do not create a legacy theme or migrate existing activity JSON.
5. Add a required `--theme-id` input to the generation CLI and pass it through both composer functions to serialize `themeId` into the activity. Do not infer it from the concept or let the LLM invent/change it.
6. Add tests for the activity composer and schema. Confirm new pilot fixtures parse with their explicit theme ID; existing activity files are not compatibility fixtures.

**Acceptance:** Every new pilot activity has an explicit theme ID; theme selection cannot be inferred from free text. Old activity files are outside this contract.

## Task 2: Resolve approved sprite references through one runtime registry

**Files:**
- Add `runtime/src/assets/sprite-registry.ts` and focused tests (or use the nearest existing runtime test location)
- Modify `runtime/src/scenes/activity.ts`
- Modify `runtime/src/mechanics/tap-to-select.ts`
- Modify `runtime/src/mechanics/drag-to-target.ts`
- Modify `library/assets/sprites/taxonomy.yaml`
- Modify generation taxonomy tests as needed

**Steps:**

1. Add failing tests for all nine approved versioned refs: resolve each to one safe Phaser texture key and a URL under `/assets/sprites/`. Reject legacy/unregistered refs, traversal, unexpected directories, unsupported suffixes, and staged paths.
2. Implement a static runtime registry separate from the authoring manifest containing only the nine approved versioned pilot sprites.
3. Update `ActivityScene.preload()` to load the registered pilot sprites before mechanic construction. Resolve texture keys through the shared helper so mechanic texture lookup matches preload keys.
4. Make missing registered pilot textures a clear load/validation error; no fallback behavior is required for unsupported old activities.
5. Add the eight approved canonical produce types and apple color variants to the taxonomy without removing existing entries. Ensure taxonomy treats red/green apples as one canonical object with two intentional color variants.
6. Add tests proving prompts include the new produce types/variants and staged controls cannot enter the runtime registry.

**Acceptance:** Every approved pilot sprite resolves and is loaded before a mechanic uses it; old/unregistered refs and staged assets are excluded.

## Task 3: Load theme definitions and render theme-owned presentation

**Files:**
- Add a runtime theme catalog/resolver under `runtime/src/themes/`
- Add runtime theme tests in the established runtime test location
- Modify `runtime/src/scenes/activity.ts`
- Consume the selected theme JSON at `library/themes/kitchen-v1.json` created in Task 1

**Steps:**

1. Use Ajay's selected Kitchen setting and approved color palette for both mechanics; do not add a backdrop asset.
2. Add failing tests for resolving `kitchen-v1`, missing/unknown theme, and absent backdrop refs. Runtime must not select a fallback theme for an unknown explicit ID.
3. Implement theme loading from the versioned theme catalog and render the structured presentation colors at the scene boundary. Keep mechanic classes independent of theme IDs and theme files.
4. Render the selected theme through its approved scene colors without creating or loading backdrop art.
5. Keep the prompt, interaction area, progress, and completion behavior legible over the theme. Add responsive/layout assertions or a manual review checklist for tablet dimensions.

**Acceptance:** Both mechanics render the same explicit theme; unknown themes produce a clear load error; theme artwork remains separate from foreground sprites; no runtime AI calls.

## Task 4: Bind theme selection at composition and validate publication inputs

**Files:**
- Modify `generation/pipeline/validate.ts` and `generation/pipeline/store.ts`
- Modify `generation/generate-cli.ts` to stage reviewed candidates instead of auto-publishing them
- Modify `tests/integration/generation-pipeline.test.ts` and `tests/integration/layer-handshake.test.ts`
- Modify `library/activities/index.json` only if its index contract needs theme lookup

**Steps:**

1. Add failing tests that publication validation requires a known explicit `themeId` and rejects unknown IDs; verify old unusable activity JSON cannot enter the active pilot index.
2. Implement theme lookup/validation at the composition/publication boundary. Keep concept, mechanic, theme, and asset constraints separate. The LLM output cannot supply or override `themeId` because the CLI/composer provides it.
3. Validate all runtime-consumed visual refs (item, distractor, target sprites, and theme artwork) against the approved library/runtime registry and manifest; an on-disk file alone is insufficient if it is staged, rejected, or unregistered. Required prompt/SFX audio fields remain fixed placeholders and are excluded because this pilot runtime does not load audio files.
4. Ensure only activities with an explicit human approval record enter `library/activities/index.json`. Keep unreviewed candidates out of the active list; render/review them directly before publishing. Keep provenance manifest consumption at build time.

**Acceptance:** The generated activity is a complete, deterministic runtime input with known concept, mechanic, theme, resolved layout/parameters, and approved runtime-consumed visual refs; no child-specific slots remain. Prompt/SFX audio placeholders are not runtime assets in this pilot.

## Task 5: Author and review the two pilot activities

**Gate:** Start after Tasks 1–4 are implemented. The content selection is settled: red apple, banana, orange, and carrot; tap to find the red apple among those four; drag red apple, banana, and orange to matching picture targets.

**Files:**
- Add one activity JSON for `tap-to-select` and one for `drag-to-target` under `library/activities/`
- Update the activity library index if needed
- Add validation cases for both examples
- Add rendered-review records under `library/assets/reviews/` or a dedicated activity review folder

**Steps:**

1. Use only the approved versioned sprites for the selected objects. Assign the same explicit `kitchen-v1` theme ID to both activities.
2. Draft one low-difficulty activity per mechanic with concise instructions and simple layouts suitable for a 2–3-year-old.
3. Validate schema, theme resolution, mechanic slot/parameter constraints, asset approval/registry membership, and item-target mappings.
4. Run the runtime and inspect both activities at the target tablet dimensions. Review legibility, crowding, object distinction, theme consistency, prompt correctness, interaction feedback, progress/completion, and missing-asset errors.
5. Make any required revisions and request Ajay's manual activity review before treating them as approved or exposing them for child observation.

**Acceptance:** Both activities parse, use the same theme, load approved sprites, play through their mechanic, and have a recorded human review before child observation.

## Task 6: Prepare manual observation, without overclaiming

**Files:**
- Add an activity observation template under `library/assets/reviews/` or a dedicated activity review folder

**Steps:**

1. Prepare brief prompts to record whether the child starts without repeated explanation, continues willingly, asks to replay, shows confusion/frustration, or needs interaction help.
2. Keep observed asset coherence and child activity enjoyment as separate outcomes. Record the mechanic, theme, and asset presentation used.
3. Only record observations after actual supervised play. Do not treat one child's experience as population-level evidence or a developmental efficacy claim.

**Acceptance:** The review format captures concrete observations and separates the two experiment claims.

## Review checklist

Before execution, Ajay should check that the plan addresses these failure modes:

1. `themeId` defaults from a concept/mechanic hint or can be changed by the LLM.
2. Existing unusable activities accidentally enter the active pilot index or force compatibility work into the new contract.
3. Mechanics duplicate theme/rendering or asset-loading logic.
4. An approved file exists but is staged/unregistered or not preloaded by Phaser.
5. The two mechanic examples accidentally vary theme/content complexity enough to obscure the interaction comparison.

## Verification after implementation

Run the relevant focused tests, the project test suite and typecheck, the approved-asset validator, and the runtime on the target tablet viewport. Record commands and actual results. Manually verify the two rendered activities and their shared theme before claiming completion; do not claim child enjoyment before supervised observation.
