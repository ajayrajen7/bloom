# BLOOM_CONTEXT.md

This document is for Claude (claude.ai conversations, not Claude Code) to load at the start of any future Bloom-related conversation. It captures who Ajay is, what Bloom is, what's been decided, and where the project stands. It is updated by Ajay periodically as the build progresses.

The authoritative current artifacts are `BLOOM_VISION.md`, `bloom-v1.1-mvp-spec.md`, `BLOOM_V1_ARCHITECTURE_CANONICAL.md`, and its companion Mermaid diagram. `BLOOM_V1_IMPLEMENTATION.md` is the original V1 plan and is historical. This doc is conversation context — what's needed to be a useful thinking partner, not what's needed to build.

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

The restart MVP tests whether AI-generated assets can form a coherent library and whether activities using that library with two mechanics engage a child aged 2–3. Assets come first; mechanics and manual activity observation follow. The architecture is intentionally staged, with personalization deferred.

Working name "Bloom" is a placeholder — replaceable.

## What's been decided (do not relitigate without flagging)

**Product positioning:**
- Engagement product, not learning product. Learning is downstream, not promised.
- Three candidate wedges: personalisation ("starring your child"), guilt-free screen time ("active not passive"), independent play ("30 min back for parents"). Not yet picked; deferred until V1 ships.
- Long-term ambition: global product, multi-format (activities + audio stories + video), competing with Cocomelon / Sago Mini / Lingokids. Real competitive set is Sago Mini and Lingokids.
- Two viable shapes long-term: $100M ARR venture path or $5-7M ARR profitable-small. Decision deferred. V1 is shaped to support either.

**Earlier end-state hypotheses (not restart commitments):**
- The original architecture explored Studio + Library + Personalisation + Online Delivery + Operator Surfaces, with an async factory and no LLM calls in the runtime hot path. The current canonical layer map is in `BLOOM_V1_ARCHITECTURE_CANONICAL.md`.
- Personalisation, multi-format expansion, competitive positioning, business shape, and production-economics targets were explored as long-term hypotheses. They are not validated and are outside the restart experiment.

**Current restart scope:**
- The AI asset library is the first experiment: common fruits, vegetables, utensils, and familiar animals, with intentional variants and a consistent visual system.
- V1.1 mechanics: `tap-one` and `find-all`; drag-to-target is parked.
- Review the generated assets and both rendered activities manually, then observe actual tablet play.
- No fixed target of 90–100 assets or 15–20 activities.
- Name-in-audio personalization, child profiles, Pack Builder, and automated selection are deferred.
- See `bloom-v1.1-mvp-spec.md` and `BLOOM_V1_ARCHITECTURE_CANONICAL.md` for current acceptance criteria and system boundaries.

**Existing codebase stack (restart scope may extend it):**
- TypeScript, Node, pnpm; Phaser 3 + Vite for runtime; Vercel hosting was the original deployment choice.
- Anthropic SDK for activity generation/review; zod and vitest for types and tests.
- Recraft v4 is the primary image-generation model in the canonical architecture, with GPT Image 2 as a bounded comparison arm.
- OpenAI TTS and other personalized audio are not required for the restart.

The original V1 scope and schedule are historical; use the restart spec instead.

## What's deferred (with known landing places)

These ideas appeared in earlier planning. They remain possible future directions, not committed roadmap items; revisit them only after the restart experiment:

- Selection Layer (replaces parent-pick grid)
- Personalisation Layer + Profile/Memory
- Story Layer (narrative continuity, character bibles)
- Broader asset generation beyond the bounded V1.1 pilot
- Multi-format content (audio stories, video)
- Operator surfaces (parent surface, studio operator UI)
- Telemetry beyond local storage
- Auth, billing, multi-tenancy, compliance (COPPA / GDPR-K)

## Open questions / tensions worth tracking

These came up during planning, weren't fully resolved, and may need attention later:

- **Indian parent willingness-to-pay for engagement-without-learning.** The bet is real but unvalidated. Likely needs an "aspirational tier" that leans into learning, even if learning isn't the core.
- **Continuity vs novelty.** Parasocial attachment is the engagement driver, but continuity is age-bound (probably starts at 4+, not 2-3). V1 doesn't have to solve this; V2+ does.
- **Asset generation is the first restart risk to test.** The original downloaded assets varied in style, background, and apparent size. The pilot must show that AI generation plus normalization and curation can produce a coherent reusable library.
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
9. **Restart direction (2026-09)** — asset consistency identified as the first-build failure. Restart scope tests AI-generated asset-library quality first, then child engagement with activities using two mechanics. Name-in-audio personalization is deferred.

## Current status

As of 2026-09-26: Ajay is restarting after a pause. The current direction and document alignment are being completed before implementation. The two required claims are asset-library consistency and child engagement with activities made from that library. Name-in-audio personalization is deferred.

**Update this section as the build progresses. Suggested format:**

- Current milestone: Restart MVP design/document alignment
- What's working: Original build established an initial child-interest signal; canonical V1.1 architecture and restart spec now capture the new scope
- What's blocked: Implementation has not restarted; asset style/acceptance bar and pilot object list remain to be agreed
- Last updated: 2026-09-26

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
