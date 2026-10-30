# shopify-multi-mcp — Evidence register

Rendered from `work/ledger.json`. Confidence is earned in independent registrable domains: three for high, two for medium. Four research backends agreeing is not four sources.

| id | Claim | Confidence | Domains | Verified | Members |
|---|---|---|---|---|---|
| C-001 | Shopify's official AI connectors hold one store at a time, even within one organization; switching starts a new authorization | high | shopify.dev, shopify.com, github.com | yes (forum page, staff quote) | Grok, Perplexity, Codex |
| C-002 | Practitioners working across several stores voice the one-store limit in their own words | medium | shopify.dev, reddit.com | partly (forum yes, Reddit unreadable) | Grok, Codex |
| C-003 | Multi-store AI access is already offered by others (alex-brecher/shopify-multi-store, Matrixify, ShopMCP, Datadrew, SyncWith) | high | github.com, matrixify.app, shopify.com, datadrew.io | partly (GitHub yes, Matrixify 403) | Grok, Codex |
| C-004 | Shopify service partners are an identifiable, reachable population; nobody counts those with several live client stores using AI | medium | shopify.com, sherocommerce.com | no | Grok, Perplexity, Codex |
| C-005 | Owners of several stores solve comparison with analytics, sync apps and spreadsheets; their pain is catalog matching | medium | shopify.com, reddit.com, letsmetrix.com | no | Grok, Codex |
| C-006 | Store buyers distrust screenshots; live access needs the seller; no AI multi-store buyer workflow found | low | withcommerce.com, flippa.com | no | Grok, Codex |
| C-007 | Several Shopify CLI commands at once on one login logged a developer out (theme pulls); one at a time was stable | low | shopify.dev | yes | Grok, Codex |
| C-008 | Shopify points multi-store AI work to its own CLI and tells merchants to use official integrations over home-built token ones | medium | shopify.dev, shopify.com | yes (staff reply) | Grok, Codex |
| C-009 | Whether multi-store AI access is still an unmet gap | medium, **contested** | github.com, matrixify.app | no | Grok vs Codex |

## Contested

**C-009.** Grok names two unmet gaps: remembered multi-store authorization inside the chat apps people pay for, and parallel CLI use that does not log a shared session out. Codex finds no marketwide gap, because Matrixify, ShopMCP, Datadrew and community MCPs cover multi-store access, and alex-brecher/shopify-multi-store covers most of what this project does with more features. Both positions stand. No copy says "the only" or "the first".

## Counter-review

Four lenses briefed to refute, run on 31 October 2026, raised nine issues. The two high ones: Perplexity used one developer's nine development stores as evidence about agencies with live client stores (A's beachhead size stays unmeasured), and the C-009 contradiction above. The rest are recorded in `70-research-decision.md`.

## What this could not establish

Four of the six judged citations were unreadable (Cloudflare, 403, an empty Reddit page), so C-002, C-003, C-005 and C-008 each rest partly on members' quotations rather than a page read here.
