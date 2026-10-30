# Fidelity loop log, shopify-multi-mcp icon

Reference: icon-engineC-9fb7f0-masked.png (Engine C, won the material read). Metric tier: full (LPIPS).

| Round | Edit class | Change | Gate | Panel |
|---|---|---|---|---|
| r00 | baseline | Engine A shopfront row | 1024 0.597, 16px 0.885 | |
| r01 | structure | object scale 1.12 (row at ~73% of tile; reference 81%, rubric 55-65%) | ACCEPT +0.216 | |
| r02 | material | pillowed awning panels, whiter bodies, door frame + glow, foot halo, richer rail | REJECT: 1024 0.641->0.635, 32px contrast -10% | |
| r03 | material | r02 without whiter bodies | REJECT: 32px contrast -10% | |
| r04 | material | r03 with door light halved | REJECT: 32px contrast -8% | |
| ablations | | panels, halo, rail, door light, sides, shadow each removed alone: 32px contrast 0.359-0.364; all removed 0.381 | cumulative, no single cause | |
| r05 | material | r04 + darker turned faces (scallop bottoms, door feet) | REJECT: 1024 0.6407->0.6350; 32px contrast passes | codex (gpt-5.6-sol) prefers r05 overall + material, consistent in both orders; claude prefers r05 (excluded, generator family); openai and cursor judges could not run |

Promoted: r05 (best-promoted/). Stopped at 5 of 10 rounds: the remaining 1024 gap is mainly the reference's separate cap per shop, and matching it would remove the single rail that carries the one-assistant idea.
