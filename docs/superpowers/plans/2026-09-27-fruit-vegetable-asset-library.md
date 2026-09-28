# Fruit and Vegetable Asset Library Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce and manually review a coherent ChatGPT-generated pilot library of familiar fruit and vegetable sprites, with a controlled style-reference test and one attribute variant.

**Architecture:** Use ChatGPT's built-in image generation manually, with the approved apple as the shared style anchor; do not add a provider API or account. Stage candidates with prompt/version/provenance metadata, validate PNG transparency and framing locally, then present every candidate in a contact sheet for Ajay's manual decision before adding approved files to the runtime sprite library.

**Tech Stack:** Existing TypeScript, Node.js, Vitest, and Zod; ChatGPT built-in ImageGen for manual image creation; `pngjs` plus its TypeScript declarations as dev dependencies for deterministic PNG inspection. Do not use a paid provider API or require API credentials.

**Spec:** `docs/superpowers/specs/2026-09-27-fruit-vegetable-asset-library-design.md`

## Global Constraints

- Ajay will manually review every asset candidate in the pilot. Automated image checks and model-based evaluation are supporting evidence; neither may approve assets or replace human review.
- Limit the asset category to fruits and vegetables.
- Use generated art rather than collecting unrelated internet assets.
- Use a reference image as a candidate consistency aid.
- Review every pilot candidate manually.
- Keep scene backdrops separate from transparent object sprites.
- The pilot uses ChatGPT's built-in image generation only. This avoids adding a second provider and account workflow.
- Generate object sprites as individual images. Use contact sheets for review, rather than relying on a generated multi-object sheet as the primary asset source.
- Treat size as a render-time scale parameter in the first pass.
- Preserve the existing `library/assets/sprites/` consumer path and current `assetRef` strings. Gameplay schema changes are not part of this asset phase.
- Only manually approved candidates enter the runtime-approved sprite set.
- Record the ChatGPT surface and any model/version information it exposes; if the underlying model is not identified, record it as unknown.

## Review Focus

- Reference conditioning can copy the apple's shape or leaf layout into unrelated objects. Test banana and carrot both with and without the anchor; compare the resulting shapes before choosing the generation condition.
- The new realistic rendering may vary across round and elongated produce. Compare all canonical sprites to the approved apple at full size and play size; record manual coherence decisions.
- A simulated checkerboard or opaque background can look transparent in a preview. Test alpha at the four corners and composite previews over both light and dark backgrounds.
- Oversized highlights or skin texture can become noisy at tablet size. Include a play-size preview and record legibility in manual review.
- A green apple variant may accidentally change the canonical silhouette or leaf/stem. Compare directly with its red canonical image and test variant identity in the review record.

---

### Task 1: Add the asset manifest schema and fixture cases

**Files:**
- Create: `generation/assets/manifest.ts`
- Create: `generation/assets/manifest.test.ts`
- Create: `library/assets/manifest.json`

**Interfaces:**
- Produces: `AssetEntrySchema`, an array-level `AssetManifestSchema` with unique-ID checking, and inferred `AssetEntry` / `AssetManifest` types for stable asset ID, display name, category, canonical/variant relationship, variant attributes, relative file path, generation surface/model/version, prompt version, style-reference version, batch ID, metrics, manual decision, and reviewer notes.

- [x] **Step 1: Write failing Vitest cases** for a valid canonical entry, a valid color variant linked to a canonical ID, an invalid category, a duplicate asset ID, and an invalid manual decision value.
- [x] **Step 2: Run `pnpm test generation/assets/manifest.test.ts`** and confirm the cases fail because the schema/module is not implemented.
- [x] **Step 3: Implement the Zod schema** with only fields required by the spec and exact allowed category/review-decision values.
- [x] **Step 4: Run `pnpm test generation/assets/manifest.test.ts`** and confirm every schema case passes.

### Task 2: Add deterministic PNG and framing checks

**Files:**
- Create: `generation/assets/validate.ts`
- Create: `generation/assets/validate-cli.ts`
- Create: `generation/assets/validate.test.ts`
- Create: transparent and opaque PNG fixtures under `generation/assets/fixtures/`
- Modify: `package.json` and `pnpm-lock.yaml` for `pngjs` and the `assets:validate` script

**Interfaces:**
- Consumes: `AssetManifest` entries and local PNG files.
- Produces: `validateAsset(path) -> { valid, width, height, hasAlpha, transparentCorners, subjectBounds, centerOffset, occupancy, issues }`.

- [x] **Step 1: Write failing Vitest cases** for valid transparent RGBA, RGB with no alpha, an opaque checkerboard-like corner, subject touching the frame edge, and subject centered within tolerance.
- [x] **Step 2: Run `pnpm test generation/assets/validate.test.ts`** and confirm the tests fail before the validator exists.
- [x] **Step 3: Implement PNG decode and alpha/bounds metrics** using `pngjs`; record metrics and issues without auto-approving any candidate.
- [x] **Step 4: Add `assets:validate`** as `node --import tsx/esm generation/assets/validate-cli.ts`; accept a manifest path and print one result per candidate.
- [x] **Step 5: Run `pnpm test generation/assets/validate.test.ts` and `pnpm assets:validate -- library/assets/manifest.json`** and confirm fixture checks and manifest traversal pass.

### Task 3: Create a contact-sheet review workflow

**Files:**
- Create: `generation/assets/contact-sheet.ts`
- Create: `generation/assets/contact-sheet.test.ts`
- Create: `library/assets/reviews/` output for pilot review records

**Interfaces:**
- Consumes: staged candidate files, manifest metadata, and validator results.
- Produces: a local HTML contact sheet with full-size and approximate-play-size previews, candidate IDs, prompt/model/reference provenance, metrics, and a pending-review JSON template. Ajay's decisions and rejection reasons are recorded only after he reviews the sheet.

- [x] **Step 1: Write failing tests** proving that a manifest with two candidates produces two correctly labeled entries, missing files are flagged, and generated markup includes both full-size and play-size image views.
- [x] **Step 2: Run `pnpm test generation/assets/contact-sheet.test.ts`** and confirm the tests fail before the builder exists.
- [x] **Step 3: Implement the static contact-sheet builder** and a pending-review JSON template; it presents evidence and records no automatic approval.
- [x] **Step 4: Run `pnpm test generation/assets/contact-sheet.test.ts`** and confirm all contact-sheet cases pass.

### Task 4: Register the approved apple anchor and reusable prompt contract

**Files:**
- Create: `library/assets/style/style-anchor-v1.png` (copy the user-approved ChatGPT sample; preserve the original generated-image file)
- Create: `library/assets/style/style-contract-v1.md`
- Create: `library/assets/prompts/object-sprite.v1.txt`
- Modify: `library/assets/manifest.json`

- [x] **Step 1: Record the visible style contract** from the approved sample: natural apple proportions, semi-realistic digital rendering, subtle skin detail, clean silhouette, restrained highlights, transparent square framing.
- [x] **Step 2: Create the reusable object prompt** with a clear subject slot and instructions to use the anchor for rendering style only.
- [x] **Step 3: Copy `/Users/ajayrajendran/.codex/generated_images/01a0db82-9ad8-7ff0-b44e-2fd32e526d21/exec-20328fd4-3598-494c-94da-14a1bfd0abaa.png`** to `library/assets/style/style-anchor-v1.png` without modifying the source.
- [x] **Step 4: Add the anchor entry to the manifest** with ChatGPT surface provenance, prompt version, 1254 × 1254 dimensions, verified alpha, and manual approval status.
- [x] **Step 5: Run `pnpm test generation/assets/manifest.test.ts generation/assets/validate.test.ts` and `pnpm assets:validate -- library/assets/manifest.json`** and confirm the manifest and image checks pass.

### Task 5: Run the controlled style-reference pilot

**Files:**
- Create: `library/assets/staging/chatgpt-pilot-001/` candidates for banana and carrot in text-only and anchor-referenced conditions
- Create: matching metadata and manual decisions under `library/assets/reviews/chatgpt-pilot-001.json`

- [x] **Step 1: Generate one banana and one carrot with the approved prompt contract and no reference image.**
- [x] **Step 2: Generate the same two subjects with identical subject instructions and the apple style anchor supplied as a style reference.**
- [x] **Step 3: Record the prompt version, ChatGPT surface, exposed model/version or `unknown`, reference condition, dimensions, and alpha result for every candidate.**
- [x] **Step 4: Build and open the contact sheet; manually compare each pair for style coherence, subject recognition, framing, and unwanted copying.**
- [x] **Step 5: Present all four candidates to Ajay and wait for his decisions; record each decision and reason. Reuse only approved reference-conditioned candidates as canonicals if the comparison supports it.**

### Task 6: Generate the eight-object canonical pilot and one attribute variant

**Files:**
- Create: staged candidates for apple, banana, orange, grapes, carrot, tomato, cucumber, and broccoli (reuse approved Task 5 candidates where suitable)
- Create: one green-apple color variant linked to the red canonical
- Modify: `library/assets/manifest.json` and the pilot review record

- [x] **Step 1: Generate missing canonical objects individually** with the selected ChatGPT prompt/reference condition; preserve one object per transparent square image.
- [x] **Step 2: Generate one green-apple color variant** using the approved red apple as identity reference; request only a color change.
- [x] **Step 3: Run targeted validation tests and the asset validator over every candidate.** Corrected measurable framing defects in tomato, cucumber, broccoli, and green apple. Retained the two text-only comparison controls with their measured issues and excluded them from the runtime set.
- [x] **Step 4: Generate the contact sheet** with every pilot candidate shown at full size and play size.
- [x] **Step 5: Present all six new candidates to Ajay and record decisions.** Ajay approved all six; reviewer notes and timestamp are in `library/assets/reviews/chatgpt-pilot-002.json`. Review duration was not measured.

### Task 7: Promote approved assets and record pilot findings

**Files:**
- Create: approved files under `library/assets/sprites/` using non-colliding versioned names
- Modify: `library/assets/manifest.json`
- Create: `library/assets/reviews/chatgpt-pilot-summary.md`

- [x] **Step 1: Promote only manually approved candidates** to the runtime sprite directory and set their manifest review status to approved.
- [x] **Step 2: Verify every runtime-approved manifest path resolves** and passes PNG, alpha, margin, and centering checks. The two approved text-only comparison controls remain staged and flagged; they are not runtime sprites.
- [x] **Step 3: Run `pnpm test`, `pnpm typecheck`, and the asset validator**; record actual pass/fail output. Full suite: 154/154 passed. Typecheck passed. Runtime subset: 9/9 passed. Full-manifest validator exits 1 only for the two text-only controls due to opaque canvas corners and edge-touching subjects.
- [x] **Step 4: Summarize candidate count, keep-rate, reference-condition result, review time, transparency/framing results, and remaining gaps** in `library/assets/reviews/chatgpt-pilot-summary.md`. Do not claim activity enjoyment until mechanics are built and child observation is completed.

## Scope Boundary

Tasks 1–7 cover the asset-library pilot and do not modify mechanics or generate story art, backdrops, audio, profiles, personalization, or TTS. The continuation below records the runtime wiring and activity-observation plan; it remains unstarted until the mechanic pair is confirmed.

---

## Phase 2: Runtime asset handshake and two-mechanic pilot

**Status:** Planned; not implemented. The new sprite files are promoted into the runtime asset directory, but the current Phaser preloader does not load their versioned names. User has deferred execution until the layer/activity contracts are reviewed. Ajay confirmed the existing `tap-to-select` and `drag-to-target` pair on 2026-09-27. The pilot tests these two interaction styles without adding a new mechanic implementation.

### Agreed layer boundaries (design direction; implementation deferred)

Ajay agreed that the scalable design should keep these responsibilities distinct:

- **Concept:** age range, skill/experience goal, and difficulty; describes what the child is practicing.
- **Mechanic:** interaction rules and feedback (`tap-to-select` or `drag-to-target` for this pilot).
- **Theme:** reusable setting and visual treatment (for example picnic or kitchen).
- **Asset catalog/storage:** approved foreground objects, variants, and setting art with stable references and provenance.
- **Activity composition:** binds the selected concept, mechanic, theme, and assets into one activity definition.
- **Runtime:** resolves that definition, loads the theme and sprites, runs the mechanic, and records outcomes.

The mechanic should receive resolved item/target data and callbacks; the activity/runtime layer supplies the theme. Use one explicitly selected theme across both pilot activities so the visual setting stays constant during the mechanic comparison. The user has deferred execution. Before implementation, define the activity/theme fields and review the design; do not treat this direction as an already existing code contract.

### Current runtime contract and gap

- Activity `assetRef` values are paths relative to `library/assets/`, for example `sprites/apple-red-v1.png`.
- `ActivityScene.preload()` in `runtime/src/scenes/activity.ts` currently loads the activity JSON and each basename in its hardcoded `SPRITES` array from `/assets/sprites/<basename>.png`.
- The scene parses the activity JSON and passes item/target `assetRef` strings to each mechanic.
- `TapToSelectMechanic` and `DragToTargetMechanic` strip the directory and `.png` suffix to derive the Phaser texture key; they display an image only if `scene.textures.exists(key)` and otherwise draw a simple fallback shape.
- The nine new versioned sprite basenames are absent from the preload array. The runtime does not load `library/assets/manifest.json`; that file currently records provenance/reviews/measurements. The new sprites are also absent from `library/assets/sprites/taxonomy.yaml`.
- Existing activity validation checks that an `assetRef` file exists under `library/assets`, but that alone does not prove that Phaser preloaded its texture.

### Task 8: Wire versioned sprites into Phaser and taxonomy

**Files:**
- Modify: `runtime/src/scenes/activity.ts`
- Modify: `runtime/src/mechanics/tap-to-select.ts`
- Modify: `runtime/src/mechanics/drag-to-target.ts`
- Modify: `library/assets/sprites/taxonomy.yaml`
- Create tests alongside any extracted asset-reference helper (expected: `runtime/src/assets/sprite-registry.ts` and `runtime/src/assets/sprite-registry.test.ts`, unless existing runtime test conventions suggest a more suitable location)

**Interface decision:** Keep this pilot incremental. Preserve the current activity `assetRef` format and the legacy preload behavior. Introduce one shared resolver for refs to texture keys/URLs so both mechanics use the same basename rule. Add the nine approved versioned names to the preload registry; do not load staged candidates or comparison controls. Do not make the provenance manifest a runtime API in this phase.

- [ ] **Step 1: Add failing resolver tests.** Cover `sprites/apple-red-v1.png` → texture key `apple-red-v1` and URL `/assets/sprites/apple-red-v1.png`; cover all nine approved runtime paths; reject unsupported suffixes, path traversal, and non-sprite directories.
- [ ] **Step 2: Implement the shared sprite-reference resolver and registry.** Keep references relative to `library/assets/`; preserve existing legacy asset keys and make registered versioned assets discoverable by `ActivityScene.preload()`.
- [ ] **Step 3: Update both mechanics to use the shared texture-key resolver.** Keep their existing behavior for a missing texture, but ensure all registered versioned refs resolve to the loaded Phaser key.
- [ ] **Step 4: Add regression checks for activity asset refs.** Verify each selected pilot ref resolves to an existing PNG and a key present in the runtime registry; verify staged controls cannot enter that runtime registry.
- [ ] **Step 5: Register the eight canonical produce types and apple color variants in `taxonomy.yaml`.** Preserve existing taxonomy entries; test prompt formatting includes all eight new produce types and both new apple variants, with red and green grouped as one apple type.
- [ ] **Step 6: Run `pnpm test`, `pnpm typecheck`, and `pnpm assets:validate -- library/assets/manifest.json`.** Expect the two documented staged text-only controls to remain the only full-manifest validation failures. Independently assert all nine runtime sprites and all runtime registry paths pass and resolve.
- [ ] **Step 7: Run the runtime and open a pilot activity.** Verify network paths return the new PNGs, the Phaser texture keys exist before mechanic construction, sprites render instead of fallback circles, and existing legacy activity references still load.

### Task 9: Build two reviewed activity examples

**Mechanic-pair decision: resolved.** Ajay confirmed `tap-to-select` plus `drag-to-target` on 2026-09-27. Do not ask him to confirm the pair again or invent/implement a third mechanic in this pilot. The activity content and produce subset still need to be agreed.

**Files:**
- Create: one reviewed low-difficulty activity JSON per confirmed mechanic under `library/activities/`
- Modify if needed: a concept brief under `concepts/briefs/`
- Test: activity validation cases that exercise new asset refs for both mechanics

- [x] **Step 1a: Confirm the mechanics.** Ajay selected the existing `tap-to-select` and `drag-to-target` pair.
- [ ] **Step 1b: Select a small produce set and activity rules with Ajay.** Keep item assets fruit/vegetable-only; targets may use short text labels or existing neutral basket art where the mechanic needs targets.
- [ ] **Step 2: Draft one simple `tap-to-select` activity** if selected. Use familiar produce, a short clear prompt, a layout whose item count matches its mechanic constraints, and `assetRef` values from the approved versioned sprite set.
- [ ] **Step 3: Draft one simple `drag-to-target` activity** if selected. Use a small number of items/targets, explicit item-to-target mappings, and existing layout constraints; keep its rule visually obvious for a first manual trial.
- [ ] **Step 4: Validate each activity with `validateActivity` and `ActivityJSONSchema`.** Assert every referenced file exists, each ref is registered/preloaded, item/target IDs and counts satisfy the mechanic spec, and all category refs stay within the fruit/vegetable pilot set.
- [ ] **Step 5: Open both activities in the runtime and fix defects before showing them.** Confirm correct rendering, prompt legibility, tap/drag feedback, progress, completion, and no missing textures or console errors.
- [ ] **Step 6: Present the two concrete activities to Ajay for manual review.** Record any edits and final approval before child observation.

### Task 10: Observe the child’s activity experience

**Files:**
- Create: `library/assets/reviews/activity-pilot-observations.md` or a suitably named activity-pilot review record

- [ ] **Step 1: Agree with Ajay on a short, low-pressure manual play session.** Parent supervision and stopping when the child loses interest are required; do not treat this as a developmental assessment.
- [ ] **Step 2: Try each activity and record observable evidence separately.** Note whether the child starts without repeated adult explanation, continues willingly, asks to replay, shows confusion/frustration, or needs help with the interaction. Record which mechanic and asset presentation were used.
- [ ] **Step 3: Summarize asset consistency and activity enjoyment as separate outcomes.** State whether the factory produced coherent/reusable sprites and whether either activity appeared enjoyable; identify specific failures and propose the smallest next experiment. Do not generalize from one child or one session.

## Restart checkpoint

- Asset-library phase (Tasks 1–7) is complete locally on branch `codex/restart-doc-alignment` in `/private/tmp/bloom-doc-review-source`; not committed or pushed.
- Current candidate and runtime sprite paths/decisions are in `library/assets/manifest.json`; review material is in `library/assets/reviews/`.
- Last verified: 154 tests passed; typecheck passed; 9/9 runtime sprites passed. Full-manifest validation reports the two retained text-only controls only.
- Start with Task 8. The mechanic pair is confirmed; agree the content subset/rules before Task 9 Step 1b. The runtime gap described above is real and still open.
