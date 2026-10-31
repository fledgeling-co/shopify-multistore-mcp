# shopify-multistore-mcp site copy

Written with agy (Gemini 4 Argon, medium) under create-luke-content, 31 October 2026, for the "tag line" redesign: a page-wide copy pass, then a second pass for the comparison with alex-brecher/shopify-multi-store. Voice lint clean on the hard checks for both. Two layout edits after the copy came back: step 1 points at the command shown under it instead of repeating it, and the hero proof line comes from the second pass.

## header
Nav: How it works · Why choose it · Safety · Set up · Questions
Button: Connect your stores

## hero
Eyebrow: shopify-multistore-mcp · Free, MIT licence
Headline lead: Ask every client store at once,
Headline continuation: with each answer naming its store.
Subhead: shopify-multistore-mcp connects your AI app to several Shopify stores. Each store signs in on Shopify's approval page, without creating apps or copying API keys.
Button: Connect your stores
Secondary link: View source on GitHub
Fine print: Works with Claude Desktop, Claude Code, Cursor, VS Code, Windsurf and Codex. Not affiliated with Shopify.
Proof line: 30 of 30 right in our mock test, vs 27 for alex-brecher/shopify-multi-store.

## demo
Question label: Your question
Chip 1: Unfulfilled orders | How many orders are unfulfilled in each store?
Chip 2: Low stock | Which products have under 5 in stock?
Chip 3: Yesterday's sales | What did each store sell yesterday?
Answers 1: harbour: 14 unfulfilled, oldest from Tuesday. | tidewater: 3 unfulfilled, all from today. | northpaper: 27 unfulfilled, 9 waiting on stock.
Answers 2: harbour: 2 products, Field cap (1), Linen apron (3). | tidewater: None under 5 in stock. | northpaper: 4 products, led by A5 notebook, ruled (0).
Answers 3: harbour: A$4,812 across 61 orders. | tidewater: NZ$1,206 across 18 orders. | northpaper: £2,390 across 22 orders.
Caption: Sample stores and figures shown for illustration.

## problem
Headline: Shopify's AI connector holds one store at a time.
Body: Even when your stores sit in the same organisation, switching stores in Shopify's connector makes you approve access again.
Note: Shopify's admin switches stores fine; it's only the AI connector that holds one store.
Quote attribution: Shopify staff, Shopify Developer Community, 7 October 2026

## outcomes
Title: Nine reports across every store.
Body: Ask once and four stores answer together: sales in each store's currency (without test or cancelled orders), unfulfilled orders, low stock to move, and catalogue gaps.
Sample: Low stock: tidewater is out of coffee beans; harbour has 18.

Title: Every answer names its store.
Body: Each reply starts with its store name and address, so client numbers don't mix. Outside the nine reports, your assistant checks Shopify's docs and asks every store.
Sample: store: harbour (harbour-coffee.myshopify.com)

Title: Changes go to one store.
Body: Edits run on one named store and never retry. Mark any store **read-only**; creating keys, charging a store or changing app access is blocked outright.
Sample: Read-only stores refuse edits; billing and access changes stay blocked.

Title: Seven starting prompts in chat.
Body: Apps like Claude Desktop show seven ready-made prompts: morning check, sales, unfulfilled orders, low stock, compare a product, catalogue check and connect a store.
Sample: Pick "morning check" and every connected store answers at once.

## why choose it (section id "proof")
Eyebrow: Compared head to head
Headline: Built for agencies: connect client stores without creating apps
Intro: We tested shopify-multistore-mcp against alex-brecher/shopify-multi-store across three mock stores (real-store sign-in isn't tested yet). For agencies, it comes down to browser sign-in without copying keys.
Win 1 figure: 100%
Win 1 label: 30/30 answers right, vs 27/30 (90%)
Win 2 figure: 1
Win 2 label: median tool call per question, vs 2
Win 3 figure: 2.3¢
Win 3 label: median AI cost per question, vs 3.7¢
Win 4 figure: 7.4 s
Win 4 label: median time per question, vs 8.8 s
Table heading: How the two options compare
Row 1: Connecting a store | Approve on Shopify's browser page; no app created | Create a Shopify app and copy secret keys
Row 2: Secret keys | Never reads or copies your store keys | Saves app secrets in your computer's keychain
Row 3: Read-only per store | Yes; any store can refuse all changes | No per-store read-only switch in settings
Row 4: Starter prompts in chat | Seven ready-made starting prompts in the app | None included
Row 5: Shopify API version | Follows newest stable release (2026-10) | Pinned to older 2026-07 release
Row 6: Unfulfilled order counts | Counts partially fulfilled orders as waiting, like admin | Leaves out partially fulfilled orders (0/3 in test)
Row 7: Team and browser access | Runs on your own computer, not hosted | Hosts for teams; works in ChatGPT and claude.ai
Row 8: Reports and store edits | 9 reports and one single-store edit tool | 17 reports, guided edits, and 514 admin changes
Table note: Rows 7 and 8 are where alex-brecher/shopify-multi-store leads, along with raw speed in the timing table below.
Speed heading: Measured speed, cost, and install size
Closing line: Pick alex-brecher/shopify-multi-store for team hosting, browser chat, or broad edits; pick shopify-multistore-mcp for desktop sign-in without app keys.

## safety
Headline: What it touches, and what it doesn't.
Point: No keys in your files. Each store signs in on Shopify's approval page; shopify-multistore-mcp never reads or copies access keys. Store data needed for answers still goes to your AI provider.
Point: Newest Shopify tools, checked first. Updates to Shopify's tools run only after npm integrity, registry signature and start-up checks pass. If a release fails, the last working version keeps running.
Point: One folder per client store. Each store's sign-in stays in its own folder on your computer, so four stores answer together without clashing. Removing a store deletes its folder.
Point: Open source under MIT licence. Every line of code is public at fledgeling-co/shopify-multistore-mcp on GitHub. Settings from shopify-multi-mcp (0.1) and StoreRow (0.2) keep working.
Checks caption: Three checks pass before any Shopify tool update runs.

## setup
Headline: Set it up with one command.
Needs: You'll need **Node.js 22.12 or newer**, a supported AI app (Claude Desktop, Claude Code, Cursor, VS Code, Windsurf or Codex), and permission to approve apps on each Shopify store.
Step 1 title: Run the setup command
Step 1 body: Run the command below in Mac Terminal or Windows Command Prompt. It checks Node.js, backs up your AI settings, and adds the connector.
Step 1 picture caption: Setup finds your AI apps and backs up settings.
Step 2 title: Approve each client store
Step 2 body: Enter each store's `myshopify.com` address and approve it on Shopify's browser page. You can also connect stores from chat: "Connect acme.myshopify.com as acme".
Step 2 picture caption: Approve each store on Shopify's page in your browser.
Step 3 title: Restart and ask
Step 3 body: Quit and reopen your AI app, then ask your stores. First start downloads Shopify's tools (about 30 seconds).
Step 3 picture caption: One question returns answers labelled with each store's name.
Manual toggle: Prefer pasting config blocks yourself?
Recover heading: If something goes wrong
Recover:
- If your AI app doesn't see it: fully quit and reopen the app after setup.
- If you see "node: command not found": install Node.js 22.12 or newer from nodejs.org, then restart.
- If a store's session expired: ask your assistant to connect that store again and approve it.
- If the approval page refuses: check with the store owner that your login can approve apps.

## questions
Q: Is this an official Shopify product?
A: No. shopify-multistore-mcp is an independent open-source tool from fledgeling, and isn't affiliated with or endorsed by Shopify. Each store signs in on Shopify's own approval page using Shopify's published developer tools.
Q: What does it cost?
A: Nothing; it's free under the MIT licence. Your AI app's own subscription or usage bill is separate.
Q: What do I need?
A: A computer with Node.js 22.12 or newer, a supported AI app (Claude Desktop, Claude Code, Cursor, VS Code, Windsurf or Codex), a browser to approve each store, and roughly 425 MB of disk space once Shopify's tools download.
Q: Can it change my store?
A: Only one named store at a time, and edits never retry so nothing runs twice. Mark any store read-only in your config to refuse all edits. Changes creating access keys, charging the store or changing app access are blocked outright.
Q: Does it work in claude.ai in the browser?
A: No. shopify-multistore-mcp runs on your own computer, so it works with desktop and code apps like Claude Desktop and Cursor, not browser tabs like claude.ai or ChatGPT.
Q: How does it compare with alex-brecher/shopify-multi-store?
A: Both carry the MIT licence. alex-brecher/shopify-multi-store offers team hosting (claude.ai and ChatGPT), 5 to 12 ms calls, 17 reports and broader edits. shopify-multistore-mcp skips creating apps or copying keys, locks read-only stores, and scored 30/30 in our test.
Q: What if I'm upgrading from StoreRow or shopify-multi-mcp?
A: Your old settings keep working as they are. shopify-multistore-mcp is the new name for StoreRow (0.2) and shopify-multi-mcp (0.1), and now asks four stores side by side (checking 8 stores dropped from 4.2 s in 0.2 to 1.1 s).

## status
Tag: v0.3.1
Body: Early release. Tested end to end against Shopify's tools and a schema-checked mock API; nobody has signed in to a real store with it yet. Report issues at github.com/fledgeling-co/shopify-multistore-mcp/issues.

## final
Headline: Bring every client store into one chat.
Body: Free, open source, and set up with one command.
Button: Connect your stores

## footer
Legal: Not affiliated with or endorsed by Shopify. Shopify is a trademark of Shopify Inc.
