# shopify-multi-mcp — Territory A: "The client-store switchboard"

**Generated:** 2026-10-31 · **Status:** Strategy proposal, option A of 3 (recommended).
**Frameworks:** Ries & Trout · Dunford · Blue Ocean · Baker.
**Axis of this option:** target specificity, moved from "anyone" to Shopify partners who already run an AI assistant across client stores.
**Claimability:** 7/7 moves rest on shipped capability.
**One line:** *Every client store in one AI chat, signed in through Shopify's own approval page, and every answer names the store it came from.*

> Every bracketed id below is a binding. `T-` ids are rows in
> `50-product-truth.md`; `C-` ids are claims in `40-evidence-register.md`.
> `claim_ledger.py check` fails if a move here has none.

---

## 1 · The position

Freelancers and small agencies who look after several Shopify stores already use Claude, Codex or Cursor on that work, and Shopify's own AI connector keeps them to one store at a time: switching stores starts a new authorization, and parallel work on different stores is impossible [C-001] [C-002]. shopify-multi-mcp keeps every client store connected to one assistant at once, makes every action name its store, and labels every answer with the store it came from [T-001] [T-002]. It does that through Shopify's own CLI sign-in, so it never handles a store's keys and stays on the path Shopify points multi-store AI work to [T-003] [T-010] [C-008].

**Hero sentence:** *Every client store in one AI chat. Each answer says which store it came from.* `[T-001]` `[T-002]` `[C-001]`

## 2 · Who it is for

**Beachhead:** Shopify partners (freelancers and boutique agencies) who already use Claude Code, Claude Desktop, Codex or Cursor on several client stores. `[T-001]` `[T-005]` `[C-004]` `[C-002]`
**Where they congregate:** community.shopify.dev (the multi-store connector thread is there), the Shopify Partner Directory and Partner Dashboard, r/shopify and r/shopifyDev, and the Claude Code issue tracker where the same request is filed [C-002].
**What they spend on instead today:** their own time switching and re-authorizing; Shopify CLI scripts; paid connectors such as Matrixify and ShopMCP; a desktop wrapper (Manager for Shopify) [C-003].
**Explicitly not for:** merchants with one store (Shopify's connector already serves them), store buyers mid-deal, and anyone who needs the assistant inside claude.ai on the web rather than a desktop or terminal app.

## 3 · Dunford's six components

| # | Component | This territory | Bindings |
|---|---|---|---|
| 1 | Competitive alternatives | Shopify's one-store connector with sign-in on every switch; Shopify CLI commands typed by hand; Matrixify, ShopMCP, Datadrew and alex-brecher/shopify-multi-store; and the non-software one: a person switching between admin tabs and pasting results into a doc | [C-001] [C-003] |
| 2 | Unique attributes | Runs on Shopify's own CLI sign-in and holds no store credentials of its own; always on Shopify's newest CLI and Dev MCP, checked before use; free and MIT | [T-003] [T-004] [T-010] [C-008] |
| 3 | Value (+ proof) | One assistant answers across client stores without a re-authorization per switch, and no keys sit in the agency's files | [T-003] [T-010] [C-008] |
| 4 | Target-market characteristics | Several client stores open at once, an AI assistant already in daily use, permission to approve app access on each store | [C-004] |
| 5 | Market category | A store switchboard for the AI assistant you already use (a subcategory of Shopify AI connectors) | [T-001] [C-003] |
| 6 | Trend it rides | Shopify widening its connectors to nine assistants (Fall '26) while keeping one store per connection | [C-001] |

The non-software alternative is the tab-switching account manager in row 1.

## 4 · The word and the enemy (Ries & Trout)

- **Own:** **`switchboard`** — one place every client line comes into, with each line labelled; concrete, and a word an agency already uses about its own work.
  **Who owns it today:** nobody in the Shopify AI category; SyncWith's agency page uses the idea without the word · **What it would take to take it:** a demo of one question answered across three labelled stores, repeated in every channel above.
- **Enemy:** **Shopify's one-store-at-a-time AI connector** — Shopify's own staff describe the limit in public ("supports one store at a time, even when the stores are in the same organization") and say a fix is tracked with no date [C-001].

## 5 · Category and naming

**Adopt:** store switchboard for your AI assistant.
**Avoid:** "multi-store MCP" as the lead phrase — already taken in name and shape by alex-brecher/shopify-multi-store [C-003]; "official"; "the only" or "the first" (contested, C-009).
**Ten-second test:** "It lets Claude work on all your client stores at once, and it tells you which store each answer is from."
**Never:** all-in-one, everything-app, or any breadth-led framing.

## 6 · Blue Ocean — ERRC

| Action | Factor | Why |
|---|---|---|
| **Eliminate** | Per-store app setup and API keys pasted into config files | Every token-based alternative competes on credential setup; this one has none to set up [T-003] [T-010] |
| **Reduce** | Curated tool count | A handful of store tools plus Admin GraphQL, rather than dozens of narrow tools to learn |
| **Raise** | Store labelling and store selection on every call | The wrong-store answer ("No error, just wrong numbers") is the failure the audience fears [T-002] [C-002] |
| **Create** | Shopify's newest CLI and Dev MCP, verified before each promotion | Nobody in the competitor set says what Shopify version their tool is running [T-004] |

**The empty square this opens:** a free switchboard that asks Shopify for nothing new, because it rides the CLI path Shopify already recommends.
**Candidate tagline:** *Every client store, one chat, no keys.*

## 7 · Message architecture and copy

Progressive disclosure: hook → differentiator → proof → scope.

**Hero:**
> # Every client store in one AI chat.
> Ask once and each store answers, labelled with its name. Shopify's own approval page signs each store in, so no app keys sit in your files.
>
> **[ Set it up ]** · *Free and open source. Works with Claude, Codex and Cursor.*

**One-liners:** "Ask all your client stores the same question." · "Every answer names its store." · "No app to build, no keys to paste."

**Proof point:** Signs in through Shopify CLI's own approval page and never reads or stores a token. `[T-003]` `[T-010]` `[C-008]`

## 8 · Objections, answered

| Objection | Answer | Bindings |
|---|---|---|
| *"Shopify will fix this next quarter."* | They might, for the chat connector. The value that survives is the CLI path with no stored keys and labelled answers; the help page is re-checked weekly | [C-001] [T-003] |
| *"Matrixify already does multi-store."* | It does, as a paid app built on its own connection. This is free, runs Shopify's own CLI, and keeps no credentials | [C-003] [T-009] [T-010] |
| *"I don't want an AI changing a client's live store."* | Mark that store read-only; changes are refused there, and elsewhere happen only through one explicit change tool | [T-006] |

## 9 · Framework scorecard

| Framework | Verdict | Why |
|---|---|---|
| Ries & Trout | Holds | A concrete word and an enemy Shopify itself documents |
| Dunford | Holds | Alternatives include the tab-switching human; every unique attribute is shipped |
| Blue Ocean | Partial | Eliminating keys is real; the category is crowded (C-003) |
| Baker | Holds | Beachhead reachable through one forum, one directory and one issue tracker |

A verdict here says the territory is *well-constructed* on that framework. None of the four predicts whether it will work.

## 10 · Evidence fit, risks, honesty

- **Supported by:** C-001 (high), C-002 (medium), C-004 (medium), C-008 (medium).
- **Disconfirmed or complicated by:** C-003 — several competitors already sell or give away multi-store AI access; an agency practitioner in June 2026 said they do not use AI for direct edits yet.
- **Contested claims this rests on:** none for promissory moves; C-009 (is there an unmet gap) is contested and kept out of the copy.
- **Not yet claimable:** T-012 (sign-in verified on a real store) and T-013 (npm install). Until T-012 ships, the hero is a description of designed behaviour on Shopify's side; the README says so in its status line.
- **Defensibility:** low on features — Shopify can ship a store picker, and alex-brecher's repo can add the CLI path within months. The durable part is distribution among partners and the "no keys" path.
- **Biggest risk + mitigation:** Shopify ships multi-store connections in claude.ai. Mitigation: lead the fallback message with T-003/T-010 (no keys, Shopify's own sign-in) and T-004 (always current), which a connector fix does not remove.
- **What would falsify this territory:** fewer than 3 of 8 interviewed partners matching the beachhead install it alongside the CLI within a week, or Shopify's help page dropping the one-store rule.

## What this could not establish

The number of partners who hold several live client stores and use an AI assistant on them (C-004 is a population, not that intersection).
