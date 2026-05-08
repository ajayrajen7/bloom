# Bloom — Session Memory

Read this at the start of every session. Update it proactively when context approaches ~80%, and at the end of every session.

---

## Current milestone

- **Active:** M1 — Runtime drag-to-target on iPad
- **Status:** Not started

---

## What's been built

**M0 — complete**
- `package.json` — pnpm workspace, all scripts wired (`test`, `typecheck`, `dev`, `build`, `generate`, `new-concept`, `review`, `eval`)
- `tsconfig.json` — strict mode, ESNext, path alias `shared/*`
- `runtime/tsconfig.json` — runtime-specific TS config
- `vitest.config.ts` — test runner config with `shared/` alias
- `runtime/vite.config.ts` — Vite build config
- `shared/types.ts` — all 6 zod schemas: `Division`, `ConceptBrief`, `MechanicSpec`, `ActivityJSON`, `SessionRecord`, `RejectionReason`
- `shared/types.test.ts` — 21 unit tests, all passing. Round-trip + failure cases for every schema.
- `runtime/index.html` — Phaser app entry point, mobile meta tags
- `runtime/src/main.ts` — Phaser game config, `BootScene` loaded
- `runtime/src/scenes/boot.ts` — shows "Bloom" on screen
- `runtime/src/scenes/selection.ts` — placeholder (M4)
- `runtime/src/scenes/activity.ts` — placeholder (M1)
- `runtime/src/scenes/completion.ts` — placeholder (M4)
- `runtime/src/mechanics/drag-to-target.ts` — placeholder (M1)
- `runtime/src/mechanics/tap-to-select.ts` — placeholder (M5)
- `.github/workflows/ci.yml` — CI: typecheck + unit tests on push, build on PR to main
- `.gitignore`
- Full directory structure per `BLOOM_V1_ARCHITECTURE.md`
- `pnpm install` clean, `pnpm test` 21/21, `pnpm typecheck` clean, `pnpm build` clean

---

## In progress

Nothing. M0 complete.

---

## Last decisions / changes made

| Decision | Date |
|----------|------|
| Used `onlyBuiltDependencies: ["esbuild"]` in package.json to unblock pnpm v11 build script approval for esbuild (required by vite/vitest) | 2026-05-08 |
| Node version on machine is v23.5.0 (above the v20+ spec requirement — no issue) | 2026-05-08 |

---

## Doc changes made during execution

| Doc | Change | Date |
|-----|--------|------|
| — | — | — |

---

## Blockers

None.

---

## Next steps

Start M1: Phaser drag-to-target activity on iPad.
1. Implement `ActivityScene` with hardcoded apple-in-basket activity
2. Drag-to-target mechanic: item lift, drag (no scroll conflict), snap to correct target, bounce-back on incorrect, completion celebration
3. Free-library art for items + targets, SFX from Freesound/Mixkit
4. Touch input via Phaser input system only (no DOM)
5. Test on actual iPad via Vercel preview URL
6. Integration test: programmatically trigger drag, verify completion

---

## Session log

| Date | What happened |
|------|---------------|
| 2026-05-08 | Project context loaded. Docs complete. memory.md created. |
| 2026-05-08 | M0 complete. pnpm workspace, all configs, shared types (6 schemas, 21 tests), empty Phaser app, CI all done. Tests green. |
