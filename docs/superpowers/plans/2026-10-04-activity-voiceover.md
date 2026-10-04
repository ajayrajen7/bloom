# Activity Voice-over Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pre-generated spoken instructions before each indexed activity, instruction replay during play, and a spoken completion celebration with predictable screen transitions.

**Architecture:** Author narration and audio as library data, with one active voice-pack ID selecting a complete pre-generated pack. Publish only the selected pack through the runtime asset boundary. The Phaser activity scene presents an instruction state before constructing/enabling the board, overlays that same state for replay, and preserves the scene while replaying. Completion plays one shared clip and returns to the selection list after both the minimum celebration time and the clip end.

**Tech Stack:** TypeScript, Phaser, Vite, Vitest, macOS `say` for authoring M4A/ALAC files.

**Spec:** `docs/superpowers/specs/2026-10-02-activity-voiceover-design.md`

## Global Constraints

- “Provide a spoken instruction for each of the 17 indexed pilot activities.”
- “Provide one shared spoken ‘Well done!’ clip at completion.”
- “Use one pre-generated voice pack for V1.”
- “Do not add item-by-item progress guidance, remaining-item names/counts, wrong-answer narration, inactivity prompts, browser speech synthesis, native speech APIs, network speech, or generated speech in V1.”
- “After the instruction audio ends, reveal and enable the activity automatically; do not require a text-dependent ‘continue’ action.”
- “V1 uses local, pre-generated audio assets.”
- The voice-pack choice is in data/configuration; changing to another complete pre-generated pack must not require gameplay logic changes.
- Missing or failed narration never prevents an adult from starting or completing an activity.
- Keep the current activity mechanics, random arrangement, activity content, visual completion copy, and no-rating completion policy intact except where the approved spec explicitly changes screen timing.
- Do not add a hosted service or runtime dependency.

## Review Focus

- A missing, unsafe, or incomplete selected voice pack must fail publication with a path-specific error and must not publish another pack; cover in `publication exposes only a complete selected voice pack` and `publication rejects incomplete or unsafe voice pack configuration`.
- A failed initial audio load/playback must keep the instruction and adult caption visible and allow retry or adult-led start; cover in `instruction view handles audio failure with retry and start controls`.
- Replaying must not reset mechanic state, progress, object order, or session identity; cover in `instruction replay restores the same activity state`.
- Completion must not cut off the spoken clip, return before two seconds, or duplicate narration; cover in `completion waits for minimum duration and narration end`.
- Returning after completion must restore the prior selection-list scroll position; cover in `completion returns to the saved selection position`.

---

### Task 1: Author scripts, voice-pack configuration, and pre-generated audio

**Files:**
- Create: `library/assets/audio/voiceover-scripts.json`
- Create: `library/assets/audio/voiceover.json`
- Create: `library/assets/audio/voice-packs/pilot-v1/manifest.json`
- Create: `library/assets/audio/voice-packs/pilot-v1/prompts/<activityId>.m4a` for all 17 indexed activities
- Create: `library/assets/audio/voice-packs/pilot-v1/well-done.m4a`
- Create: `scripts/generate-voiceovers.mjs`
- Test: `tests/integration/voiceover-authoring.test.ts`

**Interfaces:**
- `voiceover-scripts.json` contains `prompts`, mapping each indexed `activityId` to the exact complete spoken instruction string, and `completionText: "Well done!"`. Scripts state the mechanic action and count/scope in plain language and may name target items from the approved activity definition. No runtime composition or text generation occurs.
- `voiceover.json` contains one value, `activePackId: "pilot-v1"`. Switching the active pack later requires changing this value and providing all assets for the selected pack; gameplay code is not edited.
- Pack assets follow `audio/voice-packs/<packId>/prompts/<activityId>.m4a` and `audio/voice-packs/<packId>/well-done.m4a`.
- `manifest.json` records pack ID, source voice, locale, rate, generation tool/date, script text, and relative asset path for each clip.
- The authoring script validates that every indexed activity has exactly one non-empty script and emits M4A files directly with macOS `say --data-format=alac`. The initial pack uses `Tara` (`en_IN`) at the `say` default rate; the pack ID and provenance keep that choice replaceable.

- [x] **Step 1: Add `voiceover scripts cover every indexed activity exactly once`** in `tests/integration/voiceover-authoring.test.ts`, proving the script map has exactly one non-empty script per indexed activity and no unindexed IDs.
- [x] **Step 2: Add `--dry-run` to `scripts/generate-voiceovers.mjs`**; it reads the index/scripts, validates both completion text and output paths, and writes no audio files.
- [x] **Step 3: Write the 17 complete instruction scripts and the shared “Well done!” phrase** to the authoring data. Ensure tap-to-find scripts name the find action and target count; drag-to-target scripts name the drag/match action and number of matches.
- [x] **Step 4: Generate the 18 M4A/ALAC clips and pack manifest** using `say -v Tara --data-format=alac` at the default rate for all clips. Keep source and format settings in the manifest; generate a clip for every indexed activity and exactly one completion clip.
- [ ] **Step 5: Listen through the generated clips for pronunciation, missing words, clipping, and intelligibility; regenerate any defective clip** without requiring a voice audition or child-facing voice choice.
- [x] **Step 6: Run the dry-run validation and confirm it reports all 17 activities and the shared completion clip without modifying assets.**

**Human review pending:** The audio generator and `afinfo` confirmed all 18 files are non-empty and have durations, but a human listen-through for pronunciation/clipping and target-iPad voice/playback review have not been performed.

### Task 2: Publish only the configured narration pack

**Files:**
- Modify: `runtime/publication.ts`
- Test: `tests/integration/runtime-publication.test.ts`
- Modify: `shared/types.ts` only if a shared schema is needed for the published config

**Interfaces:**
- The authoring config is `library/assets/audio/voiceover.json`; the publication layer validates `activePackId` against `^[a-z0-9][a-z0-9-]{0,63}$`.
- The selected pack has a prompt M4A for every ID in `library/activities/index.json` and one `well-done.m4a`.
- `collectRuntimeFiles()` publishes the selected pack's prompt and completion M4A files under `/assets/audio/voice-packs/<packId>/...` and exposes `/voiceover.json` with this shape: `{ activePackId, promptScripts: Record<activityId, string>, promptPathPattern: "/assets/audio/voice-packs/{packId}/prompts/{activityId}.m4a", completionPathPattern: "/assets/audio/voice-packs/{packId}/well-done.m4a" }`. It does not publish unselected packs or authoring manifests.
- `runtimeAssetResponse()` serves M4A files as `audio/mp4`.

- [x] **Step 1: Add `publication exposes only a complete selected voice pack`** asserting all 17 selected prompts plus completion and their spoken captions are published, while files for any unselected pack, the authoring scripts file, and pack manifests are absent.
- [x] **Step 2: Add `publication rejects incomplete or unsafe voice pack configuration`** for missing/invalid pack ID, missing activity prompt, missing completion clip, placeholder audio, and traversal paths; assert errors name the missing/invalid path.
- [x] **Step 3: Add `publication serves selected narration with audio/mp4`** for a prompt path and the completion path.
- [x] **Step 4: Run the focused publication test and confirm the new assertions fail before implementation.**
- [x] **Step 5: Implement active-pack validation, complete-pack allowlisting, generated runtime config, and M4A MIME handling** in `runtime/publication.ts`.
- [x] **Step 6: Run `pnpm exec vitest run tests/integration/runtime-publication.test.ts`** and confirm all new publication assertions pass.

### Task 3: Implement instruction, playback, failure fallback, and replay states

**Files:**
- Create: `runtime/src/voiceover.ts`
- Modify: `runtime/src/scenes/activity.ts`
- Modify: `runtime/src/scenes/selection.ts`
- Create: `tests/integration/voiceover-playback.test.ts`

**Interfaces:**
- `runtime/src/voiceover.ts` exports `promptAudioUrl(packId: string, activityId: string): string` and `completionAudioUrl(packId: string): string`, yielding the published paths, plus `RuntimeVoiceoverConfig` with `activePackId`, `promptScripts`, `promptPathPattern`, and `completionPathPattern` read from `/voiceover.json`.
- `ActivityScene` renders the full-screen instruction state before starting the activity/audio/sprite loader, using the activity theme background from the indexed `themeId`, the exact caption from the published runtime voiceover config (authored in `voiceover-scripts.json`), a centered 96 CSS-pixel speaker symbol that pulses from scale `1.0` to `1.06` over a 1.5-second cycle during speech, and a loading spinner plus “Getting ready…” until the activity data and clip are ready. Narration starts as soon as those two files are ready, without waiting for the remaining board sprites.
- The selection-card tap must unlock the Phaser/browser audio context synchronously before the scene transition, using the existing selection tap interaction where possible. The instruction state hides activity sprites, targets, choices, progress dots, stars, and all game input. When prompt audio ends, it enters the existing board and enables input without a tap.
- On initial load/play failure, the instruction state shows the complete caption and controls at least 240 by 72 CSS pixels labeled “Try voice again” and “Start activity”. Retry uses the same clip; Start activity creates the board after allowing the adult to read the caption.
- During play, a 64-by-64 CSS-pixel minimum speaker control overlays the same instruction state and temporarily blocks board input. When replay ends, the exact board/session returns; if replay fails, return to the board immediately with its prior state.

- [x] **Step 1: Add `instruction view waits for narration before showing the board`** asserting the activity intro appears immediately, the caption and loading state are present, no mechanic input or board artwork is visible, narration starts when ready, and the board is built only after the audio `ended` event.
- [x] **Step 2: Add `instruction view handles audio failure with retry and start controls`** covering missing asset, load error, and rejected playback. Assert the adult caption remains, retry requests the same clip, and Start activity enters the board without an audio dependency.
- [x] **Step 3: Add `instruction replay restores the same activity state`** covering both mechanics. Snapshot session ID, correct count/progress, object positions/order, and mechanic state; replay and assert the same values remain after the clip ends or after a replay error.
- [x] **Step 4: Add failing tests for the instruction screen and replay behaviors** in `tests/integration/voiceover-playback.test.ts`; run `pnpm exec vitest run tests/integration/voiceover-playback.test.ts` and confirm the new assertions fail.
- [x] **Step 5: Implement instruction/loading/error/replay states** in `ActivityScene` using one overlay for the initial and replay instruction states. Build the board only after successful initial narration or explicit Start activity; on replay, preserve and uncover the existing board rather than reinitializing the scene.
- [x] **Step 6: Wire the selection-to-activity transition and replay control**; ensure the card tap unlocks browser audio before the async asset load, without changing prompt text, mechanic behavior, random arrangement, or the activity session ID.
- [x] **Step 7: Run the focused voiceover playback test** and confirm loading, end-event transition, both failure routes, and state-preserving replay pass.

**Execution ruling:** Phaser does not render a scene until its `preload()` queue finishes. To meet the immediate instruction-screen requirement, normal activity scenes render from `create()` before starting the Loader; the index now carries each activity's `themeId`, and narration begins on the activity JSON plus prompt-audio file-complete events while board sprites continue loading. The existing list order is preserved.

### Task 4: Play completion narration and return to selection predictably

**Files:**
- Modify: `runtime/src/scenes/completion.ts`
- Modify: `runtime/src/scenes/activity.ts`
- Modify: `runtime/src/scenes/selection.ts`
- Test: `tests/integration/voiceover-playback.test.ts`

**Interfaces:**
- `CompletionScene.preload()` loads `/voiceover.json`; `create()` starts the selected pack's `well-done.m4a` once after it renders the existing themed celebration.
- The selection scroll position travels with the activity/completion scene data and is applied after the activity list cards are built.
- Completion remains visible until both conditions hold: at least 2000 ms have elapsed since the completion view appeared and either the audio `ended` event fired or playback failed.

- [x] **Step 1: Add `completion waits for minimum duration and narration end`** for narration shorter than two seconds, longer than two seconds, load/play failure, and duplicate completion entry; assert “Well done!” begins once after the completion view renders.
- [x] **Step 2: Add `completion returns to the saved selection position`** asserting the activity list returns automatically with the original scroll position and does not start another activity or request feedback.
- [x] **Step 3: Implement completion narration and the two-condition return timer** while retaining the existing 900 ms post-success delay, visual “Well done! 🎉” celebration, telemetry behavior, and automatic navigation.
- [x] **Step 4: Save and restore the selection list scroll position** through the activity and completion scene transitions.
- [x] **Step 5: Ensure no completion oscillator sound overlaps the spoken phrase**; keep all non-overlapping success/error effects unchanged.
- [x] **Step 6: Run `pnpm exec vitest run tests/integration/voiceover-playback.test.ts tests/integration/completion-theme.test.ts`** and confirm playback ordering, timing, failure handling, and scroll restoration pass.

### Task 5: Reconcile project documents, verify, and prepare the PR

**Files:**
- Modify: `bloom-v1.1-mvp-spec.md`
- Modify: `BLOOM_V1_ARCHITECTURE_CANONICAL.md`
- Modify: `BLOOM_V1_ARCHITECTURE_CANONICAL.mermaid`
- Modify: `AGENTS.md` checkpoint section
- Verify: production output and pilot iPad behavior

- [x] **Step 1: Update the MVP spec** to include V1 pre-generated instruction/completion audio and the approved instruction-first, replay, failure, and completion flow; keep progress guidance and browser speech deferred.
- [x] **Step 2: Update the canonical architecture text and diagram** to include generic pre-generated narration in the existing content/audio path and preserve the no-runtime-generation boundary for V1.
- [x] **Step 3: Update the restart checkpoint** with the feature branch/PR, implemented scope, test results, and any pending physical iPad verification.
- [x] **Step 4: Run the complete automated verification** with `pnpm test && pnpm typecheck && pnpm build && git diff --check`.
- [x] **Step 5: Verify production output contains only all 17 active-pack prompts and its completion clip**, with no inactive packs, authoring scripts, or review manifests.
- [ ] **Step 6: On the pilot iPad, verify an instruction-before-board transition, replay for one tap and one drag activity, audio-failure controls, “Well done!” completion timing, and return to the activity list.** Record unperformed checks as pending; do not describe them as verified.
- [x] **Step 7: Prepare and raise a PR from a feature branch based on the latest default branch**, attaching the PR to this task and noting any iPad verification still pending.

**PR:** [#5 — Add pre-generated activity voice-over](https://github.com/ajayrajen7/bloom/pull/5). The human clip review and physical iPad checks in Steps 5 and 6 remain pending.
