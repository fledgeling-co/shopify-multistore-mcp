# Shopherd Shopify MCP site copy

Written with agy (Gemini 4 Argon, medium) under create-luke-content, 31 October 2026; voice lint clean on the hard checks.

## header
Nav: How it works · Proof · Safety · Set up · Questions
Button: Connect your stores

## hero
Eyebrow: Shopherd Shopify MCP · MIT licence
Headline: Every client store in one AI chat.
Subhead: Ask once in Shopherd (said "shepherd") and every connected store answers, starting with its name. Each store signs in on Shopify's approval page, with no app to create and no API key to copy.
Button: Connect your stores
Secondary link: View source on GitHub
Fine print: Works with Claude Desktop, Claude Code, Cursor, VS Code, Windsurf and Codex. Not affiliated with Shopify.
Proof line: Answered 30 of 30 multi-store eval questions; runs Shopify's own CLI and Dev MCP.

## problem
Headline: Shopify's AI connector holds one store at a time.
Body: Look after several client stores and you approve access again every time you switch.
Note: Shopify's admin switches between stores without fuss; it's only the AI connector that holds one store.
Quote attribution: Shopify staff, Shopify Developer Community, 7 October 2026

## outcomes
Title: Nine ready-made reports across every store.
Body: Run **store_report** once and four stores at a time answer together: sales in each store's currency (leaving out test and cancelled orders), unfulfilled orders by age, low stock with stock elsewhere to move, SKU lookups, duplicate SKUs and catalogue gaps.
Example caption: Low-stock report: tidewater is out of coffee beans; harbour has 18.

Title: Every answer names its store.
Body: Each result starts with a store prefix like `store: harbour (harbour-coffee.myshopify.com)`, so figures don't drift onto the wrong client. For anything outside the reports, your assistant checks its read-only **Admin GraphQL** query via Shopify's Dev MCP and asks every store.
Example caption: Every store reply starts with its alias and myshopify.com domain.

Title: Changes go to one store, on purpose.
Body: Edits use one change tool on one named store at a time, and never retry so nothing applies twice. Mark any store **read-only** to refuse edits; mutations creating tokens, charging the store or changing app access are blocked outright.
Example caption: Read-only stores refuse edits; token, billing and access changes are blocked.

Title: Seven starting prompts built into chat.
Body: Account managers don't need to write GraphQL. Apps like Claude Desktop show seven ready-made prompts: morning check, sales, unfulfilled orders, low stock, compare a product, catalogue check, and connect a store. Pick one and every connected store answers.
Example caption: Seven built-in prompts cover daily checks without writing a query.

## proof
Headline: Tested head to head against the closest alternative.
Intro: We ran Shopherd 0.3.0 and Shopify Multi-Store MCP (alex-brecher/shopify-multi-store, 2.0.3) against a schema-checked mock Admin API with three stores. Claude Sonnet 5.5 answered 10 multi-store questions three times each, including Shopherd's 0.47 s CLI wait: 30/30 (7.4 s median) vs 27/30 (8.8 s).
Table caption: 31 October 2026: 10 questions x 3 runs on Claude Sonnet 5.5; speed medians across 7 runs.
Where they're ahead:
- Direct HTTPS calls take 5 to 12 ms, against Shopherd's 526 ms to 1.1 s.
- Runs hosted on Cloudflare Workers or Docker for teams, working in ChatGPT and claude.ai.
- Installs in 32 MB total; Shopherd takes 28 MB plus 397 MB of Shopify tools.
- Ships 29 tools, 17 reports, guided writes and access to all 514 Admin mutations.
Limits: Both servers ran against three local mock stores instead of real ones, with one model (Claude Sonnet 5.5) on 10 questions written by our team. You can read and re-run everything in the repo's `evals/` folder.
Link text: Read the evals on GitHub

## safety
Headline: What it touches, and what it doesn't.
Point: **No keys in your files.** Each store signs in on Shopify's approval page through Shopify's CLI; Shopherd never reads or copies a token. Store data an answer needs still goes to your AI provider in the chat, like any AI connector.
Point: **Shopify's newest tools, checked first.** Shopherd runs the newest Shopify CLI and Dev MCP only after three checks pass: npm integrity, registry signatures and a start-up test. If a new release fails, the last working version keeps running.
Point: **Each store gets its own folder.** Shopify's CLI stores each sign-in in its own folder on your computer, so Shopherd asks four stores side by side without sessions clashing. Removing a store deletes its folder.
Point: **Open source under MIT.** Every line of code is in `fledgeling-co/shopherd-shopify-mcp` on GitHub. If you used `shopify-multi-mcp` (0.1) or `StoreRow` (0.2), your existing settings keep working.

## setup
Headline: Set it up with one command.
Needs: You'll need **Node.js 22.12 or newer**, an AI app on your computer (Claude Desktop, Claude Code, Cursor, VS Code, Windsurf or Codex), and permission to approve access on each Shopify store.
Step 1 title: Run the setup command
Step 1 body: Paste this into Terminal (Mac) or Command Prompt (Windows). It checks Node.js, finds your AI apps, backs up each settings file before adding Shopherd, and never touches a file it can't read.
Manual toggle: Prefer pasting config blocks manually?
Step 2 title: Approve each client store
Step 2 body: Enter each store's `myshopify.com` address and approve it on Shopify's browser page. You can also connect stores later from chat: "Connect acme.myshopify.com as acme".
Step 3 title: Ask your stores
Step 3 body: Restart your AI app, pick a prompt like morning check, or ask: "How many orders are unfulfilled in each store?"
Recover: Initial start-up downloads about 400 MB of Shopify's CLI and Dev MCP (about 30 seconds on our test machine). Setup backs up settings files before editing, and failed CLI updates fall back to the last working version.

## questions
Q: Is this an official Shopify product?
A: No. Shopherd Shopify MCP is an independent open-source tool from fledgeling, and isn't affiliated with or endorsed by Shopify. It runs Shopify's own CLI and Dev MCP underneath, and each store signs in on Shopify's own approval page.
Q: What does it cost?
A: Nothing; it's free under the MIT licence. Your AI app's own subscription or usage bill is separate.
Q: What do I need?
A: A computer running Node.js 22.12 or newer, a supported AI app (Claude Desktop, Claude Code, Cursor, VS Code, Windsurf or Codex), a browser to approve each store, and roughly 425 MB of disk space once Shopify's CLI and Dev MCP download.
Q: Can it change my store?
A: Only through one change tool, on one named store at a time, and changes never retry so nothing runs twice. Mark any store read-only in your config to refuse all edits. Changes that would create access tokens, charge the store or alter app access are blocked outright.
Q: Does it work in claude.ai in the browser?
A: No. Shopherd runs on your own computer through Shopify's CLI, so it works with desktop and terminal AI apps, not browser tabs like claude.ai or ChatGPT.
Q: How does this compare with Shopify Multi-Store MCP?
A: Both are under the MIT licence. Choose that server for hosted team access (Cloudflare Workers or Docker) in claude.ai and ChatGPT, 5 to 12 ms calls, 17 reports or 514 mutations. Choose Shopherd to skip creating apps or storing `shpat_` tokens, lock read-only stores, and get 30/30 in our eval.
Q: What if I'm upgrading from StoreRow or shopify-multi-mcp?
A: Your old settings keep working as they are. Shopherd 0.3.0 is the new name for StoreRow (0.2) and shopify-multi-mcp (0.1), and now asks four stores side by side instead of one at a time (cutting 8-store checks from 4.2 s in 0.2 to 1.1 s).

## status
Tag: v0.3.0
Body: Early release. Tested end to end against Shopify's tools and a schema-checked mock Admin API, though nobody has signed in to a real store with it yet. Report issues at github.com/fledgeling-co/shopherd-shopify-mcp/issues.

## final
Headline: Bring every client store into one chat.
Body: Free, open source, and set up with one command.
Button: Connect your stores

## footer
Legal: Not affiliated with or endorsed by Shopify. Shopify is a trademark of Shopify Inc.
