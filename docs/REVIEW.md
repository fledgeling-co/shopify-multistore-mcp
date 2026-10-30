# Review: Shopify's MCP servers and connectors

Reviewed 30–31 October 2026, to choose what a multi-store MCP server should run for each store. The question had three conditions from the brief: one Shopify instance per store, the newest Shopify code at the moment it is used, and simple setup.

The answer is Shopify CLI 5's per-store sessions for store work plus Shopify's Dev MCP for documentation and validation, both run at their newest npm release. Shopify's hosted MCP is the better product for one store but cannot be run in multiples by a third party, for the reason in finding 1. Evidence marked *probed* comes from requests made to the live service or from reading the published package during this review; the rest is cited to its source.

## 1. Shopify's hosted MCP, the "Shopify" connector in Claude

`https://setup.shopify.com/mcp` is the server behind the Shopify entry in Claude's connector directory ("Build, manage, and analyze your Shopify store"). It identifies as `shopify-mcp-server` 1.0.0 and serves 37 tools *(probed)*: curated product, collection, order, customer, inventory, discount and digital-product tools, `run-analytics-query` for ShopifyQL, `graphql_schema`, `graphql_query` and `graphql_mutation` for anything else, and pre-store tools for business names, domains and sample catalogs. Every tool carries MCP annotations (`readOnlyHint`, `destructiveHint`) and a per-tool `securitySchemes` list. Five of the 37 are `noauth` only and work with no store at all; the rest need a store token.

**One store per sign-in.** The server's own instructions say "The store comes from the user's sign-in, so don't ask which store they mean." Its `switch-shop` tool "revokes the current store's access token so the next tool call will prompt authorization for a new store" *(probed)*. A connection therefore holds exactly one store, and switching costs a fresh sign-in.

**Closed to third-party clients.** Its authorization server (`https://setup.shopify.com/auth`) supports PKCE S256, public clients and Client ID Metadata Documents, and offers no dynamic client registration endpoint *(probed)*. To test whether another client could hold its own sessions, this project published a client metadata document in the same shape as Claude Code's and sent an authorization request with it:

| client_id | Result |
| --- | --- |
| `https://claude.ai/oauth/claude-code-client-metadata` (Claude Code) | `302` to Shopify's consent page |
| This project's document on `raw.githubusercontent.com` (served `text/plain`) | `400 {"error":"unauthorized_client"}` |
| The same document on GitHub Pages (served `application/json`), redirect URIs with ports | `400 unauthorized_client` |
| The same, with port-less loopback redirect URIs copied from Claude Code's document | `400 unauthorized_client` |
| The same content at a path never requested before, ruling out a cached rejection | `400 unauthorized_client` |
| A nonexistent path on `claude.ai` | `400 unauthorized_client` |

The pattern fits an allowlist of recognised clients rather than a format problem. Impersonating an allowed client would work mechanically and misrepresent the software to Shopify and the merchant, so this project does not do it. The client metadata files and the Pages site used for the test were removed afterwards.

**Multi-store inside one client.** Claude Code keys MCP OAuth tokens by server name plus a hash of the transport, URL and headers (`${name}|sha256(...)` in Claude Code 2.1.314), so adding the hosted URL several times under different names should hold one store per entry. That was read from the binary, not exercised end to end. It costs 37 tools per store and leaves `switch-shop` on every entry, where one call revokes that entry's store. In claude.ai the connector reaches one store per account, which a Shopify developer forum request describes as blocking parallel agents on different stores, and a May 2026 report describes a token-expired loop after switching shops that the client could not recover from.

**Verdict.** The best single-store experience, and always current because Shopify runs it. Not usable as the per-store engine of a third-party server.

## 2. Shopify Dev MCP (`@shopify/dev-mcp`)

The newest release is 1.18.0, published 27 October 2026. Shopify documents installing it with `npx -y @shopify/dev-mcp@latest`; it runs locally and needs no authentication. At runtime 1.18.0 serves five tools *(probed)*: `learn_shopify_api` (the entry point, which issues a `conversationId` the other four require), `search_docs_chunks`, `validate` (GraphQL and UI components), `validate_theme`, and `feedback`, a scorecard the model is asked to send to Shopify once per conversation. The package bundles Admin API schemas from 2026-01 through 2027-01 plus `unstable`. Its telemetry honours `OPT_OUT_INSTRUMENTATION=true` and `DO_NOT_TRACK=1`.

The tool names in the published bundle's source include `validate_graphql_codeblocks`, `validate_component_codeblocks` and `validate_theme_codeblocks`, none of which 1.18.0 serves in its default mode. Reading names from the package instead of asking the running server would have shipped stale names. That is the strongest argument in this review for reading Dev MCP's tool list live rather than hardcoding it.

Dev MCP has no store. For store-scoped work, its `learn_shopify_api` guidance routes coding agents to `shopify store auth` and `shopify store execute` run in a shell *(probed)*.

**Verdict.** The right source of documentation, schema knowledge and validation. One shared instance serves every store.

## 3. Shopify CLI 5 store commands (`@shopify/cli`)

The newest release is 5.0.0, published 30 October 2026, and it requires Node 22.12 or newer. Its command manifest includes `store auth`, `store auth list`, `store execute`, `store bulk execute`, `store bulk status`, `store bulk cancel`, `store info`, `store list`, `store graphiql` and `store open`, and all but `store graphiql` take `--json` with a published result schema *(probed)*.

`store auth --store <domain> --scopes <list>` signs in with Shopify CLI's own built-in public client: PKCE against `https://<store>/admin/oauth/authorize`, a loopback listener on `127.0.0.1:13387` that waits up to five minutes, an online access token plus refresh token, and requested scopes merged with any the store already granted *(probed)*. No app has to be created in the Dev Dashboard. Sessions are kept per store on the machine, and `store auth list --json` reports each with scopes and expiry.

`store execute --store <domain> --query ...` runs Admin GraphQL against the named store, refreshes the token when it needs to, uses the newest stable Admin API version unless `--version` is given, and refuses mutations unless `--allow-mutations` is passed. For a store with no session it fails with "No stored app authentication found for <domain>." *(probed)*.

**Verdict.** The only official interface found that holds several stores at once, needs no app creation, and tracks the newest API version by default. It is a CLI rather than an MCP server, so a model needs a shell to use it directly; wrapping it gives every MCP client the same reach.

## 4. Shopify AI Toolkit

Shopify packages the Dev MCP, a single `shopify` skill and store management through Shopify CLI as the AI Toolkit, installed in Claude Code with `claude plugin install shopify-ai-toolkit@claude-plugins-official`. Per Shopify's docs the plugin updates itself, skills installed with `npx skills add Shopify/shopify-ai-toolkit` need `npx skills update`, and the earlier per-surface skills such as `shopify-admin` are deprecated.

**Verdict.** Good for coding agents with a shell. It does not give a shell-less client (Claude Desktop, ChatGPT) store access, and it does not label results by store.

## 5. Storefront, UCP, checkout and customer account servers

These serve shoppers rather than store staff. Shopify's docs say the Storefront MCP catalog and cart tools at `https://{shop}/api/mcp` were removed and replaced by the Universal Commerce Protocol endpoint `https://{shop}/api/ucp/mcp`, with `search_catalog`, `lookup_catalog`, `get_product`, `create_cart`, `get_cart`, `update_cart`, `cancel_cart` and `ask_business`, and an agent profile required on every request. Checkout MCP requires each request to be authenticated or signed. Customer Account MCP is unchanged, uses OAuth 2.0 with PKCE, and according to secondary sources needs a custom domain on the store. Third-party guides disagree on whether Checkout MCP is still a partner preview; that was left open because it does not bear on store administration.

**Verdict.** Out of scope for a staff-side multi-store server.

## 6. Community Admin API servers

`shopify-mcp` on npm (GeLi2001/shopify-mcp, 1.0.8, February 2026, 239 GitHub stars) exposes about 31 curated tools, takes one store per process, defaults to Admin API 2026-01, and authenticates with either a Dev Dashboard app's client ID and secret (24-hour tokens it refreshes itself) or a legacy `shpat_` token. `shopify-mcp-server` 1.0.1 has not been published since January 2025. Searches also surfaced `@akson/mcp-shopify` and `shopify-graphql-admin-mcp`, which were not inspected.

Since 1 January 2026 merchants cannot create new legacy custom apps in the Shopify admin. Shopify staff on the developer forum say existing ones keep working, and new integrations go through the Dev Dashboard with either the client credentials grant (tokens expire after 24 hours, and the app and store must be in the same organization) or the authorization code grant. Every token-based community server now needs that Dev Dashboard setup per organization.

**Verdict.** Workable, and it gives literal "one MCP process per store". It loses on all three conditions: community-maintained rather than Shopify's code, pinned to an older API version by default, and more setup than a browser sign-in.

## Decision

| Option | Shopify's own code | Several stores at once | Newest at use | Setup per store |
| --- | --- | --- | --- | --- |
| Hosted MCP, one connection | yes | no | yes, server-side | browser sign-in |
| Hosted MCP, added once per store in Claude Code | yes | yes in Claude Code only, untested | yes | browser sign-in |
| Community server per store | no | yes, one process each | only if resolved at launch; API pinned to 2026-01 by default | Dev Dashboard app, client ID and secret |
| Shopify CLI sessions plus Dev MCP, wrapped | yes | yes | yes, resolved from npm at use | browser sign-in |

This project takes the last row. Before building, the choice went to an out-of-family reviewer (Codex, `gpt-5.6-sol`, high effort) with the evidence above. It picked the same option and asked for four safeguards, three of which this project adopted: verify each new release (integrity, registry signatures, smoke test) before promoting it, keep a last-known-good version for rollback, and serialise CLI calls because a refresh rewrites the CLI's shared session file. Its fourth suggestion was to pin versions for a whole session. That works against the "newest when used" condition, so it is an opt-in setting (`SHOPIFY_MULTI_MCP_UPDATES=session`) rather than the default. It also suggested namespacing the Dev MCP tools. They keep their names, because Dev MCP's own descriptions refer to each other by name and renaming them would break those references.

## Open

- The browser approval in `store auth` and real store calls have not been run during this review, because they need a store account. The CLI's sign-in code was read, and its "no stored app authentication" failure was observed live.
- Whether Shopify CLI's built-in client can be granted every scope in this project's default list is unconfirmed. An unsupported scope would fail the sign-in, and the scopes are configurable for that reason.
- How long a CLI refresh token lives was not measured; `list_stores` reports `refreshTokenExpiresAt` per store once one is signed in.

## Sources

- Shopify hosted MCP and its OAuth metadata, probed directly: `https://setup.shopify.com/mcp`, `https://setup.shopify.com/.well-known/oauth-protected-resource`, `https://setup.shopify.com/.well-known/oauth-authorization-server/auth`
- [Shopify Dev MCP docs](https://shopify.dev/docs/apps/build/devmcp), [Shopify AI Toolkit docs](https://shopify.dev/docs/apps/build/ai-toolkit), [Storefront MCP and UCP docs](https://shopify.dev/docs/apps/build/storefront-mcp)
- npm packages read during the review: `@shopify/dev-mcp@1.18.0`, `@shopify/cli@5.0.0`, `@modelcontextprotocol/sdk@1.32.2`
- [Shopify connector directory listing](https://mcpservers.org/remote-mcp-servers/shopify)
- [Shopify developer forum: several development stores at once in the Claude connector](https://community.shopify.dev/t/shopify-connector-for-claude-allow-several-development-stores-at-the-same-time/38283)
- [Token-expired loop after a multi-shop switch (May 2026)](https://claudeissues.com/issue/61139-claude-ai-shopify-mcp-token-expired-loop-after-multi-shop-switch-unrecoverable-f)
- [Shopify developer forum: custom app changes](https://community.shopify.dev/t/how-to-use-shopify-s-api-with-custom-app-changes/24852)
- [GeLi2001/shopify-mcp](https://github.com/GeLi2001/shopify-mcp)
- [Matrixify: one connector per store](https://matrixify.app/tutorials/manage-your-shopify-data-with-claude-ai-using-matrixify-mcp/)
