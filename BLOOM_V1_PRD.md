# Bloom V1 — PRD

## Problem

A 2-3 year old child needs active engagement during the day. Currently available digital content is either passive (video), generic (mass-market apps), or janky (current HTML prototype where drag fights scroll, feedback is too subtle, and the child gets confused).

Hand-building activities does not scale. The team is one person learning to build AI-native products. There is no production pipeline. There are no reusable mechanics. Everything is one-off.

V1 has to solve two things at once:
1. Get one specific child (Nitara, 2-3) actively engaged on iPad with 15-20 working activities, soon.
2. Establish the **layered architecture** — Framework, Concept, Mechanics, Generation, Runtime — that every later version of the product will build on.

If V1 only solves (1), the work is throwaway. If it only solves (2), Nitara is bored. Both must happen.

## Goals

- Nitara plays Bloom activities daily, unprompted, with sustained engagement (>5 minutes per session, returns within 24 hours).
- 15-20 activities exist in the library by end of V1.
- All five V1 layers exist as real, separable components with clean handshakes between them.
- Generation pipeline works end-to-end: concept → generation → validation → review → storage.
- Builder has internalised the core AI-craft skills: prompt design, output schemas, evals, generation pipeline architecture.
- Runtime delivers crisp interactions on iPad — drag works, taps register, feedback is loud and clear.

## Non-goals (V1)

- No Selection Layer logic — parent picks from a categorised activity grid.
- No Personalisation Layer — activities are generic, not tuned to Nitara specifically.
- No Story Layer — no narrative arcs, recurring characters, or continuity between activities.
- No audio stories, video, or non-activity content.
- No parent dashboard or analytics surface beyond what's essential to operate the system.
- No accounts, auth, or multi-user. One child, one device.
- No app store presence. Web app via Safari, "Add to Home Screen" for full-screen.
- No AI-generated visual assets. Free icon library (Flaticon or similar) for V1 art.

## Users

- **Primary user (the child):** Nitara, 2-3 years old. Cannot read. Uses shared iPad. Plays alone or with parent nearby. Sessions of 5-15 minutes.
- **Secondary user (the parent):** You. Selects activity from grid, observes session, captures feedback after.

## Solution: Layered architecture

V1 builds **minimal versions of five layers** with real handshakes between them. The activities are the output. The layered system is the deliverable.

```
┌──────────────────────────────────────────────────────────┐
│  Development Framework Layer                             │
│  (Domains → Divisions → Milestones, as data)             │
└─────────────────┬────────────────────────────────────────┘
                  │ getDivisionsForAge(months) → Division[]
                  ▼
┌──────────────────────────────────────────────────────────┐
│  Content Concept Layer                                   │
│  (Produces concept briefs)                               │
└─────────────────┬────────────────────────────────────────┘
                  │ ConceptBrief
                  ▼
┌──────────────────────────────────────────────────────────┐
│  Generation Layer                                        │
│  (ConceptBrief + MechanicSpec → ActivityJSON)            │
│  Prompt → Validate → LLM Review → Stage → Manual Review  │
│  → Store                                                 │
└─────────────────┬────────────────────────────────────────┘
                  │ ActivityJSON + asset refs
                  │              ▲
                  │              │ getMechanicSpec(id)
                  │              │
                  ▼              │
              ┌───────────────────────┐
              │  Mechanics Layer      │
              │  (Specs read by both  │
              │   Generation & Runtime)│
              └───────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────┐
│  Runtime Layer                                           │
│  (Phaser. Loads ActivityJSON. Renders. Captures events.) │
└──────────────────────────────────────────────────────────┘
```

What follows: V1 spec for each layer, plus the handshake it exposes.

---

### Layer 1: Development Framework

**Purpose:** The science backbone. Defines what skills children develop at each age. Every activity traces back to a division (granular skill) defined here.

**V1 scope:**
- One file: `framework/framework-2-3.yaml`
- Contains domains, divisions, and milestones for ages 24-36 months only.
- Three divisions extracted formally:
  1. **Pincer grip / finger isolation** (Domain: Fine Motor)
  2. **Visual discrimination** (Domain: Cognitive)
  3. **Receptive language / following simple directions** (Domain: Language)
- Other domains and divisions can be stubbed or omitted in V1.

**Handshake exposed:**
```
getDivisionsForAge(ageMonths: number) → Division[]
getDivisionById(divisionId: string) → Division
```

A `Division` looks like:
```yaml
id: "fine_motor.pincer_grip"
name: "Pincer Grip / Finger Isolation"
domain: "fine_motor"
ageRangeMonths: [18, 48]
description: "The ability to use thumb and forefinger together..."
relatedMilestones:
  - "stacks_4_6_blocks"
  - "uses_spoon_with_accuracy"
designPrinciples:
  - "Targets must be large (min 80pt on iPad)"
  - "Drag distances should be short for younger end of range"
```

**V1 implementation:** Plain YAML file in repo. A small TypeScript module loads it and exposes the queries above. No DB. Hand-edited (with AI assistance).

---

### Layer 2: Content Concept Layer

**Purpose:** Produces concept briefs that tell the Generation Layer *what* to make. A concept is the "story" — the intent — that Generation turns into a working activity.

**V1 scope:**
- A simple module that produces concept briefs.
- For V1, concepts are authored by hand via a CLI script — `scripts/new-concept.ts` — that walks you through producing one. Eventually this becomes more automated; for V1, it's a structured form.
- Concept axes for V1:
  - Setting: indoor only
  - Difficulty: low / medium / high (within age 2-3)
  - Format: digital activity only

**Handshake exposed:**
```typescript
ConceptBrief {
  id: string
  targetDivisionId: string  // → Framework
  secondaryDivisionId?: string
  ageMonths: { min: number, max: number }
  difficulty: "low" | "medium" | "high"
  themeHint: string  // e.g., "fruits and baskets", "farm animals"
  targetDurationSeconds: number  // soft target — drives generation, not runtime cutoff
  notes?: string  // free-text guidance for the generation prompt
}
```

**V1 implementation:** TypeScript module + a CLI script. Concept briefs stored as JSON files in `concepts/`. Each concept gets a unique ID.

---

### Layer 3: Mechanics Layer

**Purpose:** Defines *how* an activity works mechanically. If the concept is the story, the mechanic is the script. Mechanics are reusable — one mechanic supports many concepts.

**V1 scope:** Two mechanics, each fully specified:
1. **drag-to-target**
2. **tap-to-select**

Each mechanic spec:
- Declares its slot schema (what content it needs)
- Declares its parameter schema (what tunes difficulty)
- Declares its rendering contract (what the runtime expects to receive)

**Handshake exposed:**
```
getMechanicSpec(mechanicId: string) → MechanicSpec
```

A `MechanicSpec` looks like:
```yaml
id: "drag-to-target"
name: "Drag to Target"
description: "Child drags items to the correct target zones."
deviceCompatibility: ["ipad"]
slotSchema:
  items:
    type: "array"
    minLength: 3
    maxLength: 7
    itemShape:
      assetRef: "string"
      label: "string"
      targetId: "string"  # which target this item belongs to
  targets:
    type: "array"
    minLength: 2
    maxLength: 4
    itemShape:
      id: "string"
      assetRef: "string"
      label: "string"
  distractors:
    type: "array"
    minLength: 0
    maxLength: 2
parameterSchema:
  itemCount: { type: "number", range: [3, 7] }
  distractorCount: { type: "number", range: [0, 2] }
  visualSimilarity: { type: "enum", values: ["low", "medium", "high"] }
  spacing: { type: "enum", values: ["generous", "normal", "tight"] }
```

**V1 implementation:** YAML files in `mechanics/`. A TypeScript module loads them and exposes lookups. Generation reads MechanicSpecs to know what to generate; Runtime reads them to know how to render and validate slot data.

---

### Layer 4: Generation Layer

**Purpose:** Takes a concept brief + a mechanic spec, produces a complete, validated, reviewed activity ready for the runtime. This is where the AI craft lives.

**V1 scope:** Full pipeline with three phases and three quality gates.

**Core principle: minimise the LLM's decision surface.** The pipeline computes everything deterministic (id, metadata, parameters, audio refs, layout). The LLM handles only creative decisions (items, targets, item-to-target mapping, prompt text).

**Phase 1 — Deterministic preparation (prompt.ts, no LLM).**
- Reads the ConceptBrief, Division, and MechanicSpec.
- Computes itemCount, targetCount, layoutId from difficulty (deterministic mapping).
- Reads sprites directory for available asset list.
- Builds prompt template with specific values injected. No raw domain objects sent to LLM.

**Phase 2 — LLM call + assembly (prompt.ts).**
- Claude receives a prompt with fixed constraints and returns only: items, targets, item-to-target mapping, prompt text.
- Pipeline assembles full ActivityJSON by combining LLM creative output with deterministic fields.

**Gate 1 — Validate (programmatic).** validate.ts.
- Schema validation against ActivityJSONSchema.
- Asset reference resolution (do referenced sprites exist on disk?).
- Parameter bounds checking.
- targetId referential integrity (every item's targetId matches a target).
- Item/target count validation.
- Fast, free, deterministic. Catches structural failures before the expensive LLM review.

**Gate 2 — Review (LLM).** llm-review.ts. A separate Claude call evaluates the activity on semantic and qualitative dimensions only. Does NOT re-check anything validate.ts already verified. Evaluates:
- Age-appropriateness (are objects recognisable to a 2-year-old? is vocabulary in range?)
- On-brief (does it target the stated division? does the theme match?)
- Safety (culturally neutral, no negative associations, mapping logic consistent)
- Engagement (prompt creates clear call to action, theme is motivating)

Returns binary pass/fail per dimension, a quality score, and structured issues list.

**Gate 3 — Stage + Manual Review.**
- stage.ts writes to `library/staged/<id>.json` and generates a static HTML preview (visual preview + JSON + reviewer notes).
- `pnpm review` opens previews in browser. For each: `pnpm approve <id>` or `pnpm reject <id> --reason "<text>"`.
- Rejections logged to `library/rejected/` and feed the eval set as new test cases.

**Store.** Approved activities → `library/activities/<id>.json`.

**Eval set (V1):**
- 10 test cases minimum. Each is a fixed ConceptBrief run through the full pipeline with assertions on the assembled ActivityJSON.
- Runs via `pnpm eval` before any prompt version bump. Manual, not in CI.
- Grows from rejections at any gate. Every new failure pattern becomes a new eval case.

**Handshake exposed:**
```
generateActivity(conceptId: string) → ActivityJSON | RejectionReason
```

An `ActivityJSON` looks like:
```yaml
id: "act_001"
conceptId: "concept_001"
mechanicId: "drag-to-target"
generatedAt: "2026-05-08T..."
filledSlots:
  items: [...]
  targets: [...]
  distractors: [...]
parameters:
  itemCount: 5
  distractorCount: 1
  visualSimilarity: "low"
  spacing: "generous"
prompt:
  text: "Help the apples find their basket!"
  audioRef: "audio/prompts/act_001.mp3"
audioRefs:
  successSfx: "audio/sfx/success_bright.mp3"
  errorSfx: "audio/sfx/try_again.mp3"
  completionSfx: "audio/sfx/celebration.mp3"
metadata:
  targetDivisionId: "fine_motor.pincer_grip"
  ageMonths: { min: 24, max: 36 }
  difficulty: "low"
  targetDurationSeconds: 45
  reviewScore: 0.92
  reviewerNotes: "..."
```

**V1 implementation:** TypeScript module. Uses Claude API. Prompts stored as versioned files (`prompts/generate-drag-to-target.v1.txt`). Eval set in `evals/` with a runner script.

---

### Layer 5: Runtime Layer

**Purpose:** Renders activities for the child. Captures interaction events. Zero LLM calls in the hot path. Loads from the activity library.

**V1 scope:**
- **Stack:** Phaser 3, served as a web app, accessed via Safari on iPad, "Add to Home Screen" for full-screen.
- **First screen (Selection screen):** Activity grid, categorised by mechanic type and difficulty level. Parent picks one.
- **Activity screen:** Loads activity JSON, renders mechanic with filled slots, handles interactions.
- **Completion screen:** Celebration + parent rating prompt ("loved it / fine / bailed").
- **Telemetry:** Captures activity start, completion, abandonment, time-to-complete, parent rating. Stored locally for V1.

**Handshake consumed:**
```
loadActivity(activityId: string) → ActivityJSON
recordSession(sessionData: SessionRecord) → void
```

**V1 implementation:**
- Phaser 3 + TypeScript + Vite for build.
- Routes: `/` (selection grid), `/play/:activityId` (activity), `/complete/:activityId` (rating).
- Sessions stored as JSON files via a tiny backend, with localStorage fallback.

---

## Activity template design

Every V1 activity follows the same screen anatomy. This is the design contract between content, runtime, and child.

### Screen layout (iPad, landscape)

```
+------------------------------------------------------+
|  [PROMPT AREA — top 15%]                             |
|  Audio cue plays on activity start                   |
|  Visual prompt (large icon or character)             |
+------------------------------------------------------+
|                                                      |
|  [PLAY AREA — middle 70%]                            |
|  Interactive elements (items, targets) live here     |
|  High-contrast, bold colours                         |
|  Min 48pt spacing between interactive elements       |
|                                                      |
+------------------------------------------------------+
|  [PROGRESS / FEEDBACK AREA — bottom 15%]             |
|  Progress dots showing items remaining               |
|  Success animations and sounds play here             |
+------------------------------------------------------+
```

### Interaction spec

**Drag-to-target mechanic:**
- Item touch-down: visual lift (scale 1.1x, slight shadow).
- During drag: item follows finger with no lag. No screen-scroll occurs during drag.
- Item dragged within 60pt of correct target: target highlights (gentle pulse). On release: item snaps to target, success animation + sound.
- Item dragged within 60pt of incorrect target: target does not highlight. On release: item gently bounces back. Soft "try again" sound. No punishing feedback.
- Item dragged elsewhere and released: item gently returns to start.

**Tap-to-select mechanic:**
- Touch-down: brief scale animation (1.1x).
- Tap-up correct: success animation (item glows, scales, plays sound), item disappears or marks completed.
- Tap-up incorrect: gentle shake + soft sound. No item state change.

**Feedback design (both mechanics):**
- Success sound: bright, distinct, ~0.5s. Like a coin in a video game — unambiguously positive.
- Success visual: scale-and-glow on item, brief celebration in feedback area.
- Failure feedback: never harsh. Soft sound, gentle visual.
- Activity completion: 2-3 second celebration (sound + animation).

### Time as a variable

Every activity has `targetDurationSeconds` set at generation time. This is a **soft target**, not a hard cutoff:

- It influences generation parameters: 30s → 3-4 items, low difficulty; 60s → 5-7 items, higher difficulty.
- It is recorded in metadata for later analysis (did Nitara complete a 60s activity in 60s, or abandon at 30s?).
- The runtime does not interrupt mid-play. Activities end on completion or explicit abandonment, not on timer.
- A hard time-box mode may be added later as a separate session type.

### Difficulty parameters

Difficulty is controlled by mechanic parameters, set in the activity JSON:

- **Item count:** 3 (low) / 5 (medium) / 7 (high)
- **Distractor count:** 0 / 1 / 2
- **Visual similarity:** how similar incorrect targets look to correct ones
- **Spacing:** generous / normal / tight

Same mechanic + different difficulty parameters = different activity. This is how the library scales.

### Audio

- Voice prompts: TTS at generation time. **Default: OpenAI TTS HD** (warm voices, simple integration, ~$30/1M chars — pennies at V1 volume). Austerity alternative: Google Cloud TTS WaveNet (~$16/1M chars, slightly worse voices, more setup overhead).
- Sound effects: free library (Freesound / Mixkit). One shared set across V1 activities.
- All audio bundled with the activity. No real-time generation.

### Visual style

- Library art only for V1 (Flaticon, Iconify, Open Peeps).
- Style guide: bold, saturated colours; high contrast; rounded shapes; no fine detail.
- Single visual style across V1. Consistency over variety.

---

## Activity scope, by mechanic

**Drag-to-target — 12 activities**
- 3 themes × 3 difficulty levels = 9 activities, plus 3 thematic variations
- Themes: fruits-into-baskets, animals-to-homes, shapes-to-outlines

**Tap-to-select — 6-8 activities**
- 2-3 themes × 3 difficulty levels
- Themes: find-the-colour, find-the-animal, find-the-shape

Total: 18-20 activities.

---

## Success criteria

V1 ships when all of these are true:

1. **Architectural:** All five layers exist as separate, testable modules. Each handshake is explicit, typed, and exercised by integration tests.
2. **Content:** 15+ activities in `library/`, all having passed full pipeline (validate + review + render).
3. **Engagement:** Nitara has played activities across at least 3 sessions. At least one session was unprompted (she asked for it).
4. **Interaction:** The prior issues (drag-scroll conflict, weak feedback, subtle colours) are resolved — measured by Nitara completing activities without confusion or accidental scrolling.
5. **Pipeline:** A new activity can be generated end-to-end in under 15 minutes of human time, given a concept input.
6. **Builder skill:** Builder can articulate, without notes: how the generation prompt is structured, what each level of eval checks, what the activity JSON schema is, and how the runtime consumes it.

V1 is **not** about subscription, distribution, or other parents.

---

## Decided

- **TTS provider:** OpenAI TTS HD. Austerity alternative is Google Cloud TTS WaveNet.
- **Hosting:** Vercel.
- **Backend storage:** File-based JSON for V1. Migrate to Postgres in V1.5.

## Open decisions

- **Eval count:** Start at 10 cases. Grow as failures are observed.
- **LLM review threshold:** Placeholder 0.85. Calibrate against first batch of generations.
- **Manual review batch size:** Start with reviewing all activities individually. Move to batched / spot-check review once LLM reviewer is well-calibrated.

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Phaser learning curve eats early weekends | Time-box. If drag isn't crisp by end of Weekend 2, fall back to one polished hand-built activity for Nitara that weekend; continue Phaser work in parallel. |
| TTS audio sounds wrong for a 2yo | Test 3 OpenAI HD voices on Nitara before committing. Have human-recorded fallback for top 5 prompts. |
| Generation produces bad activities | Programmatic + LLM review is mandatory. No activity reaches runtime without passing both. |
| Free art library missing key items | Pre-check Flaticon for farm animals, baskets, shapes, fruits before locking themes. |
| Layer abstractions over-engineered for V1 | Each layer must be the *minimum thing* that exposes the right handshake. If a layer's V1 is more than ~200 lines of code, question it. |

## What "done" looks like

A 5-minute demo:
1. You hand Nitara the iPad.
2. She sees the Selection screen — activities categorised by type and difficulty.
3. Parent picks one. Activity loads instantly. Audio prompt plays. Nitara understands what to do.
4. She drags items. Drag is crisp. Feedback is loud. She completes the activity.
5. Celebration plays. She asks to do another one.
6. Parent rates the session: "loved it."

**Plus:** builder shows a new activity being generated end-to-end in under 15 minutes — concept brief → Claude generates → validation passes → review passes → activity is in the library and playable.

That's V1.
