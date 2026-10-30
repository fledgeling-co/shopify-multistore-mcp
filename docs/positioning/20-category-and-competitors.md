# shopify-multi-mcp — Category and competitors

The category is "connect an AI assistant to Shopify stores". Shopify occupies its centre with official connectors that hold one store at a time [C-001]; several vendors and open-source projects already sell or give away multi-store access around that limit [C-003]. The line this project can hold is narrower than "multi-store": it is the one that runs on Shopify's own CLI sign-in and keeps no credentials of its own [T-003] [T-010] [C-008].

## Who holds which line

| Offer | What it does across stores | Price | Credentials | Evidence |
|---|---|---|---|---|
| Shopify AI connectors (ChatGPT, Claude, Gemini, Grok, Perplexity, Muse, Copilot; nine assistants after Fall '26) | One store per connection; switching starts a new authorization | Included | Shopify-hosted OAuth | [C-001] |
| Shopify CLI connector / AI Toolkit | Per-store sign-in on the machine; each command names its store | Free | Shopify CLI session | [C-008] |
| alex-brecher/shopify-multi-store | One MCP for every store, aliases required, guarded updates, parallel read-only queries, optional hosted team mode | Free, MIT (v2.0, 5 GitHub stars) | Its own per-store credentials in the OS keychain | [C-003] |
| Matrixify | Bulk operations; several shops per assistant since June 2026; connection labels since October 2026 | Paid tiers per 30 days | App connection | [C-003] |
| ShopMCP | Several stores, one connection each, audit log | Free tier, paid Pro | App connection | [C-003] |
| Datadrew MCP | Several shops in a chat, labelled responses | Free data tier, paid insights | Hosted | [C-003] |
| SyncWith MCP | Reporting across stores; does not write | Plan-based | App install per store | [C-003] |
| Sync apps (Syncio, Multi-Store Sync Power) | Product and inventory sync, not AI | Monthly | App install | [C-005] |

## Where the category is heading

Shopify widened its connectors to nine assistants on 28 October 2026 and kept the one-store rule; its staff say multi-store connections are tracked with no date [C-001]. Competitors are adding store labels (Matrixify, October 2026) [C-003]. Both point the same way: store access will commoditise, and what is left to own is how a tool signs in and how clearly it says which store an answer came from.

## Who could take Territory A's position first

Shopify, by shipping a store picker in its connectors, which removes the enemy but not the "no keys" proof. alex-brecher/shopify-multi-store, by adding a CLI sign-in mode; it already has the name and more features.

## What this could not establish

Active-user counts for any competitor; the per-tier split of Shopify's service partners; whether Shopify's CLI handles parallel `store execute` calls on one login safely (the one reported logout came from parallel theme pulls) [C-007].
