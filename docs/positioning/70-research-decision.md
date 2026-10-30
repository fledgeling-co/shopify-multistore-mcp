# shopify-multi-mcp — What research was bought, and what was not

## The gate

| Question | Already in the repo? | Would it change the decision? | Free lane enough? | Bought? |
|---|---|---|---|---|
| Which Shopify MCPs and connectors exist, and can a third party run the official one per store? | No | Yes, it decided the architecture | Yes: `research_local_start` plus direct protocol probes | No — free lane (recorded in `docs/REVIEW.md`) |
| Who runs several stores with an AI assistant, and which segment voices the pain? | No | Yes, it separates A, B and J | No: one free CLI had broken web search, leaving two models | Yes, with the owner's approval up to $6.20 |
| Competitor matrix | Partly (REVIEW.md) | Somewhat | Covered inside the customer panel | No |

## Panels dispatched

| Panel | Archetype | Members | Completed | Cost band | Reconciled |
|---|---|---|---|---|---|
| `dr_553d007f4355afba` customer ground truth | competitive | 6 | 3 with reports, 2 failed, 1 unfinished at decision time | $1.65–$6.20 | 31 Oct 2026 |

**Reserved:** $6.20 at band-top · **Reported actual:** $3.84 committed in Dossier's 24h ledger after Gemini's reservation was released. Dossier's per-member estimates are Grok $1.20 and Perplexity $2.00; the ledger does not itemise the other $0.64. Budget ledgers reserve high and reconcile lower; only the provider invoices are the invoice.

## Members that did not complete

| Member | Why | Cost |
|---|---|---|
| Gemini Deep Research | Refused with HTTP 429: the Google billing account hit its monthly spending cap | $0, reservation released |
| Antigravity CLI | Returned a 295-byte report; the plan had warned its web search looked broken | $0 |
| Claude Code CLI | Still running past its band when the decision was drafted; merged without it | $0 (subscription quota) |

The Codex member's report is 303 KB because the run absorbed the text of a writing skill and a 39,000-token unrelated section; its research content is about 9,000 tokens and was read in full. The contamination is preserved in `research/` rather than cleaned.

## Free lane

`research_local_start` with web search and direct probes of `setup.shopify.com` covered the technical review. A Dossier `reddit_gather` over r/shopify, r/ecommerce, r/ClaudeAI, r/mcp and r/shopifyDev for one year returned 480 posts and no thread about AI across several stores. Candidate generation ran through `trawl:trawl` at standard tier on subscription quota.

## Grounding and disclosure

**Product documents shared with a third-party API:** none. **Kept local:** everything; no `corpusStores` upload.

## Verification run

| Gate | Scope | Result |
|---|---|---|
| `research_verify_citations` | not run separately | the judged pass below fetched each page itself |
| `research_verify_claims` (judged) | 6 load-bearing claims | 2 supported, 0 contradicted, 4 unreadable (Cloudflare, 403, empty Reddit page) |
| `research_counter_review` | 4 lenses | 9 issues, 2 high: dev-store evidence stretched to agencies; contested gap (C-009) |
| `research_synthesise` | 3 completed members | 98 sources on 40 independent domains, 10% overlap |

## What was deliberately not researched

The size of the intersection between partners and AI-assistant users (no public source exists; interviews are the cheaper test, in `80-pre-commitment-tests.md`). A second paid panel on competitors, because the customer panel and the technical review already covered them.
