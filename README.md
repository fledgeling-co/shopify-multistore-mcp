<p align="center"><img src="design/icon/export/icon-512.png" alt="" width="128" height="128" /></p>

<h1 align="center">StoreRow</h1>

<p align="center"><strong>Every client store in one AI chat. Each answer says which store it came from.</strong></p>

<p align="center">Free and open source (MIT) · works with Claude Desktop, Claude Code, Cursor, VS Code and Codex · not affiliated with Shopify</p>

![A row of five small shopfronts under one shared rail](design/marketing/assets/banner-shopfront-row.jpg)

StoreRow lets one AI assistant work on several Shopify stores at the same time. You connect each store once, through Shopify's own approval page, and from then on you can ask your assistant about any of them, or all of them at once. Every answer starts with the name of the store it came from, so a number never lands on the wrong client.

It is built for people who look after more than one store: agencies and freelancers with client stores, and owners who run a few stores of their own.

## Why it exists

Shopify's own AI connector for Claude, ChatGPT and the other chat apps holds one store at a time. A Shopify staff member put it this way on the Shopify developer forum in October 2026: the connector "supports one store at a time, even when the stores are in the same organization. Switching stores starts a new authorization."

If you look after several stores, that means approving access again every time you move between them, and never having two stores in the same conversation. StoreRow keeps every store you connect available together.

Shopify's admin still switches between stores without any trouble. The limit is only in the AI connector.

## What you can ask

Once your stores are connected you talk to your assistant normally. For example:

- "How many orders are still unfulfilled in each store?"
- "Which products are under 5 in stock at harbour?"
- "What did each store sell yesterday?"
- "Show me the shipping settings for tidewater and northpaper side by side."
- "Draft a discount code for harbour, but check with me before you create it."

An answer comes back like this:

```
store: harbour (harbour-coffee.myshopify.com)
14 unfulfilled. The oldest is from Tuesday.

store: tidewater (tidewater-swim.myshopify.com)
3 unfulfilled, all from today.
```

The store names above are examples. You choose your own short name for each store when you connect it.

## Is it safe?

This section covers what the tool touches and what it leaves alone.

- **It never sees your Shopify password or keys.** Each store signs in on Shopify's own approval page, the same kind of page you see when you install any Shopify app. The sign-in is held by Shopify's own command-line tool on your computer, and StoreRow never reads, copies or stores it.
- **Questions cannot change anything.** Looking things up and changing things are separate. Changes go through one change tool, one store at a time, with the store named.
- **You can make a store read-only.** A read-only store refuses every change, whatever your assistant asks for. Use this for client stores where nobody has agreed to AI edits.
- **Your assistant decides when to make a change.** It is good practice to tell it to check with you first, and to keep read-only on for any store you do not want changed.
- **It always runs Shopify's newest tools.** Every time it starts, it fetches the newest release of Shopify's own tools, checks that the download is intact and signed, tests that it starts, and only then switches over. If a new release fails a check, the last good version keeps working.
- **What your assistant reads goes to your AI provider.** Store data that answers your question is sent to your AI app's provider (for example Anthropic or OpenAI) as part of the conversation, under their terms. That is true of every AI connector, Shopify's own included.
- **Every line of code is public.** You or anyone you trust can read it in this repository.

## What you need before you start

- **A Mac, Windows or Linux computer.** It runs on your own computer, not in the cloud.
- **Node.js 22.12 or newer.** This is a free program that StoreRow runs on. To check whether you have it, open Terminal (Mac) or Command Prompt (Windows) and type `node --version`. If the number is lower than 22.12, or you see "command not found", download the LTS version from [nodejs.org](https://nodejs.org) and install it like any other app.
- **An AI app that can use MCP servers.** Claude Desktop, Claude Code, Cursor, VS Code or Codex. claude.ai in a web browser cannot run it, because it lives on your computer.
- **A Shopify account that can approve app access on each store.** If you work on client stores through a collaborator account, check with the store owner that your account can approve apps.
- **A web browser on the same computer**, for the approval step.

## Set it up

### Step 1: add it to your AI app

Pick your app below, do what it says, then fully quit and reopen the app.

**Claude Desktop**

1. Open Claude Desktop, go to **Settings → Developer**, and click **Edit Config**. This opens a file called `claude_desktop_config.json`.
2. Paste the following into it. If the file already has an `"mcpServers"` section, add only the `"shopify"` part inside it.

```json
{
  "mcpServers": {
    "shopify": {
      "command": "npx",
      "args": ["-y", "storerow@latest"]
    }
  }
}
```

3. Save the file and restart Claude Desktop.

**Cursor**

Open **Cursor Settings → MCP**, choose to add a new global MCP server, and paste the same text as for Claude Desktop above.

**VS Code**

Open the Command Palette, run **MCP: Open User Configuration**, and paste:

```json
{
  "servers": {
    "shopify": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "storerow@latest"]
    }
  }
}
```

**Claude Code**

Run this once in a terminal:

```bash
claude mcp add shopify -- npx -y storerow@latest
```

**Codex**

Add this to the file `~/.codex/config.toml`:

```toml
[mcp_servers.shopify]
command = "npx"
args = ["-y", "storerow@latest"]
```

The first time your app starts it, StoreRow downloads Shopify's tools. That took about 30 seconds on our test machine. If your assistant says it is still installing, wait a minute and ask again.

### Step 2: connect each store

Ask your assistant, in your own words, to connect a store. Give it a short name you will remember and the store's `myshopify.com` address:

> Connect acme-au.myshopify.com as au

A browser window opens on Shopify's approval page for that store. Check that it shows the right store, approve it, and go back to your assistant. Repeat for each store.

You can find a store's `myshopify.com` address in its Shopify admin under **Settings → Domains**. It is the one ending in `.myshopify.com`, even if the store uses its own domain for customers.

To connect a store as read-only, say so:

> Connect acme-nz.myshopify.com as nz, read-only

### Step 3: ask

> How many orders are unfulfilled in each store?

If you are not sure which stores are connected, ask "Which stores are connected?"

## Everyday use

- **Add another store** at any time with the same "connect" request.
- **Sign in again** when a store's sign-in expires. Your assistant will tell you which store needs it and what to say.
- **Ask about one store** by naming it ("at harbour"), or **all of them** by saying so ("in each store").
- **Remove a store** by running `npx -y storerow@latest remove <name>` in a terminal. This forgets the store here. To fully revoke access, uninstall the app in that store's Shopify admin.
- **Check everything is healthy** by running `npx -y storerow@latest doctor` in a terminal. It reports whether Shopify's tools are installed and checked, and which stores are signed in.

## If something goes wrong

| What you see | What to do |
|---|---|
| Your assistant doesn't seem to know about Shopify | Fully quit and reopen the AI app after Step 1. Check the pasted text has no missing brackets or commas. |
| "Shopify CLI is still installing" | Normal on the very first use. Wait a minute and ask again. |
| "Store … is not signed in, or its session expired" | Ask your assistant to connect that store again, and approve it in the browser. |
| No browser window opens when connecting | Your assistant may show a link; if it does, open it in your browser. The approval has to happen on the same computer that runs your AI app. |
| The approval page refuses or shows an error | Your account may not be allowed to approve apps on that store. Ask the store owner. |
| "Pass store to say which store to use" | You have more than one store connected. Name the store in your question. |
| "… is read-only, so mutations are refused" | That store is read-only on purpose. Reconnect it without "read-only" if you want changes allowed. |
| `node: command not found`, or a version error | Install or update Node.js from [nodejs.org](https://nodejs.org), then restart the AI app. |

If none of these help, please [open an issue](https://github.com/fledgeling-co/storerow/issues) with what you asked and what you saw (remove any customer details first).

## Questions

**Is this an official Shopify product?**
No. It is an independent open-source project from fledgeling. It uses Shopify's own command-line tool and Shopify's Dev MCP to do the work, and every store still signs in on Shopify's own approval page.

**What does it cost?**
Nothing. It is free under the MIT licence. Your AI app's own subscription is separate.

**Can it change my store?**
Only through one change tool, one store at a time, with the store named, and never on a store you have made read-only. Your assistant decides when to use it, so ask it to check with you first.

**Does it work in claude.ai in the browser?**
Not today. It runs on your computer, so it works with desktop and terminal apps that can start it. Shopify's hosted connector only accepts AI apps that Shopify recognises, which is why this one runs on your computer instead.

**How is this different from Matrixify and other multi-store tools?**
Several tools already connect AI to more than one store, including Matrixify, ShopMCP and an open-source project called shopify-multi-store, and some of them do more, such as bulk imports or a hosted setup for a whole team. This one is free, keeps no keys of its own because it signs in through Shopify's own tool, and always runs Shopify's newest tools.

**Where is my data kept?**
The list of stores you connect is kept in a small settings file on your computer (`~/.config/storerow/stores.json`). Store sign-ins are kept by Shopify's own command-line tool on your computer. Nothing is sent to fledgeling.

## Status

This is an early release, version 0.2.0. Until 0.2.0 it was called shopify-multi-mcp, and links to the old name redirect here. It has been tested end to end against Shopify's own tools, but we have not yet signed in to a real store with it ourselves, so the first store you connect is part of the testing. If anything breaks, please [open an issue](https://github.com/fledgeling-co/storerow/issues).

## For developers

- [docs/TECHNICAL.md](docs/TECHNICAL.md): the technical guide (how it works, configuration, flags, tests).
- [docs/REVIEW.md](docs/REVIEW.md): the review of Shopify's MCP servers and connectors behind the design.
- [docs/positioning/](docs/positioning/00-decision.md): who this is for and why, with the research behind it.
- [design/](design/): the icon, its audit sheet and the marketing site.

## Licence

MIT. Not affiliated with or endorsed by Shopify. Shopify is a trademark of Shopify Inc.
