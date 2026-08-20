# Bloom V1 — Architecture (HLD)

This document captures the high-level architecture for Bloom V1. It defines the layers, their responsibilities, the contracts between them, and the key technical decisions. Implementation details — specific TypeScript interfaces, test strategy, file-by-file specs, build order — live in `IMPLEMENTATION.md`, not here.

This document is the persistent contract. It changes rarely. The implementation plan changes often.

## V1.1 addendum

`BLOOM_V1.1_MVP_SPEC.md` rescoped *content* (settings-based instead of division-targeted, tap-one + find-all instead of drag-to-target + tap-to-select, AI-generated asset manifest instead of Flaticon). This document's architecture — the five layers, the studio/runtime split, the generation pipeline's three phases, the LLM/pipeline boundary — stands unchanged; V1.1 is a scope change, not an architecture change.

`BLOOM_ARCHITECTURE_CANONICAL.mermaid` is the current canonical diagram, using different names for the same shape:

| This doc (5 layers) | Canonical diagram (3 planes) |
|---|---|
| Development Framework | A1 (Plane A — now a static doc, not a queried per-brief system) |
| Content Concept Layer | A2 (Plane A — "in prompts" / `concepts/settings.yaml` + expander, thinner than the V1 hand-authored-briefs model) |
| Mechanics Layer | A3 (Plane A) |
| — (new) | A4 Story/Theme Engine (Plane A — V1.1: 6 settings, 1 intro line each; not a real story layer, see PRD non-goals) |
| — (new) | A5 Asset Registry (Plane A — the new AI-generated sprite manifest, §4 of the V1.1 spec; **full build for V1.1**, this is the piece that failed before) |
| Generation Layer | A6 (Plane A) — unchanged pipeline shape, gate policy changed (see below) |
| Activity Library | A8 (boundary between Plane A and Plane B — unchanged) |
| — (new) | Plane B Distribution: B1 Pack Builder (`build-pack` CLI) — resolves `{childName}` and calls TTS **at pack-build time**, not generation time. New addition, not in the original 5-layer model. |
| Runtime Layer | Plane C (C1 Child Context / C2 Selection Engine / C3 Child Runtime / C4 Assessment / C5 Parent Surface — C3 is what this doc calls the Runtime Layer; C1/C2/C4/C5 are mostly still stubs, per the diagram's own `stub`/`thin` classing) |

**Gate policy delta (Phase 3 of the generation pipeline, below):** Gate 3 in this document's diagram is drawn as mandatory per-activity human review. As of 2026-05-15 the pipeline auto-approves after Gate 2 (see `STATE_OF_REPO_2026-08-18.md` §4.1 for how that happened without going through this file's own contradiction process). V1.1's canonical diagram's `G1` gate — "evals + multimodal review + sampled human" — formalizes this: the human check moves from per-activity staging to a per-batch iPad sample. `library/staged/` and `pnpm review` stay in the repo (parked) but are not in the active pipeline path.

**Gate 2 delta:** V1.1 adds a multimodal pass to Gate 2 — the LLM review call receives a rendered screenshot of the actual Phaser scene alongside the JSON (not the static preview HTML, which isn't what the child sees). New checks: visual crowding, target/distractor visual distinctness vs. intended difficulty, sprite/backdrop contrast. Lands in M8.

**Asset pipeline delta:** §"Visual assets: free icon library" below is superseded. See `BLOOM_V1.1_MVP_SPEC.md` §4 for the sheet-generation → slice → normalize → palette-snap → curate → manifest pipeline, landing in M7 (asset spike) and M8 (pipeline wiring).

## End-state architecture

Before describing V1, here is the steady-state architecture Bloom is being built towards. V1 is a deliberate subset of this — the portions that prove the foundational claims of the system.

```mermaid
graph TB
    subgraph Studio["OFFLINE STUDIO (content production)"]
        FW[Development Framework]
        CL[Content Concept Layer]
        ML[Mechanics Layer]
        SL[Story Layer]
        GL[Generation Layer<br/>prompt → validate → review<br/>→ stage → manual review → store]
        AG[Asset Generation<br/>visual + audio + voice]

        FW --> CL
        FW --> SL
        CL --> GL
        ML --> GL
        SL --> GL
        AG --> GL
    end

    subgraph Library["CONTENT LIBRARY (the boundary)"]
        LIB[(Activities<br/>Audio stories<br/>Video<br/>Physical activity guides)]
    end

    subgraph Personalisation["PER-CHILD STATE"]
        PROF[(Profile + Memory<br/>age, preferences, world,<br/>recurring characters,<br/>play history)]
        PL[Personalisation Layer<br/>generic content + profile<br/>→ personalised content]
    end

    subgraph Delivery["ONLINE DELIVERY"]
        SEL[Selection Layer<br/>what to play next]
        RT[Runtime Layer<br/>multi-modal renderer]
        TEL[Telemetry / Feedback]
    end

    subgraph Surfaces["OPERATOR SURFACES"]
        PS[Parent Surface]
        OS[Studio Operator UI<br/>review, prompts, evals]
    end

    GL --> LIB
    AG --> LIB
    LIB --> PL
    PROF --> PL
    PROF --> SEL
    PL --> SEL
    SEL --> RT
    RT --> TEL
    TEL --> PROF
    TEL --> OS
    PROF --> PS
    RT --> PS

    style Studio fill:#e8f4f8
    style Library fill:#fef9e7
    style Personalisation fill:#fdedec
    style Delivery fill:#eafaf1
    style Surfaces fill:#f4ecf7
```

**What this picture says:**

- The studio produces generic content. Lots of it. Across formats. Reviewed by humans before it ships.
- The library is the boundary. Everything past it is per-child and online.
- Personalisation transforms generic content into child-specific content. This is the moat — the thing competitors will struggle to replicate.
- Selection picks what to play. Runtime delivers it. Telemetry feeds back into profile and into eval systems for the studio.
- Operator surfaces (for parents, for the internal studio team) are real components, not afterthoughts.

**What V1 builds, marked on the picture:**

```mermaid
graph TB
    subgraph V1["V1 SCOPE"]
        FW[Development Framework]
        CL[Content Concept Layer]
        ML[Mechanics Layer]
        GL[Generation Layer]
        LIB[(Activity Library)]
        RT[Runtime Layer]

        FW --> CL
        CL --> GL
        ML --> GL
        GL --> LIB
        LIB --> RT
        ML -.-> RT
    end

    subgraph Deferred["DEFERRED"]
        SL2[Story Layer]
        AG2[Asset Generation]
        PROF2[Profile + Memory]
        PL2[Personalisation Layer]
        SEL2[Selection Layer]
        TEL2[Telemetry beyond local]
        PS2[Parent Surface]
        OS2[Studio Operator UI]
        MM2[Multi-format content]
    end

    style V1 fill:#d4efdf
    style Deferred fill:#f5f5f5
```

**V1 is the spine.** Studio production → library → runtime. Single age band, single content format, single child. No personalisation, no selection, no story. The smallest possible system that proves the architecture works end-to-end and produces content a real child enjoys.

Everything deferred is real future work, not vague gestures. Each deferred component has a known place in the end-state picture — the V1 layers are shaped to receive them when their time comes.

## V1 system overview

V1 is a **studio-style content production system** plus a **runtime** that delivers the produced content to a child.

The studio side is offline — it produces, validates, reviews, and stores activities ahead of time. The runtime side is online — it serves activities to the child with no LLM calls in the hot path.

Five layers. Two zones (offline studio / online runtime). One handoff between them: the activity library.

```mermaid
graph TB
    subgraph "Offline Studio"
        FW[Development Framework]
        CL[Content Concept Layer]
        ML[Mechanics Layer]
        GL[Generation Layer]
        FW --> CL
        CL --> GL
        ML --> GL
    end

    subgraph "Activity Library"
        LIB[(library/activities/<br/>JSON files)]
    end

    subgraph "Online Runtime"
        RT[Runtime Layer<br/>Phaser]
    end

    GL --> LIB
    LIB --> RT
    ML -.read by.-> RT

    style LIB fill:#f9e79f
    style FW fill:#d6eaf8
    style CL fill:#d6eaf8
    style ML fill:#d6eaf8
    style GL fill:#d6eaf8
    style RT fill:#d4efdf
```

The library is the boundary. Studio writes to it; runtime reads from it. They share nothing else at runtime.

## Layer responsibilities

### Development Framework

**What it is:** The science backbone. Defines domains, divisions (granular skills), and milestones for each age band.

**What it owns:** The data file(s) and the query interface to them.

**What it does not own:** Anything about activities, mechanics, or rendering. It is content-pure.

**Handshake:** Exposes lookups by age and by ID. Returns Division objects to callers.

### Content Concept Layer

**What it is:** The brief generator. Produces concept briefs that tell the Generation Layer what to make.

**What it owns:** The shape of a ConceptBrief, the authoring tool that produces them, the storage of authored briefs.

**What it does not own:** How concepts get turned into activities. That's Generation's job.

**Handshake:** Reads from the Framework. Produces ConceptBriefs that reference division IDs.

### Mechanics Layer

**What it is:** The script library. Each mechanic spec defines what content slots it needs, what parameters tune its difficulty, and how the runtime should lay out the play area.

**What it owns:** Mechanic specs (data) and the lookup interface. Each spec includes:
- `slotSchema` — the content slots the LLM must fill (items, targets, distractors, etc.)
- `parameterSchema` — tuning knobs (itemCount, difficulty, visualSimilarity, etc.)
- `layouts[]` — named layout variants. Each variant defines zones (e.g. `item_zone`, `target_zone`), the arrangement type within each zone (linear, grid, circular, random), and element size and count constraints. The generation layer selects a layout variant per activity; the runtime executes it.

**What it does not own:** Mechanic *implementation* (rendering logic). That lives in the Runtime Layer. The spec is the contract; the runtime is the executor.

**Handshake:** Read by Generation (to know what to generate and what layouts are available). Layout data is resolved at store time and inlined into the ActivityJSON — the runtime reads the activity, not the spec directly.

### Generation Layer

**What it is:** The factory. Takes a concept brief and a mechanic spec, produces a validated, reviewed activity.

**What it owns:** The generation pipeline (six sub-stages — see below), prompts, the eval set, the staging area, the manual review surface, and final storage.

**What it does not own:** Where activities are consumed (runtime). It produces and stores; runtime takes it from there.

**Handshake:** Reads ConceptBriefs and MechanicSpecs. Produces ActivityJSONs in the library.

### Runtime Layer

**What it is:** The delivery system. Loads activities from the library and presents them to the child.

**What it owns:** The Phaser app, the screens (Selection, Activity, Completion), the asset loading, the input handling, the session telemetry capture.

**What it does not own:** Any content production or presentation decisions. The runtime is dumb — it renders exactly what the activity JSON tells it to. Layout, element counts, arrangement — all resolved before the activity reaches the runtime.

**Core principle: rendering is dumb.** The ActivityJSON is self-describing. The runtime makes no decisions about how to lay out content; those decisions are made at generate-time and encoded in the activity. This makes activities testable, portable, and reproducible.

**Handshake:** Reads ActivityJSONs from the library. The activity JSON includes an inlined layout variant (placed there by the generation pipeline at store time). Writes session records to local storage.

## Generation pipeline

The Generation Layer is the most complex. It has internal stages grouped into three phases: deterministic preparation, LLM call, and quality gates.

### Pipeline internals: LLM vs pipeline boundary

The core design principle: **minimise the LLM's decision surface.** The pipeline computes everything it can deterministically. The LLM handles only creative decisions that require semantic judgment.

**The LLM decides:** items, targets, item-to-target mapping, prompt text.

**The pipeline owns:** id, conceptId, mechanicId, generatedAt, layoutId, itemCount, targetCount, distractorCount, visualSimilarity, audioRef paths, all audioRefs, all metadata fields.

```mermaid
graph TB
    subgraph Prep["PHASE 1: DETERMINISTIC PREP (prompt.ts)"]
        R[Read Framework, Mechanics, Sprites]
        C[Compute: difficulty → itemCount, targetCount, layoutId]
        B[Build prompt template with fixed values injected]
        R --> C --> B
    end

    subgraph LLM["PHASE 2: LLM CALL (prompt.ts)"]
        CALL[Claude API: returns items, targets, mapping, prompt text]
        ASM[Assemble: LLM output + deterministic params = ActivityJSON]
        CALL --> ASM
    end

    subgraph Gates["PHASE 3: QUALITY GATES"]
        V[Gate 1: validate.ts — programmatic]
        LR[Gate 2: llm-review.ts — separate Claude call]
        S[Stage + Preview HTML]
        MR[Gate 3: Manual review — human, in browser]
        ST[store.ts — move to library]
        V -- pass --> LR
        V -- fail --> R1[(rejected/)]
        LR -- pass --> S
        LR -- fail --> R2[(rejected/)]
        S --> MR
        MR -- approve --> ST
        MR -- reject --> R3[(rejected/)]
        MR -- regenerate --> CALL
        ST --> LIB[(library/activities/)]
    end

    B --> CALL
    ASM --> V

    style Prep fill:#d4efdf
    style LLM fill:#fcf3cf
    style Gates fill:#fadbd8
```

### Phase 1: Deterministic preparation (prompt.ts)

Before calling the LLM, the pipeline:

1. Reads the ConceptBrief, Division (via Framework loader), and MechanicSpec (via Mechanics loader).
2. Computes deterministic parameters from difficulty (difficulty is a composite function — all axes scale together):
   - low:    itemCount=3, targetCount=3, distractorCount=0, visualSimilarity=low,    layoutId="horizontal-standard"
   - medium: itemCount=5, targetCount=3, distractorCount=1, visualSimilarity=medium, layoutId="horizontal-standard"
   - high:   itemCount=6, targetCount=4, distractorCount=2, visualSimilarity=high,   layoutId="horizontal-standard"
3. Reads itemSprites and targetSprites from the ConceptBrief to build a filtered sprite list scoped to this concept's theme.
4. Builds the prompt by injecting specific values into the template: themeHint, itemCount, targetCount, division name, design principles, available sprites. No raw domain objects are injected.

### Phase 2: LLM call and assembly (prompt.ts)

The LLM receives a prompt with fixed constraints and returns only:

```typescript
{
  _reasoning?: string;   // design thinking — stripped after parsing
  filledSlots: {
    items: Array<{ id: string; targetId: string; label: string; assetRef: string }>;
    targets: Array<{ id: string; label: string; assetRef: string }>;
    distractors: [];
  };
  prompt: { text: string };
}
```

The pipeline strips `_reasoning`, validates the response against `LLMGenerationOutputSchema`, then assembles the full ActivityJSON by combining the LLM's creative output with pipeline-computed fields (id, metadata, audioRefs, parameters, etc.).

### Phase 3: Quality gates

Three sequential gates. Every rejection is logged to `library/rejected/` with a structured reason. Rejection reasons grow the eval set over time.

**Gate 1 — validate.ts (programmatic, free, fast).** Schema validation, asset ref resolution (do sprites exist on disk?), parameter bounds, targetId referential integrity, item/target count checks. No LLM call. Catches structural failures before the expensive review step.

**Gate 2 — llm-review.ts (separate Claude call).** Semantic and qualitative review only. Does NOT duplicate checks from validate.ts. Evaluates: age-appropriateness of labels and objects, logical consistency of item-to-target mapping, cultural safety, prompt quality, theme coherence. Returns binary pass/fail per dimension plus a quality score and structured issues list.

**Gate 3 — Manual review (human).** `pnpm review` opens staged preview HTML pages. For each activity: approve (`pnpm approve <id>`), reject (`pnpm reject <id> --reason "<text>"`), or regenerate. Review in batches of 5–10.

**store.ts** moves approved activities from `library/staged/` to `library/activities/`.

### Eval harness

Eval sits beside the pipeline, not in it. It is a separate test harness that runs the full pipeline (with real or mocked LLM calls) against fixed test cases and asserts properties on the **assembled ActivityJSON**.

- Runs via `pnpm eval`. Manual, not in CI — each run costs money.
- Runs before any prompt version bump. Pass rate must hold or improve.
- Grows from rejections at any gate. New failure patterns become new eval cases.
- V1 starts with ~10 hand-authored cases. Target ~25 by end of V1.

## Runtime architecture

```mermaid
graph TB
    User[Parent + Child] --> SS[Selection Screen<br/>activity grid]
    SS --> AS[Activity Screen<br/>Phaser scene]
    AS --> CS[Completion Screen<br/>celebration + rating]
    CS --> SS

    LIB[(library/activities/)] --> SS
    LIB --> AS

    AS --> TEL[Session Telemetry<br/>local storage]

    style SS fill:#d4efdf
    style AS fill:#d4efdf
    style CS fill:#d4efdf
    style LIB fill:#f9e79f
    style MS fill:#d6eaf8
```

**Three screens:**

- **Selection screen** — categorised activity grid. Parent picks. (V1's substitute for the Selection Layer.)
- **Activity screen** — Phaser scene. Loads activity JSON, renders the mechanic with filled slots, handles drag/tap interactions, plays audio, shows feedback.
- **Completion screen** — celebration animation + parent rating prompt.

**Key technical properties:**

- **Zero LLM calls in the hot path.** Activities are pre-generated. The runtime never waits on a model.
- **ActivityJSON is self-describing.** Layout, arrangement, and element positioning are inlined at store time. The runtime executes; it does not decide.
- **Phaser handles input through its own event system.** This bypasses the DOM event loop that caused drag-vs-scroll conflicts in the prior HTML prototype.
- **Audio is bundled with the activity JSON as file references.** No real-time TTS. Audio files served as static assets.
- **Session telemetry is captured but minimal.** What activity, when, completed/abandoned, time-to-complete, parent rating. Stored locally for V1; will sync to backend in later versions.

## Layer-to-layer contracts (HLD)

These are the conceptual contracts. Full TypeScript interfaces live in `IMPLEMENTATION.md`.

```
Framework         → exposes:  getDivisionsForAge, getDivisionById
                    consumed by: Concept Layer, Generation Layer

Concept Layer     → exposes:  getConceptBrief, listConceptBriefs
                    consumed by: Generation Layer

Mechanics Layer   → exposes:  getMechanicSpec, listMechanicSpecs, getLayoutVariant
                    consumed by: Generation Layer only (slot/param schemas + layout variants)
                    note: layout data is inlined into ActivityJSON at store time;
                          the runtime reads the activity, not the spec directly

Generation Layer  → exposes:  generateActivity (offline only)
                    produces: ActivityJSON files in library/ (self-describing, layout inlined)

Runtime Layer     → exposes:  N/A (terminal consumer)
                    consumes: ActivityJSON (self-describing)
                    produces: SessionRecord in local storage
```

**One consumer rule:** every layer has exactly one consumer. Mechanics was originally designed with two (Generation and Runtime) but the layout-inlining decision collapsed it to one — Generation resolves layout at store time, so the runtime never needs to read the spec.

## Repository structure

The file layout maps directly to the layers. Each directory is a layer or a layer's data store.

```
bloom/
├── framework/                  # Layer 1: Development Framework
│   ├── framework-2-3.yaml     # Age-band data
│   └── loader.ts              # Query interface
│
├── concepts/                   # Layer 2: Content Concept Layer
│   ├── briefs/                # Authored ConceptBriefs (JSON)
│   ├── new-concept.ts         # CLI authoring tool
│   └── loader.ts              # Query interface
│
├── mechanics/                  # Layer 3: Mechanics Layer
│   ├── specs/
│   │   ├── drag-to-target.yaml
│   │   └── tap-to-select.yaml
│   └── loader.ts              # Query interface
│
├── generation/                 # Layer 4: Generation Layer
│   ├── prompts/               # Versioned prompt files
│   │   ├── generate-drag-to-target.v1.txt
│   │   └── review.v1.txt
│   ├── pipeline/
│   │   ├── prompt.ts          # Stage 1: prompt + Claude call
│   │   ├── validate.ts        # Stage 2: programmatic
│   │   ├── llm-review.ts      # Stage 3: LLM review
│   │   ├── stage.ts           # Stage 4: stage + preview generator
│   │   └── store.ts           # Stage 6: write to library
│   ├── review-ui/             # Stage 5: manual review HTML surface
│   ├── evals/                 # Eval cases + runner
│   └── generate-cli.ts        # CLI entry point
│
├── library/                    # Activity Library (the studio↔runtime boundary)
│   ├── activities/            # Approved activities (JSON)
│   ├── staged/                # Awaiting manual review
│   ├── rejected/              # Failed activities + reasons
│   └── assets/                # Sprites, audio
│
├── runtime/                    # Layer 5: Runtime Layer
│   ├── src/
│   │   ├── scenes/
│   │   │   ├── selection.ts
│   │   │   ├── activity.ts
│   │   │   └── completion.ts
│   │   ├── mechanics/         # Mechanic implementations (renders)
│   │   │   ├── drag-to-target.ts
│   │   │   └── tap-to-select.ts
│   │   ├── audio.ts
│   │   ├── telemetry.ts
│   │   └── main.ts
│   ├── public/                # Static assets served to client
│   ├── index.html
│   └── vite.config.ts
│
├── shared/                     # Shared types across layers
│   └── types.ts               # ActivityJSON, ConceptBrief, MechanicSpec, etc.
│
├── CLAUDE.md                   # Instructions for Claude Code
├── VISION.md                   # Long-term product vision
├── PRD.md                      # V1 product requirements
├── ARCHITECTURE.md             # This file
└── IMPLEMENTATION.md           # Build plan, milestones, TDD strategy
```

**Why this layout:**

- One directory per layer. Layer boundaries are also directory boundaries.
- Shared types live in `shared/`. Every layer imports from there for cross-layer contracts.
- The `library/` directory is the explicit handoff point between studio and runtime. It is the *only* path through which content reaches the runtime.
- Prompts are versioned files, not strings in code. This makes prompt iteration trackable in git.

## Key technical decisions

### Renderer: Phaser 3

**Decision:** Phaser 3 for the runtime. Rejected vanilla DOM (broke for Nitara's drag), Pixi (lower-level than needed), native Swift (wrong tool for V1).

**Rationale:** Phaser handles touch input through its own event system (bypassing DOM event-loop issues), has first-class drag-and-drop primitives, proper audio sync via Web Audio API, and a battle-tested scene/sprite/animation model. Standard choice for educational web games.

### Storage: file-based JSON

**Decision:** All persistent data (framework, concepts, mechanics, activities, sessions) stored as JSON/YAML files in the repo for V1.

**Rationale:** One user, one developer, no concurrency concerns. Files are inspectable, version-controlled, and easy to migrate later. A database is V1.5 territory once there are multiple children or remote users.

### Hosting: Vercel

**Decision:** Vercel for the runtime web app. Generation pipeline runs locally (offline studio).

**Rationale:** Zero-config deploy for a Vite-built web app. Free tier sufficient for V1. Easy to add a small backend later if needed.

### TTS: OpenAI TTS HD

**Decision:** OpenAI TTS HD for voice prompt generation.

**Rationale:** Warm voices, single-API integration alongside Anthropic, pennies at V1 volume. Google Cloud TTS WaveNet is the austerity alternative if cost becomes meaningful at scale.

**V1.1 delta:** provider decision unchanged, but *when* TTS runs changed — resolved at pack-build time (`build-pack --child <name>`) so the child's name can be baked in, not at activity-generation time. Gate before committing: generate "Nitara" in 3 voices, pick by ear; if all mangle it, switch to ElevenLabs. See `BLOOM_V1.1_MVP_SPEC.md` §5.

### Visual assets: free icon library — **superseded by V1.1**

**Original V1 decision:** Flaticon or Iconify for V1. AI-generated assets deferred to V1.5.

**Original rationale:** Library art is consistent, fast, and removes the AI-image-generation pipeline as a V1 dependency. The interaction quality is the priority for V1; visual style consistency with library art is sufficient.

**V1.1 supersedes this decision.** AI-generated sprite sheets replace it: generate sheets (many objects per image = consistent by construction) → slice programmatically → normalize (background removal, resize, palette-snap to a fixed brand palette) → human curation pass → tagged manifest. This directly targets the failure mode that killed the previous AI-asset attempt (per-object generation, uncontrolled drift) — see `BLOOM_V1.1_MVP_SPEC.md` §4 for the full workflow, budget, and QA rules. Lands in M7 (spike, single setting) then M8 (wired into the generation pipeline, replacing the static `taxonomy.yaml`).

### Audio assets: free SFX library

**Decision:** Freesound or Mixkit for sound effects. One shared set across all V1 activities.

**Rationale:** Same as visual assets. Consistency across activities is more valuable than variety in V1.

## Build-order dependency

There is one explicit dependency in the build order, captured here so the implementation plan respects it:

**Runtime ← Generation (mechanic-level eval).**

The mechanic-level eval (does an activity actually render?) requires the Runtime Layer to be functional enough to load and render an activity. This means the Runtime cannot be the last thing built — it must exist in some form before the Generation pipeline can be fully tested.

The static preview generator (Stage 4 of the generation pipeline) is independent of the Runtime, so manual review *can* happen before the Runtime exists. But the integration test that validates "this generated activity actually plays" requires the Runtime.

Implementation plan should sequence accordingly.

## What's not in V1

V1's deferred components are visible in the end-state diagram above. Each has a known landing place in the steady-state architecture:

- **Selection Layer** — V1 substitutes a parent-pick grid in the Runtime. End state: a real layer between Personalisation and Runtime that picks per-child, per-moment.
- **Personalisation Layer + Profile/Memory** — V1 has neither. End state: Profile/Memory is the per-child store; Personalisation reads it + a generic activity, produces a personalised activity. This is the moat layer.
- **Story Layer** — V1 has no narrative. End state: feeds into Generation alongside Concept and Mechanic, providing world/character/arc context.
- **Asset Generation** — V1 uses free icon and SFX libraries. End state: a real sub-pipeline producing visually-consistent, brand-controlled assets at scale.
- **Multi-format content** (audio stories, video) — V1 is digital activities only. End state: parallel mechanic/runtime tracks per content type; same studio shape.
- **Operator surfaces** (parent surface, studio operator UI) — V1 has neither beyond CLI. End state: real surfaces for both audiences.
- **Telemetry beyond local** — V1 stores session data locally. End state: telemetry feeds back into Profile (personalisation signal) and into eval systems (content quality signal).

These are explicit non-goals for V1. The V1 layers are shaped so that adding each later does not require restructuring what V1 builds.
