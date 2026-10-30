# shopify-multi-mcp — Product truth

Rendered from `work/ledger.json`. What the product does, and whether a customer can use it today.

**Shipped:** 11 · **Designed:** 2 · **Aspirational:** 1

| id | Capability | Status | Evidence |
|---|---|---|---|
| T-001 | One AI assistant works on several Shopify stores at once; every store tool takes a store choice from the connected stores | shipped | `src/tools.js` buildTools; `test/server.test.js` |
| T-002 | Every result is labelled with the store it came from | shipped | `src/tools.js` storeResult; `test/server.test.js` |
| T-003 | Each store signs in through Shopify's own approval page (Shopify CLI store auth); no app to create | shipped | `src/shopify-cli.js` startAuth; `docs/REVIEW.md` §3 (live approval not yet run, see T-012) |
| T-004 | Runs the newest Shopify CLI and Dev MCP, promoted only after integrity, registry-signature and smoke checks, with fallback | shipped | `src/toolchain.js`; `test/toolchain.test.js`; doctor run 2026-10-31 |
| T-005 | One-line install in Claude Code, Claude Desktop, Cursor, VS Code or Codex | shipped | `docs/TECHNICAL.md`; stdio session via `npx github:` 2026-10-31 |
| T-006 | Read-only stores; changes refused everywhere except one change tool | shipped | `test/server.test.js` |
| T-007 | One question answered across every store side by side | shipped | `src/server.js` queryAll; `test/server.test.js` |
| T-008 | Shopify's docs search and code validation built in | shipped | doctor run; `test/server.test.js` |
| T-009 | Free and open source, MIT | shipped | `LICENSE` |
| T-010 | Never reads, copies or stores Shopify tokens | shipped | `src/shopify-cli.js` |
| T-011 | A store needing sign-in tells the assistant exactly how to fix it | shipped | `test/server.test.js`; live CLI error 2026-10-31 |
| T-012 | Sign-in and store calls verified against a real store | designed | `STATUS.html` gate "Sign-in and calls against a real store": unmeasured |
| T-013 | Install from npm as shopify-multi-mcp@latest | designed | not published |
| T-014 | A hosted version needing nothing installed | aspirational | `docs/REVIEW.md` finding 1: Shopify's hosted MCP rejects third-party OAuth clients |

T-003 is marked shipped because a customer can run it today without anyone in the room; the code path is Shopify CLI's own and its "no stored app authentication" failure was observed live. Its success path against a real store is T-012, which is not.

## Claimability by territory

| Territory | Moves | On shipped | On designed | Fully claimable? |
|---|---|---|---|---|
| A · Client-store switchboard | 7 | 7 | 0 | Yes, with T-012 stated as open |
| B · Side by side | 5 | 5 | 0 | Yes, with T-012 stated as open |
| J · Look before you buy | 5 | 5 | 0 | Yes for the moves; the seller approval flow it needs is not even designed |

## The roadmap this implies

1. **T-012, verify sign-in on a real store.** Every territory's hero assumes it. It needs one store account and ten minutes.
2. **T-013, publish to npm.** Shortens the install line for Territory A's partners and makes version pinning ordinary.
3. **A seller approval flow** would be the first piece of work Territory J needs; it is not on the ledger because nobody has designed it.

## Promissory-copy rule

Hero lines, headlines, one-liners, unique attributes and value proof rest only on shipped rows. `claim_ledger.py check` enforces it, and passed at label `conditionally-recommended` on 31 October 2026.
