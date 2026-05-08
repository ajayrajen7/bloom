# Bloom — Product Vision

## What Bloom is

Bloom is a personalised, AI-generated activity studio for young children. It produces a continuously growing library of age-appropriate activities — interactive games, audio stories, and other content formats — and serves them to children through devices they already use.

The defining bet: **AI-driven content economics let a small team produce content at the scale of a large studio**, while personalisation injection makes the experience meaningfully unique to each child.

## Who it is for

Children aged 2–7. Parents who want active, age-appropriate engagement for their kids without the guilt of passive screen time or algorithmic ad-bait. Initial focus: 2–3 year olds, expanding upward as the child grows.

## What it competes with

The child's time and attention against Cocomelon, YouTube Kids, Sago Mini, Lingokids, Toca Boca, and screen time generally. The parent's wallet against the same set, plus Disney+ Kids, Netflix Kids, and other paid family entertainment.

It does not compete with school, formal learning platforms, or academic tutoring. Learning is an outcome, not the product.

## Why it exists

Three things are true at the same time, and Bloom is the product that sits in the gap between them:

1. Parents give their kids screens. They feel bad about it.
2. The content children consume is either passive (videos), generic (mass-produced apps), or both.
3. AI now makes it possible to generate active, personalised, age-tuned content at a fraction of historical cost.

Bloom turns (3) into a product that resolves (1) and (2).

## End-state product

A multi-modal content platform where:

- A child has a profile that captures their age, preferences, recurring characters in their life, and play history.
- A studio of AI agents and pipelines produces a deep library of activities, audio stories, and other content — pre-generated, reviewed, and stored.
- For each child, content is selected based on age, developmental stage, recent play, and preference signals.
- A personalisation layer injects child-specific context into selected content — their name, their world, characters they care about — without regenerating the underlying content.
- Content is delivered through a runtime that feels native, fast, and zero-latency. The child never waits for a model.
- A parent surface shows what's being played, what the child seems to be enjoying, and (optionally, later) developmental context the parent might find useful.
- Content production scales with compute, not headcount. The team that ships 50 activities a week has the same headcount as the team that shipped 5.

## What makes it defensible

Three moats compound over time:

1. **Production economics.** Pre-generation + caching + cheap personalisation injection → cost per session approaches zero at scale.
2. **Personalisation depth.** A library of activities that adapt to one child's world is meaningfully different from a library that doesn't. The longer a child is in the system, the harder this is to replicate.
3. **Studio-grade craft applied to AI output.** Reviewer pipelines, eval systems, and content quality discipline that prevent the "AI-slop" failure mode that will sink most competitors in this space.

## What it is not

- Not a learning product. Skill development may be an outcome; it is not the promise.
- Not a real-time generative product. 95% of content is pre-produced. The child never waits for an LLM.
- Not a single-format product long-term. Activities first, but audio stories and other formats follow.
- Not a parent dashboard product. The parent surface exists, but the child is the user.

## Strategic posture

Build it like a 5-person company for the first 18 months regardless of long-term ambition. Production discipline, gross-margin discipline, and personalisation-as-moat have to be proven at small scale before scaling them. The optionality of starting small and scaling up is much greater than the reverse.

## North-star metrics (long-term)

- Sessions per child per week (engagement depth)
- Weeks of continuous use (retention)
- Parent willingness-to-pay sustained beyond month 3 (true PMF signal)
- Content unit cost (the moat metric)

## What V1 proves

V1 is for one child (Nitara, 2–3) and exists to prove the foundational claims of the system: that pre-generated activities can be produced through an AI pipeline at quality, that the runtime delivers an interaction experience children actually enjoy, and that the team building it learns the AI craft required to scale it.

V1 deliberately defers everything that does not test these claims — selection, personalisation, story arcs, multi-format content, parent-facing surfaces, multi-user systems. These are V2+ concerns.

---

*Working name: Bloom. Replaceable.*
