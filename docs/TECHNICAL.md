# Shopherd Shopify MCP — technical guide

One MCP server for many Shopify stores. Each store keeps its own Shopify sign-in, every store tool takes a `store` argument naming the store it acts on, questions about several stores run on all of them at once, and the Shopify code doing the work is always the newest verified release of Shopify's own CLI and Dev MCP.

It exists because Shopify's hosted MCP (the "Shopify" connector in Claude, `https://setup.shopify.com/mcp`) holds one store per sign-in and accepts only OAuth clients Shopify recognises (it rejected this project's own client registration), so a third-party server cannot run several copies of it. Shopify CLI 5 can hold a session per store, and its `store execute` command runs Admin GraphQL against whichever store you name. Shopherd drives that for every store you connect, and passes Shopify's Dev MCP through for documentation and validation. [REVIEW.md](REVIEW.md) has the review of Shopify's MCP servers and connectors behind that choice; [evals/](../evals/README.md) has the head-to-head measurements.

## Set up

You need Node.js 22.12 or newer (Shopify CLI 5 requires it), a browser on the machine that runs the server, and a Shopify account that can approve app access on each store.

```bash
npx -y shopherd-shopify-mcp@latest setup
```

`setup` checks the Node version, finds the AI apps installed on this computer (Claude Desktop, Claude Code, Cursor, VS Code, Windsurf, Codex), adds a `shopherd-shopify-mcp` server to each, then offers to connect stores one by one. For each app it:

- backs up the config file before changing it (`<file>.backup-<time>`) and leaves a file it cannot parse untouched;
- writes the full path to the `npx` beside the Node that ran setup, and puts that Node first on `PATH`, because desktop apps started from the Dock or Start menu often do not see the terminal's `PATH`;
- replaces an entry left by the project's earlier names (shopify-multi-mcp, StoreRow) instead of adding a second server;
- uses `claude mcp add --scope user` for Claude Code, and appends a `[mcp_servers.shopherd-shopify-mcp]` table to Codex's `config.toml`.

Flags: `--client claude-desktop,cursor,vscode,windsurf,codex,claude-code` limits it to those apps, `--yes` skips the questions, `--remove` takes the entry out again.

To add it by hand instead, the command is `npx -y shopherd-shopify-mcp@latest`. Claude Desktop, Cursor and Windsurf take an `mcpServers` block, VS Code a `servers` block with `"type": "stdio"`, Codex a `[mcp_servers.shopherd-shopify-mcp]` table:

```json
{
  "mcpServers": {
    "shopherd-shopify-mcp": { "command": "npx", "args": ["-y", "shopherd-shopify-mcp@latest"] }
  }
}
```

**Connect a store** from the chat ("connect acme-au.myshopify.com as au", which calls `connect_store`), from `setup`, or in a terminal:

```bash
npx -y shopherd-shopify-mcp@latest connect au acme-au.myshopify.com --label "AU retail"
```

A browser window opens on Shopify's approval page for that store. Add `--read-only` to request read scopes only and refuse every change to that store.

**Check everything** (installs the newest Shopify CLI and Dev MCP, checks both, validates every built-in and report query against the newest Admin schema, and reports which stores are signed in):

```bash
npx -y shopherd-shopify-mcp@latest doctor
```

The first run downloads Shopify CLI and Dev MCP, about 400 MB, into `~/.cache/shopherd`; it took 31 seconds on the machine this was built on. Several servers starting at once share one download.

## How a model works with it

The server's instructions list the configured stores and the working rules, and every store tool takes `store` as an enum of the store names, so a model sees the valid choices in the schema itself. With one store connected, `store` is optional. Each result starts with a line such as `store: au (acme-au.myshopify.com)`, so the store stays attached to the data in the model's context. Results are compact JSON and are cut at 60,000 characters with a note saying so.

| Tool | What it does |
| --- | --- |
| `store_report` | A ready-made report across every store (or the ones listed), run on all of them at once and combined into one store-labelled answer. Reports are listed below. |
| `list_stores` | Stores, domains, labels, read-only flag, sign-in state, scopes, token expiry, and the Shopify CLI and Dev MCP versions in use. Also lists stores signed in with Shopify CLI but not yet added. |
| `connect_store` | Adds a store or signs in again. Opens Shopify's approval page and returns within about 20 seconds; calling it again waits for the result. |
| `get_shop` | Name, domains, email, currency, timezone and plan of one store. |
| `search_products` | Product search using Shopify search syntax, with paging. |
| `list_orders` | Orders newest first, with Shopify order search syntax and paging. |
| `graphql_query` | Any read-only Admin GraphQL query on one store. Mutations are refused here. |
| `graphql_query_all_stores` | One read-only query on several stores at once, results side by side and labelled. |
| `graphql_mutation` | An Admin GraphQL mutation on one store. Refused for read-only stores and for the blocked mutations below. |
| Dev MCP tools | Passed through under Shopify's own names: as of Dev MCP 1.18.0, `learn_shopify_api`, `search_docs_chunks`, `validate`, `validate_theme` and `feedback`. |

| Report | Answers |
| --- | --- |
| `overview` | Name, currency, plan, active and draft products, orders in the period, open unfulfilled orders and locations, per store. |
| `sales` | Orders, sales (current order totals) and average order value per store for a period, test and cancelled orders left out, each store in its own currency. |
| `unfulfilled` | Open orders not yet fully fulfilled (unfulfilled or partially fulfilled, as in Shopify admin's Unfulfilled view), by age, with the oldest per store. |
| `low_stock` | Tracked variants of active products at or below a threshold (default 5), and for each SKU, which other store has stock. |
| `find_product` | One product by SKU, handle or title words in every store: status, price, compare-at price and stock per variant. |
| `catalog_gaps` | Products (by handle) missing from some stores, and products whose status differs between stores. |
| `catalog_health` | Active products with no image, an image without alt text, an empty description, no SEO description, no product type or a zero price. |
| `duplicate_skus` | SKUs used twice inside a store, and SKUs that point at different products in different stores. |
| `recent_changes` | Products updated in the period, newest first. |

Periods default to the last 7 days; `days`, `since` and `until` change them, and a bare date is read in each store's own time zone. Large stores are read up to `max_pages` pages (100 to 250 records each) and the answer says when it stopped early. Every report query is validated against the newest Admin schema by `doctor`.

The server also offers seven prompts, which apps such as Claude Desktop show as ready-made starting points: `morning-check`, `sales`, `unfulfilled-orders`, `low-stock`, `compare-product`, `catalogue-check` and `connect-store`.

When a store's session is missing or expired, the error names the store and tells the model to call `connect_store` with it. When `store` is missing and several stores are connected, the error lists them rather than picking one.

## Speed

Each Shopify call is one Shopify CLI process, which costs about 470 ms to start on the machine this was built on. Calls for different stores run side by side, four at a time by default (`SHOPHERD_CONCURRENCY`); calls for the same store run in order.

That is safe because every store connected since 0.3.0 keeps its Shopify CLI sign-in in its own folder (`~/.config/shopherd/sessions/<store>`, given to the CLI as its home folder). Every `store execute` can refresh a token and each refresh hands back a new refresh token, so two CLI processes writing one shared session file at once could keep the stale one and lose the session; with a file per store, that cannot happen. Stores signed in before 0.3.0 share the CLI's default folder and still run one at a time; connecting them again moves them to their own folder.

Measured against the eval mock (see [evals/](../evals/README.md)), a report across 8 stores took 1.1 s, against 4.2 s when stores run one at a time.

## Staying current

Every time the server starts, it asks the npm registry for the newest `@shopify/cli` and `@shopify/dev-mcp`. A new release is installed into the cache and only used after three checks pass: npm's integrity check during install, `npm audit signatures` finding no invalid registry signatures, and a smoke test (`shopify --version` for the CLI; start it and list its tools for Dev MCP). While the server runs it checks again every 15 minutes, at the moment a tool is used. A promoted CLI release serves the next call; a new Dev MCP is started beside the old one, swapped in between calls, and announced to the client with `notifications/tools/list_changed`.

Installs take a lock, so several servers starting together (two AI apps opened at once) share one download, and an install interrupted part-way is swept away the next time a server starts.

Nothing about Shopify's tools is frozen into this package. Dev MCP's tool names, descriptions and schemas are read from the running release, `store execute` uses the newest stable Admin API version unless a call sets `api_version`, and `doctor` re-validates every built-in and report query against the Admin schema in the newest Dev MCP. If the registry is unreachable or a release fails a check, the last verified version keeps serving and `list_stores` shows why.

| Variable | Effect |
| --- | --- |
| `SHOPHERD_CONCURRENCY` | How many stores to query at once. Default `4`. |
| `SHOPHERD_UPDATE_MINUTES` | Minutes between update checks while running. Default `15`. |
| `SHOPHERD_UPDATES=session` | Resolve versions once per server start and keep them for the session. |
| `SHOPIFY_CLI_VERSION`, `SHOPIFY_DEV_MCP_VERSION` | Pin an exact version instead of the newest. |
| `SHOPHERD_HIDE_TOOLS` | Comma-separated Dev MCP tools to leave out, for example `feedback`. |
| `SHOPHERD_HOME`, `SHOPHERD_CACHE` | Use these folders for settings and downloads. |
| `OPT_OUT_INSTRUMENTATION=true` | Shopify's own telemetry opt-out for Dev MCP, passed through unchanged. |

`npx -y shopherd-shopify-mcp@latest` asks npm for the newest release each time your app starts it. To hold it at a release, use `shopherd-shopify-mcp@0.3.0`.

The project was called shopify-multi-mcp until 0.2.0 and StoreRow in 0.2.0; from 0.3.0 it is Shopherd Shopify MCP (npm `shopherd-shopify-mcp`, with `shopherd` as a short command once installed). The `SHOPIFY_MULTI_MCP_*` and `STOREROW_*` variables still work, and existing `~/.config` and `~/.cache` folders under those names are used when the `shopherd` ones do not exist.

## Configuration

Connected stores are saved in `~/.config/shopherd/stores.json` (or under `$XDG_CONFIG_HOME`, or `$SHOPHERD_HOME`):

```json
{
  "stores": {
    "au": { "domain": "acme-au.myshopify.com", "label": "AU retail", "readOnly": false, "session": "own" },
    "nz": { "domain": "acme-nz.myshopify.com", "readOnly": true, "scopes": ["read_products", "read_orders"], "session": "own" }
  },
  "pins": { "@shopify/cli": "latest", "@shopify/dev-mcp": "latest" },
  "updateCheckMinutes": 15
}
```

Stores can also come from the client config without the file: `--store au=acme-au.myshopify.com` (repeatable), `--read-only nz`, or `SHOPIFY_STORES="au=acme-au.myshopify.com,nz=acme-nz.myshopify.com"`. Those add to the saved stores for that run and use the CLI's default sign-in folder.

The default scopes are read and write for products, inventory, orders, draft orders, fulfillments, customers, discounts, content, metaobjects, files and publications, plus read access to locations, themes, reports and analytics. Pass `--scopes` or `scopes` to change them. Shopify CLI merges new scopes with the ones a store already granted.

## What it refuses, and what it leaves alone

- It never reads or copies Shopify tokens. Each sign-in is written and refreshed by Shopify CLI itself, in that store's own folder; Shopherd only names the store and the folder on each `shopify store` command.
- `graphql_query`, `graphql_query_all_stores` and `store_report` refuse mutations, and Shopify CLI refuses them too unless `--allow-mutations` is passed, which only `graphql_mutation` does.
- Read-only stores refuse `graphql_mutation` and are connected with read scopes only.
- Mutations that create credentials, charge the store or change app access are refused outright: `delegateAccessTokenCreate`, `storefrontAccessTokenCreate`, `appSubscriptionCreate`, `appSubscriptionTrialExtend`, `appPurchaseOneTimeCreate`, `appUsageRecordCreate` and `appRevokeAccessScopes`.
- Queries that Shopify throttles are retried up to three times with a growing wait; mutations are never retried, so a change is not applied twice.
- `remove` forgets a store and deletes its sign-in folder on this computer. Uninstall the app in that store's admin to revoke Shopify access too.
- Sign-in needs a browser on the machine running the server, because Shopify CLI receives the approval on `127.0.0.1:13387`, which is also why sign-ins run one at a time. On a remote or headless machine, forward that port or sign in there first.

## Status

Version 0.3.0, the first under the Shopherd Shopify MCP name. Tested on macOS with Node 22.23.1 against Shopify CLI 5.0.0 and Dev MCP 1.18.0: the unit and protocol tests (`npm test`), `doctor` (install, signature check, smoke tests, every built-in and report query valid against the newest Admin schema), and the evals in [evals/](../evals/README.md), which run the server end to end against a mock Admin API built on Shopify's published schema. The browser approval in `connect_store` and calls against a real store have not been run yet, because that needs a store account; the first person to connect one is testing that path.

## Development

```bash
npm install
npm test
node bin/shopherd.js --help
```

## License

MIT
