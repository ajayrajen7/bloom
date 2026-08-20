# Bloom — State of Repo Report

**Date:** 2026-08-18
**Branch checked out:** `claude/state-of-repo-report-btqas0` (HEAD `bc4c0e2`)
**Method:** fresh `pnpm install`, `pnpm typecheck`, `pnpm test`, plus direct inspection of pipeline code against `BLOOM_V1_ARCHITECTURE.md` and `BLOOM_V1_IMPLEMENTATION.md`.

---

## 1. Bottom line

The five-layer architecture is real and correctly wired — Framework → Concept → Mechanics → Generation → Runtime, with the library as the sole handoff, matches the HLD. 139 tests pass, typecheck is clean, 13 activities exist across both mechanics and all three divisions, and the runtime loads and plays them.

But the generation pipeline as currently wired **no longer matches the documented pipeline**. `pnpm generate` now goes prompt → validate → LLM-review → **direct auto-store**, skipping staging and manual review entirely, and it drops rejection logging on the two gates that still run. This isn't a stray commit — it's deliberate (`memory.md`, 2026-05-15: "Skip manual review for all generated activities going forward — auto-approve pipeline only") — but it contradicts an explicit `CLAUDE.md` rule ("Skip the manual review step in the generation pipeline" is listed under *Things you should never do without asking*) and a non-negotiable design invariant (§ Design invariants #5, rejection logging). That's the headline finding; everything else below is secondary.

---

## 2. What exists, by layer

| Layer | Files | State |
|---|---|---|
| Framework | `framework/framework-2-3.yaml`, `framework/loader.ts` | Matches contract. `getDivisionsForAge`, `getDivisionById`. 9 tests. |
| Concept | `concepts/briefs/concept_001–005.json`, `concepts/loader.ts`, `concepts/new-concept.ts` | 5 briefs, all with `mechanicId`, `itemSprites`, `targetSprites` per the updated `ConceptBriefSchema`. 7 tests. |
| Mechanics | `mechanics/specs/drag-to-target.yaml`, `tap-to-select.yaml`, `mechanics/loader.ts` | Both specs have layout variants; loader used only by Generation and by `store.ts` at approve-time, never by Runtime — the "one consumer" rule (ARCHITECTURE.md) holds. 15 tests. |
| Generation | `generation/pipeline/{prompt,prompt-tap-to-select,validate,llm-review,stage,store}.ts`, `generation/generate-cli.ts`, `generation/taxonomy.ts` | See §3 — pipeline exists but its wiring has drifted from the 3-gate design. |
| Library | `library/activities/` (13 files), `library/staged/` (empty), `library/rejected/` (empty), `library/assets/{sprites,audio}` | 13 activities: 4 drag-to-target, 8 tap-to-select, 1 dev fixture. All 3 divisions represented. Difficulty skew: 12 low, 1 medium, **0 high** — the high-difficulty path (itemCount=6, distractorCount=2) has never produced a stored activity, only an eval case (`eval_010_valid_high.json`). |
| Runtime | `runtime/src/scenes/{boot,selection,activity,completion}.ts`, `runtime/src/mechanics/{drag-to-target,tap-to-select}.ts`, `runtime/src/{audio,telemetry,main}.ts` | Both mechanics render from JSON, layout-driven via `shared/layout-engine.ts`. Selection screen has scroll (added post-M4). Telemetry writes `SessionRecord` on completion rating. |
| Shared | `shared/types.ts`, `shared/layout-engine.ts` | All documented schemas present, plus `ActivityIndexSchema`/`ActivityIndexEntrySchema`, `LLMGenerationOutputSchema`, `LLMTapToSelectOutputSchema`, the full `LayoutArrangementSchema` family — these exist in code and match what `IMPLEMENTATION.md` describes, except `ActivityIndexSchema` isn't written into `IMPLEMENTATION.md` §2 (minor doc gap, not a code problem). |

---

## 3. What works (verified this session)

- `pnpm install` — clean.
- `pnpm typecheck` — clean, no errors.
- `pnpm test` — **139/139 passing**, 10 test files (matches the count `memory.md` claims).
- Generation → validation → LLM review → store: works end-to-end for both mechanics (confirmed by reading `generate-cli.ts` and the 12 real activities in `library/activities/`).
- Runtime reads `library/activities/index.json`, renders drag-to-target and tap-to-select from layout-inlined JSON, no mechanic-spec dependency at runtime.
- Sprite taxonomy + scope validation (`generation/taxonomy.ts`, `validate.ts`) correctly blocks same-type item/target sharing at low/medium difficulty — this is real, tested logic (21 tests), not just a doc claim.
- Eval runner (`pnpm eval`) exists, writes timestamped reports to `generation/evals/results/` (gitignored, per `IMPLEMENTATION.md` §6).

---

## 4. Where implementation diverges from the docs

Ordered by severity.

### 4.1 Manual review gate (Gate 3) is bypassed — CRITICAL

`generation/generate-cli.ts` calls `approveActivityDirect()` (`store.ts:19`) immediately after LLM review passes. It never calls `stageActivity()` and never routes through `library/staged/`. `pnpm review` (`generation/review-ui/serve.ts`) and the preview-HTML generator (`stage.ts`) still exist and are still tested (`tests/integration/generation-pipeline.test.ts`), but they are **dead in the real content path** — `library/staged/` is empty, and the one file left in `generation/review-ui/staged/` predates the change.

This directly contradicts:
- `BLOOM_V1_ARCHITECTURE.md` Phase 3 diagram — Gate 3 (human, in-browser) is drawn as mandatory before `store.ts`.
- `CLAUDE.md` § *Things you should never do without asking*: "Skip the manual review step in the generation pipeline."
- `BLOOM_V1_IMPLEMENTATION.md` § Content review workflow: "Reviewer notes are mandatory. Every reject or regenerate decision must include a reason."

`memory.md` logs this as an intentional decision (2026-05-15). It may be the right call at this volume, but it was made without going through the doc-contradiction protocol `CLAUDE.md` itself specifies ("Stop the task. Surface the contradiction. Propose what should change. Wait for confirmation."). Either `ARCHITECTURE.md`/`CLAUDE.md` need an explicit amendment sanctioning auto-approve, or the pipeline needs to go back through staging.

### 4.2 Rejection logging is broken for two of three gates — violates a non-negotiable invariant

`CLAUDE.md` § Design invariants #5: "Rejections at any pipeline gate are logged to `library/rejected/` with a structured reason. This is non-negotiable."

In `generate-cli.ts`:
- Validate failure (Gate 1) → `console.error` + `process.exit(1)`. No `rejectActivity()` call.
- LLM review failure (Gate 2) → same. No `rejectActivity()` call.

`rejectActivity()` (`store.ts:83`) is only ever invoked from `serve.ts`'s manual-review flow (Gate 3), which is unreachable per §4.1. Net effect: **`library/rejected/` is empty**, and has been since the auto-approve change — not because nothing has failed, but because failures aren't being written anywhere. This is exactly the rejection data the eval set is supposed to grow from (`IMPLEMENTATION.md` § Eval discipline), and it's currently going nowhere.

### 4.3 Regression tests: directory is empty despite logged bug fixes

`tests/regression/` contains only `.gitkeep`. `IMPLEMENTATION.md` § Regression tests: "Every bug fix gets a regression test... They never get deleted." `memory.md` logs at least two concrete bugs fixed without a regression test:
- `store.ts` / `serve.ts` `.approved.json` re-queue/duplicate-index bug (2026-05-15).
- The original drag-vs-scroll issue that motivated Phaser (M1) — arguably pre-dates the convention, but the selection-screen scroll fix (2026-05-15, `7d0e9aa`) is a newer bug-shaped fix with no regression test either.

### 4.4 M5 (current milestone) done-when: 3 of 4 criteria unmet

Per `memory.md`'s own tracking table, confirmed against the filesystem:

| Criterion | Status |
|---|---|
| Tap-to-select activities playable on iPad | Not tested |
| Library reaches 15–20 activities | 13 (12 generated + 1 dev fixture) |
| All eval cases pass (drag + tap) | No tap-to-select eval cases exist — all 10 files in `generation/evals/cases/` are drag-to-target/schema-level cases |
| Integration tests for both mechanics pass | No tap-to-select-specific integration test file; `tests/integration/generation-pipeline.test.ts` has no tap-to-select fixtures (grep confirms zero matches) |

This matches what `memory.md` already says — flagging it here as independently verified, not new information.

### 4.5 TTS is entirely unimplemented

`BLOOM_V1_ARCHITECTURE.md` names OpenAI TTS HD as a V1 key decision; `openai` is a `package.json` dependency. But no `.ts` file in the repo imports `openai`. Every stored activity's `prompt.audioRef` is the literal string `"audio/prompts/PLACEHOLDER.mp3"` (verified on `act_1778828810983_a85e98.json` and consistent with `library/assets/audio/prompts/` containing only `.gitkeep`). SFX (`success`, `error`, `completion`) are real files; prompt narration audio is not. This is silent scope slippage — no doc or memory entry flags TTS as deferred, it's just absent.

### 4.6 CI doesn't lint

`IMPLEMENTATION.md` § CI/CD lists lint (typescript-eslint) as running on every push. `.github/workflows/ci.yml` runs typecheck + unit tests only; no eslint dependency exists in `package.json`. Minor, but the doc overpromises what CI actually gates.

### 4.7 `runtime/public/` doesn't exist as documented

`ARCHITECTURE.md`'s repo-structure diagram shows `runtime/public/` for static assets. In the actual repo, `runtime/vite.config.ts` sets `publicDir` to `../library` directly — there's no `runtime/public/` directory at all; the library *is* the public dir. This is a reasonable simplification (avoids duplicating/copying assets) but it's a structural deviation from the documented layout, not just an implementation detail.

### 4.8 `pnpm cost-report` doesn't exist

`IMPLEMENTATION.md` § Cost monitoring specifies a weekly `pnpm cost-report` script aggregating LLM spend, plus a $5/batch hard-stop. Neither the script nor any token-cost aggregation exists in `package.json` or `generation/`. Per-run token counts are logged to stdout (`generate-cli.ts`: "tokens: X in / Y out") but nothing persists or aggregates them.

---

## 5. Things that are fine / not divergences (checked, ruled out)

- **LLM/pipeline boundary** — `prompt.ts` and `prompt-tap-to-select.ts` inject only slim template variables (themeHint, itemCount, division name, sprite lists), never raw `ConceptBrief`/`Division`/`MechanicSpec` objects. Matches `CLAUDE.md` invariant #2 and the boundary test in `IMPLEMENTATION.md` §3.
- **Layout inlining / one-consumer rule** — confirmed by grep: nothing under `runtime/` imports `mechanics/loader.ts`. Layout is resolved and inlined at store time, exactly as documented.
- **Doc updates from the 2026-05-15 session** (low→targetCount=3, difficulty-as-composite-function table, `mechanicId` field) are actually reflected in `ARCHITECTURE.md`/`IMPLEMENTATION.md` as currently checked out — not stale claims.
- **Prompt versioning discipline** — old prompt versions (v1–v10) are all still present, none deleted, matches convention.

---

## 6. Recommendation

Two things are worth a decision from you before more content gets generated:

1. **Auto-approve**: either formally amend `ARCHITECTURE.md`/`CLAUDE.md` to sanction it (drop Gate 3, or redefine it as "LLM review score ≥ threshold is entirely mandatory in place of human review" at your controlled 24 mo/N=1 volume), or re-wire `generate-cli.ts` to stage and require `pnpm review`. Right now the code and the docs disagree, and `CLAUDE.md` explicitly says that's not supposed to happen silently.
2. **Rejection logging**: independent of the auto-approve decision, Gate 1 and Gate 2 failures should call `rejectActivity()` before exiting. This is a small, low-risk fix and restores the invariant regardless of what you decide on manual review.

Everything else (regression tests, tap-to-select evals/integration tests, TTS, lint in CI, cost-report) is real backlog but not urgent — they're already tracked in `memory.md`'s Next steps / M5 done-when table, except TTS and the CI lint gap, which aren't tracked anywhere yet.
