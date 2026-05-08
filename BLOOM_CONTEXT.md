# BLOOM_CONTEXT.md

This document is for Claude (claude.ai conversations, not Claude Code) to load at the start of any future Bloom-related conversation. It captures who Ajay is, what Bloom is, what's been decided, and where the project stands. It is updated by Ajay periodically as the build progresses.

The other Bloom docs (`BLOOM_VISION.md`, `BLOOM_V1_PRD.md`, `BLOOM_V1_ARCHITECTURE.md`, `BLOOM_V1_IMPLEMENTATION.md`, `CLAUDE.md`) are the authoritative product/engineering artifacts. This doc is conversation context — what's needed to be a useful thinking partner, not what's needed to build.

---

## Who Ajay is

- VP Product at a $250M (valuation) health-tech company in India (Orange Health). Reports into the CEO/founder team. Real operational role, not a side project.
- Strong on product and business. Decent on systems thinking. Self-aware that storytelling is a weak point.
- Has built non-AI products before: an expense manager, a daily food management app, a loyalty platform for Orange Health.
- Has not built an AI-native product before. Bloom is the upgrade path.
- Builds with Claude Code. No traditional coding background.
- Wants truth-seeking and objective responses. Will explicitly call out appeasement. Doesn't want politeness theatre but doesn't want rudeness either.
- Calibrates fast. When he says "you're at the wrong level" or "you're missing context," he means it — adjust immediately and don't over-apologise.
- Has a daughter, Nitara (2-3 years old), who is the primary user of Bloom V1.

## How to talk to Ajay

- Peer-level on product, business, architecture, systems thinking. Do not over-explain frameworks he already holds (studio vs runtime, async vs realtime, deterministic vs probabilistic, multi-agent vs pipeline, eval-driven dev, etc.).
- Spend explanation budget on AI-craft specifics (prompt patterns, eval mechanics, specific failure modes, library/framework tradeoffs) — these are his stated learning goal.
- Be direct. Lead with the answer; reasoning follows. Disagreement is welcome and expected.
- Do not invent facts. If you don't know something (his name, a past decision, what's currently in the codebase), ask or check rather than confabulate.
- Avoid hedging language ("might want to consider," "perhaps," "could potentially"). State positions and back them.
- Length: scale to the question. Short questions get short answers. Strategic questions get structured answers. Don't pad.

## What Bloom is

A personalised, AI-generated activity studio for young children. Pre-generates a continuously growing library of age-appropriate activities, serves them via a runtime that feels native and zero-latency. Engagement is the product; learning is an outcome, not the promise.

V1 is for Nitara (ages 2-3, on shared iPad) and is a vertical slice through the architecture: all five layers (Framework, Concept, Mechanics, Generation, Runtime) exist, each minimally, with real handshakes between them.

Working name "Bloom" is a placeholder — replaceable.

## What's been decided (do not relitigate without flagging)

**Product positioning:**
- Engagement product, not learning product. Learning is downstream, not promised.
- Three candidate wedges: personalisation ("starring your child"), guilt-free screen time ("active not passive"), independent play ("30 min back for parents"). Not yet picked; deferred until V1 ships.
- Long-term ambition: global product, multi-format (activities + audio stories + video), competing with Cocomelon / Sago Mini / Lingokids. Real competitive set is Sago Mini and Lingokids.
- Two viable shapes long-term: $100M ARR venture path or $5-7M ARR profitable-small. Decision deferred. V1 is shaped to support either.

**Architecture (end state):**
- Studio (offline) + Library (boundary) + Personalisation + Online Delivery + Operator Surfaces. See `BLOOM_V1_ARCHITECTURE.md` for diagrams.
- Studio is async; runtime has zero LLM calls in hot path. 95% of work happens before the child opens the app.
- Personalisation is the moat, not generation. Generation is commoditisable; personalisation isn't.
- Production economics is a first-class constraint. Target gross margin 70%+ at 100K users.

**V1 architecture (subset of end state):**
- Five layers: Development Framework, Content Concept, Mechanics, Generation, Runtime.
- Framework, Concept, Mechanics are data layers. Generation is the AI-craft layer. Runtime is Phaser-on-iPad.
- File-based JSON storage. No DB. No auth. One child, one device.
- Activity library is the boundary between studio and runtime.

**V1 stack:**
- TypeScript everywhere. Node 20+. pnpm.
- Phaser 3 + Vite for runtime. Vercel hosting.
- Anthropic SDK for generation and review. OpenAI TTS HD for voice. zod for types/validation. vitest for tests.
- Free icon library (Flaticon/Iconify) for V1 art. Free SFX library for sound. AI-generated assets deferred to V1.5.

**V1 scope:**
- Two mechanics: drag-to-target and tap-to-select. iPad only.
- Three divisions: pincer grip, visual discrimination, receptive language.
- Age band 24-36 months only.
- 15-20 activities target.
- Parent picks from a categorised grid (no Selection Layer).
- No personalisation, no story arcs, no recurring characters.
- Generation pipeline: prompt → validate → LLM review → stage + preview → manual review → store.
- Three eval levels: schema, content, mechanic.

**V1 estimate:** ~7 weekends, realistically 9-10. Build in 6 milestones with explicit dependencies.

## What's deferred (with known landing places)

These are real future work, not vague gestures. Each has a known place in the end-state architecture:

- Selection Layer (replaces parent-pick grid)
- Personalisation Layer + Profile/Memory
- Story Layer (narrative continuity, character bibles)
- Asset Generation pipeline (visual + audio + voice with style consistency)
- Multi-format content (audio stories, video)
- Operator surfaces (parent surface, studio operator UI)
- Telemetry beyond local storage
- Auth, billing, multi-tenancy, compliance (COPPA / GDPR-K)

## Open questions / tensions worth tracking

These came up during planning, weren't fully resolved, and may need attention later:

- **Indian parent willingness-to-pay for engagement-without-learning.** The bet is real but unvalidated. Likely needs an "aspirational tier" that leans into learning, even if learning isn't the core.
- **Continuity vs novelty.** Parasocial attachment is the engagement driver, but continuity is age-bound (probably starts at 4+, not 2-3). V1 doesn't have to solve this; V2+ does.
- **Asset generation as eventual bottleneck.** Free library art works for V1. At scale, AI-generated assets with style consistency is genuinely hard and not yet planned.
- **Voice/audio strategy at multi-language scale.** Global product implies multi-language. TTS quality varies meaningfully across languages. Not a V1 problem; will be a real V2/V3 problem.
- **The showrunner question.** A continuity layer (light: a memory of "things this child's world contains") vs. a strong narrative arc system (heavy: seasons, themes, character development). Ajay leaned toward the lighter version. Worth re-examining as personalisation is built.

## Project history (compressed)

The conversation that produced V1's docs went through these phases:

1. **Tactical feedback** — Nitara tested 3 HTML games, loved them but interaction issues (drag-scroll conflict, weak feedback, subtle colours).
2. **Vision exploration** — Studio model, mechanics-as-IP, showrunner concept, episodic structure, multi-format expansion. Engagement-not-learning positioning emerged here.
3. **Business shape** — $100M venture path vs $5-7M profitable-small. Both viable. Decision deferred.
4. **Reset against Ajay's stated objectives** — engage Nitara, learn AI-native building, explore business. The conversation had drifted to business; reset to all three. Skipped objective #2 was flagged.
5. **V1 layered architecture** — Ajay's correction: V1 is not "ship 18 activities," it's "build minimal layers with real handshakes." This reframed the PRD significantly.
6. **Refinement** — manual review added (with static preview as the runtime-independent mechanism), TTS switched to OpenAI, hosting on Vercel, end-state diagram added to architecture.
7. **Document production** — Vision, PRD, Architecture, Implementation, CLAUDE.md created and iterated.
8. **Naming/identity cleanup** — file rename to `BLOOM_*` prefix; the embarrassing "Nikhil" hallucination corrected to Ajay.

## Current status

As of when this doc was created: V1 docs are complete. Ajay is moving to Claude Code to execute. Milestone 0 (project skeleton) is the next step.

**Update this section as the build progresses. Suggested format:**

- Current milestone: [M0 / M1 / M2 / M3 / M4 / M5 / M6]
- What's working: [brief description]
- What's blocked: [brief description if anything]
- Last updated: [date]

## Patterns from past conversations worth carrying forward

- Ajay sets clear priorities up front. When the conversation drifts, he calls it out. Don't let priorities slip silently — re-anchor proactively.
- He prefers fewer, sharper questions over many vague ones. When asking, batch questions and structure them.
- He's responsive to "I should have flagged this earlier" — but only if you actually flag it, not if you bury it. Be willing to admit miscalibration mid-conversation, not just at the end.
- He uses examples like "give me the math" to test whether claims hold up. Be ready to defend numbers, not just narratives.
- When he says "tell me what to do now" or "no fluff," collapse to action immediately. Strategic discussion gets paused, not extended.
- He pushes back on appeasement explicitly. If you find yourself agreeing across multiple turns, stop and check whether you're actually adding value or just nodding.
- He likes architecture-level conversations but resists premature implementation detail. Match the level he's working at.

## What to do at the start of a new conversation

1. Load this doc and the relevant Bloom artifact(s) for whatever Ajay's question is about.
2. Don't ask "where are we" or "remind me what we're working on" — that's what this doc is for. Read it, then engage.
3. If Ajay's question implies a state of the project that isn't reflected in this doc, ask him to update it (or offer to update it).
4. If the question is fresh — new direction, new feature, new strategy — engage at the level the question implies (peer-level on product/architecture, learning-mode on AI-craft).

---

*Maintained by Ajay. Updated as the project progresses. Not authoritative for product/engineering decisions — those live in the BLOOM_V1_* docs.*
