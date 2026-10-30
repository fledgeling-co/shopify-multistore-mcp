# shopify-multi-mcp

One MCP server for many Shopify stores. Each store keeps its own Shopify sign-in, every store tool takes a `store` argument naming the store it acts on, and the Shopify code doing the work is always the newest verified release of Shopify's own CLI and Dev MCP.

It exists because Shopify's hosted MCP (the "Shopify" connector in Claude, `https://setup.shopify.com/mcp`) holds one store per sign-in and accepts only OAuth clients Shopify recognises (it rejected this project's own client registration), so a third-party server cannot run several copies of it. Shopify CLI 5 can hold one session per store, and its `store execute` command runs Admin GraphQL against whichever store you name. This server drives that for every store you connect, and passes Shopify's Dev MCP through for documentation and validation. [docs/REVIEW.md](docs/REVIEW.md) has the full review of Shopify's MCP servers and connectors behind that choice.

## Set up

You need Node.js 22.12 or newer (Shopify CLI 5 requires it), a browser on the machine that runs the server, and a Shopify account that can approve app access on each store.

**1. Add the server to your MCP client.** For Claude Code:

```bash
claude mcp add shopify -- npx -y github:fledgeling-co/shopify-multi-mcp
```

For Claude Desktop, Cursor, VS Code and other clients that take JSON:

```json
{
  "mcpServers": {
    "shopify": { "command": "npx", "args": ["-y", "github:fledgeling-co/shopify-multi-mcp"] }
  }
}
```

For Codex (`~/.codex/config.toml`):

```toml
[mcp_servers.shopify]
command = "npx"
args = ["-y", "github:fledgeling-co/shopify-multi-mcp"]
```

**2. Connect each store.** Ask the model, for example "connect acme-au.myshopify.com as au", and it calls `connect_store`. Or run it in a terminal:

```bash
npx -y github:fledgeling-co/shopify-multi-mcp connect au acme-au.myshopify.com --label "AU retail"
```

A browser window opens on Shopify's approval page for that store. Approve it, then repeat for the next store. Add `--read-only` to request read scopes only and refuse mutations on that store.

**3. Check everything.** This installs the newest Shopify CLI and Dev MCP, checks both, validates the built-in queries against the newest Admin schema and reports which stores are signed in:

```bash
npx -y github:fledgeling-co/shopify-multi-mcp doctor
```

The first run downloads Shopify CLI and Dev MCP into `~/.cache/shopify-multi-mcp`; it took 31 seconds on the machine this was built on. Later starts reuse the verified copies.

## How a model works with it

The server's instructions list the configured stores and the working rules, and every store tool takes `store` as an enum of the store names, so a model sees the valid choices in the schema itself. With one store connected, `store` is optional. Each result starts with a line such as `store: au (acme-au.myshopify.com)`, so the store stays attached to the data in the model's context.

| Tool | What it does |
| --- | --- |
| `list_stores` | Stores, domains, labels, read-only flag, sign-in state, scopes, token expiry, and the Shopify CLI and Dev MCP versions in use. Also lists stores signed in with Shopify CLI but not yet added. |
| `connect_store` | Adds a store or signs in again. Opens Shopify's approval page and returns within about 20 seconds; calling it again waits for the result. |
| `get_shop` | Name, domains, email, currency, timezone and plan of one store. |
| `search_products` | Product search using Shopify search syntax, with paging. |
| `list_orders` | Orders newest first, with Shopify order search syntax and paging. |
| `graphql_query` | Any read-only Admin GraphQL query on one store. Mutations are refused here. |
| `graphql_mutation` | An Admin GraphQL mutation on one store. Refused for read-only stores. |
| `graphql_query_all_stores` | One read-only query on several stores, results side by side and labelled. |
| Dev MCP tools | Passed through under Shopify's own names: as of Dev MCP 1.18.0, `learn_shopify_api`, `search_docs_chunks`, `validate`, `validate_theme` and `feedback`. |

When a store's session is missing or expired, the error names the store and tells the model to call `connect_store` with it. When `store` is missing and several stores are connected, the error lists them rather than picking one.

## Staying current

Every time the server starts, it asks the npm registry for the newest `@shopify/cli` and `@shopify/dev-mcp`. A new release is installed into the cache and only used after three checks pass: npm's integrity check during install, `npm audit signatures` finding no invalid registry signatures, and a smoke test (`shopify --version` for the CLI; start it and list its tools for Dev MCP). While the server runs it checks again every 15 minutes, at the moment a tool is used. A promoted CLI release serves the next call; a new Dev MCP is started beside the old one, swapped in between calls, and announced to the client with `notifications/tools/list_changed`.

Nothing about Shopify's tools is frozen into this package. Dev MCP's tool names, descriptions and schemas are read from the running release, `store execute` uses the newest stable Admin API version unless a call sets `api_version`, and `doctor` re-validates the three built-in queries against the Admin schema in the newest Dev MCP. If the registry is unreachable or a release fails a check, the last verified version keeps serving and `list_stores` shows why.

Settings that change this, as environment variables in your MCP client config:

| Variable | Effect |
| --- | --- |
| `SHOPIFY_MULTI_MCP_UPDATE_MINUTES` | Minutes between update checks while running. Default `15`. |
| `SHOPIFY_MULTI_MCP_UPDATES=session` | Resolve versions once per server start and keep them for the session. |
| `SHOPIFY_CLI_VERSION`, `SHOPIFY_DEV_MCP_VERSION` | Pin an exact version instead of the newest. |
| `SHOPIFY_MULTI_MCP_HIDE_TOOLS` | Comma-separated Dev MCP tools to leave out, for example `feedback`. |
| `OPT_OUT_INSTRUMENTATION=true` | Shopify's own telemetry opt-out for Dev MCP, passed through unchanged. |

`npx -y github:fledgeling-co/shopify-multi-mcp` installs this server from the repository's default branch. To hold it at a release, use `github:fledgeling-co/shopify-multi-mcp#v0.1.0`.

## Configuration

Connected stores are saved in `~/.config/shopify-multi-mcp/stores.json` (or under `$XDG_CONFIG_HOME`, or `$SHOPIFY_MULTI_MCP_HOME`):

```json
{
  "stores": {
    "au": { "domain": "acme-au.myshopify.com", "label": "AU retail", "readOnly": false },
    "nz": { "domain": "acme-nz.myshopify.com", "readOnly": true, "scopes": ["read_products", "read_orders"] }
  },
  "pins": { "@shopify/cli": "latest", "@shopify/dev-mcp": "latest" },
  "updateCheckMinutes": 15
}
```

Stores can also come from the client config without the file: `--store au=acme-au.myshopify.com` (repeatable), `--read-only nz`, or `SHOPIFY_STORES="au=acme-au.myshopify.com,nz=acme-nz.myshopify.com"`. Those add to the saved stores for that run. Signing in is still per store, through `connect_store` or the `connect` command.

The default scopes are read and write for products, inventory, orders, draft orders, fulfillments, customers, discounts, content, metaobjects, files and publications, plus read access to locations, themes, reports and analytics. Pass `--scopes` or `scopes` to change them. Shopify CLI merges new scopes with the ones a store already granted.

## What it refuses, and what it leaves alone

- It never reads, copies or stores Shopify tokens. Sessions stay in Shopify CLI's own storage, and this server only names the store on each `shopify store` command.
- `graphql_query` and `graphql_query_all_stores` refuse mutations, and Shopify CLI refuses them too unless `--allow-mutations` is passed, which only `graphql_mutation` does.
- Read-only stores refuse `graphql_mutation` and are connected with read scopes only.
- It runs one Shopify CLI command at a time. Every `store execute` can refresh a token, the CLI keeps all store sessions in one file, and each refresh hands back a new refresh token, so two CLI processes writing at once could keep the stale one and lose the session. Cross-store queries therefore run one store after another; a call took about 450 ms here.
- `remove` forgets a store here but does not revoke Shopify access. Uninstall the app in that store's admin to revoke it.
- Sign-in needs a browser on the machine running the server, because Shopify CLI receives the approval on `127.0.0.1:13387`. On a remote or headless machine, forward that port or sign in there with `shopify store auth` first.

## Status

Version 0.1.0. Tested on macOS with Node 22.23.1 against Shopify CLI 5.0.0 and Dev MCP 1.18.0: 29 unit and protocol tests, `doctor` (install, signature check, smoke tests, built-in queries valid against the newest Admin schema), and an end-to-end stdio session covering tool listing, the Dev MCP hand-off, store selection errors, read-only refusal and Shopify CLI's real "no stored app authentication" error. The browser approval in `connect_store` and calls against a real store have not been run yet, because that needs a store account; the first person to connect one is testing that path.

## Development

```bash
npm install
npm test
node bin/shopify-multi-mcp.js --help
```

## License

MIT
