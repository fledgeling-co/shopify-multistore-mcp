# shopify-multi-mcp — Tests to run before betting on Territory A

Each test has its pass threshold written before it runs. A result that misses its threshold is a finding, not a reason to move the threshold.

## The assumptions

1. Sign-in through Shopify CLI works on real stores with the default scopes (T-012).
2. Partners who match the beachhead will install a second tool beside the CLI and keep using it (C-004, C-002).
3. Labelled answers stop wrong-store mistakes better than the alternatives (C-002).
4. Shopify keeps the one-store rule long enough for the enemy to stay true (C-001).

## The tests

| # | Test | Pass threshold | Cost | Checks |
|---|---|---|---|---|
| 1 | Connect two real stores the owner controls; run get_shop, list_orders and one graphql_query on each | Both sign-ins complete; 6 of 6 calls return labelled data; any refused scope is named in the error | 15 minutes | Assumption 1 |
| 2 | Interview 8 partners matching the beachhead (several live client stores, an AI assistant in daily use) and offer the install | At least 5 of 8 say they would install it beside the CLI; at least 3 have it connected to two or more stores within 7 days | Two weeks of outreach | Assumption 2 |
| 3 | Run the same three cross-store questions through this tool, alex-brecher/shopify-multi-store and Matrixify | Setup under 10 minutes; 0 answers attributed to the wrong store; at least one dimension where this tool is preferred by the partner running it | One afternoon | Assumption 3 |
| 4 | Re-read Shopify's "Authorizing AI tool access" page every week through the next Editions release | The one-store sentence is still there | Minutes a week | Assumption 4 |

## Reversibility map

| Decision | Reversible? | Cost to reverse |
|---|---|---|
| README and site lead with agencies and client stores | Yes | Copy edits |
| Hero names Shopify's connector as the alternative | Yes | Copy edits; must change the day test 4 fails |
| Default scopes requested at sign-in | Yes | A constant in `src/config.js`; existing sessions keep their scopes |
| The project's name, close to alex-brecher's "Shopify Multi-Store MCP" | Costly once people install it | Rename before announcing |
| Publishing to npm under `shopify-multi-mcp` | Hard; an npm name cannot be reused after unpublishing | Decide before publishing |

## What the frameworks cannot do

All four frameworks are practitioner frameworks built from case evidence that their authors selected from winners. They make Territory A coherent; none of them makes it right. These tests are what can.
