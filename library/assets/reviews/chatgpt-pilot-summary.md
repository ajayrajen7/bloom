# ChatGPT asset-generation pilot summary

**Review date:** 2026-09-27
**Provider:** ChatGPT ImageGen; exposed model version was not available and is recorded as `unknown`.

## Results

- **Candidates shown:** 10 generated comparison/pilot candidates across the two batches; the approved apple style anchor is a separate reference image.
- **Manual decisions:** Ajay approved all 10 candidates for pilot/evaluation use. Review duration was not measured.
- **Runtime sprite set:** 8 canonical objects (red apple, banana, orange, grapes, carrot, tomato, cucumber, broccoli) and 1 green-apple color variant.
- **Text-only controls:** banana and carrot were visually approved as comparison controls. They remain staged because deterministic PNG checks found opaque canvas corners and subjects touching the image boundary; they are not runtime sprites.
- **Reference-condition observation:** the reference-conditioned banana and carrot were selected as pilot canonicals. Both have clean alpha corners and safe framing. This is encouraging evidence from two objects, not proof that reference prompting always improves output.
- **Framing corrections:** tomato, cucumber, broccoli, and the green apple needed scale/framing adjustments. Earlier versions remain in staging; the approved final versions have recorded prompt versions and pass the deterministic checks.
- **Final runtime checks:** all 9 promoted images are square 1254 × 1254 PNGs with alpha, transparent corners, safe margins, and centered bounds within configured tolerance.

## Interpretation and remaining evidence

The generation process produced a usable first library with one approved style anchor, eight coherent-enough canonical objects, and one identity-preserving color variant. This satisfies the asset-generation objective for a manual pilot, not a production-quality guarantee. The next experiment should load these sprites into two selected mechanics, then observe whether the activity experience is enjoyable for the child. Do not infer activity enjoyment from asset approval.

The full-manifest validation command will continue to report the two intentionally retained text-only controls as failures because of their measured corner/frame defects. The runtime set itself passes validation. Review details and candidate-level measurements are in `chatgpt-pilot-001.json` and `chatgpt-pilot-002.json`.
