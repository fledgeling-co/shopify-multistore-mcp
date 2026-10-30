# shopify-multi-mcp — Positioning decision

**Recommendation, conditionally:** position shopify-multi-mcp as the client-store switchboard for Shopify partners who already use an AI assistant (Territory A), with the hero *"Every client store in one AI chat. Each answer says which store it came from."* Confidence is medium: the enemy is documented by Shopify itself, the segment's size is not counted anywhere, and the sign-in has not yet been run on a real store.

## Why this one

- **The enemy is Shopify's own sentence.** Shopify staff say in public that its connector "supports one store at a time, even when the stores are in the same organization", and that a fix is tracked with no date [C-001]. Fall '26 widened the connectors to nine assistants and kept the rule.
- **The people who feel it have said so.** A theme developer with nine stores ("Parallel agents cannot work on different stores at all") and a consultant connecting a client's two regional stores to Claude Code [C-002]. Merchants and store buyers voice other problems [C-005] [C-006].
- **They are reachable, and the product is on their path.** Partners live on community.shopify.dev and in the Partner Directory [C-004], and Shopify already points them to the CLI sign-in this tool runs on [C-008] [T-003].

## What it costs you

- **The merchant audience leaves the hero.** Owners of several stores (Territory B) still get a paragraph and an FAQ answer, but the first screen speaks to people who look after other people's stores.
- **"Free multi-store MCP" is not yours to claim.** alex-brecher/shopify-multi-store already is one, with more features and a near-identical name; Matrixify, ShopMCP and Datadrew sell the access [C-003]. The difference left is narrow: Shopify's own sign-in, no stored keys, always on Shopify's newest tools [T-003] [T-004] [T-010].
- **The enemy can disappear.** If Shopify ships a store picker, the hero's contrast goes with it, and the message falls back to the no-keys proof.

## The shortlist

| Territory | Word | Enemy | Category | Beachhead | Claimable | Strongest objection |
|---|---|---|---|---|---|---|
| **A · Client-store switchboard** (recommended) | switchboard | Shopify's one-store-at-a-time AI connector | store switchboard for your AI assistant | partners using AI across client stores | 7/7 | Shopify may fix the connector |
| B · Side by side | side-by-side | the export-and-paste spreadsheet | cross-store answers for your own stores | owners of 2–6 stores | 5/5 | Plus analytics and sync apps already answer much of it |
| J · Look before you buy | read-only | seller-supplied screenshots | read-only diligence for store buyers | portfolio buyers and brokers | 5/5 | sellers will not approve an unofficial tool |
| Status quo | many stores | none | MCP server | anyone | n/a | names no reader and no enemy |

## What has to be true

1. Sign-in works on real stores with the default scopes — test 1 in `80-pre-commitment-tests.md`.
2. At least 5 of 8 matching partners would install it beside the CLI — test 2.
3. Labelled answers produce no wrong-store mistakes against the alternatives — test 3.
4. Shopify's one-store rule stays in its help pages — test 4, weekly.

## What to do on Monday

1. Run test 1 on two stores you control. *(reversible)*
2. Rewrite the README for non-technical readers around Territory A, keeping the technical guide separate. *(reversible)*
3. Build the marketing page with the hero above and "Set it up" as the one action. *(reversible)*
4. Decide the name before announcing anywhere: it sits beside "Shopify Multi-Store MCP".
5. Post in the community.shopify.dev multi-store thread only after test 1 passes.

## Guardrails

- Never say "the only", "the first" or "official" — C-009 is contested and C-003 is not.
- Never say the tool "signs you out" of Shopify's admin; the admin store switcher works. The limit is the AI connector.
- Never claim parallel safety across separate AI sessions: the server runs one Shopify command at a time inside itself only [C-007].
- State that the tool is not affiliated with Shopify.

## What this could not establish

The number of partners with several live client stores who use an AI assistant; the Claude Code research member had not finished when this was written.
