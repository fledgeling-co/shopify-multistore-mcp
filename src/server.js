import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { CLI_PACKAGE, CliError } from './shopify-cli.js';
import { DEV_MCP_PACKAGE } from './dev-mcp.js';
import {
  CURATED_QUERIES, OWN_TOOL_NAMES, ToolError, assertNotMutation, buildTools, connectArgs,
  errorResult, resolveStore, storeResult, textResult,
} from './tools.js';

const FIRST_INSTALL_WAIT_MS = 45_000;
const CONNECT_WAIT_MS = 20_000;
const RECONNECT_WAIT_MS = 50_000;

export function buildInstructions(stores) {
  const names = Object.values(stores);
  const roster = names.length
    ? names.map((s) => `- ${s.name}: ${s.domain}${s.label ? ` (${s.label})` : ''}${s.readOnly ? ' [read-only]' : ''}`).join('\n')
    : '- none yet: call connect_store to add one';
  return `This server works on several Shopify stores. Every store tool takes a "store" argument naming the store to act on.

Stores configured when this session started (call list_stores for the live list and sign-in status):
${roster}

How to work:
- Call list_stores when you are unsure which stores exist or whether they are signed in.
- Name the store on every call, even when the user mentioned it earlier, so each result is tied to the right store.
- Look ids up in the store you are acting on. An id such as gid://shopify/Product/123 exists in one store only, so an id copied from another store fails or, worse, matches an unrelated record.
- Reads: get_shop, search_products and list_orders cover common questions; graphql_query covers the rest. To compare stores, use graphql_query_all_stores.
- Writes: graphql_mutation. Confirm the store and the change with the user first, because a mutation changes a live store, then check userErrors in the result.
- For GraphQL you are unsure of, call learn_shopify_api (api "admin") and Shopify's validation tool (named validate in Dev MCP 1.18) before running it. The conversationId from learn_shopify_api belongs to those Shopify Dev MCP tools only; the store tools take "store" instead.
- If a store is not signed in or its session expired, call connect_store with its name and tell the user to approve in the browser window that opens.
- Use these tools for store work rather than running "shopify store execute" or "shopify store auth" in a shell: they already do that for every store and keep the sessions from overwriting each other.`;
}

function cliFailure(err, store) {
  if (err instanceof CliError && err.notAuthenticated && store) {
    return errorResult(`Store "${store.name}" (${store.domain}) is not signed in, or its session expired. Call connect_store with store "${store.name}" and ask the user to approve in the browser. Shopify CLI said: ${err.message}`);
  }
  return errorResult(err.message);
}

export class MultiStoreServer {
  constructor({ config, toolchain, cli, devMcp, version, log = () => {}, hiddenTools = (process.env.SHOPIFY_MULTI_MCP_HIDE_TOOLS || '').split(',') }) {
    this.config = config;
    this.toolchain = toolchain;
    this.cli = cli;
    this.devMcp = devMcp;
    this.log = log;
    this.hiddenTools = new Set(hiddenTools.map((s) => s.trim()).filter(Boolean));
    this.pendingAuth = new Map();
    this.devToolNames = new Map(); // exposed name -> Dev MCP name
    this.server = new Server(
      { name: 'shopify-multi-mcp', title: 'Shopify (multiple stores)', version },
      { capabilities: { tools: { listChanged: true } }, instructions: buildInstructions(config.stores()) },
    );
    this.server.setRequestHandler(ListToolsRequestSchema, () => this.listTools());
    this.server.setRequestHandler(CallToolRequestSchema, (req) => this.callTool(req.params.name, req.params.arguments || {}));
    toolchain.onUpdate = (pkg) => {
      if (pkg === DEV_MCP_PACKAGE) this.devMcp.current().then(() => this.devReady(), () => {});
    };
  }

  toolsChanged() {
    this.server.sendToolListChanged().catch(() => {});
  }

  // Announce Dev MCP's tools once per running version rather than on every start attempt.
  devReady() {
    const version = this.devMcp.active?.version;
    if (version && version !== this.announcedDev) {
      this.announcedDev = version;
      this.toolsChanged();
    }
  }

  // Install or update both Shopify packages in the background so the first call is fast.
  warmUp() {
    this.cli.binary().catch((err) => this.log(`Shopify CLI not ready: ${err.message}`));
    this.devMcp.current().then(() => this.devReady(), (err) => this.log(`Dev MCP not ready: ${err.message}`));
  }

  async listTools() {
    this.devToolNames.clear();
    const devTools = [];
    // Only list Dev MCP tools once it is running; a first install can take a minute and a
    // slow tools/list makes clients give up. toolsChanged() fires when it is ready.
    if (this.devMcp.active) {
      for (const t of await this.devMcp.listTools()) {
        if (this.hiddenTools.has(t.name)) continue;
        const exposed = OWN_TOOL_NAMES.has(t.name) ? `dev_${t.name}` : t.name;
        this.devToolNames.set(exposed, t.name);
        devTools.push({ ...t, name: exposed });
      }
    } else {
      this.devMcp.current().then(() => this.devReady(), () => {});
    }
    const validator = devTools.find((t) => /^validate(_graphql\w*)?$/.test(t.name))?.name;
    return { tools: [...buildTools(this.config.stores(), validator ? { validator } : {}), ...devTools] };
  }

  async callTool(name, args) {
    try {
      switch (name) {
        case 'list_stores': return await this.listStores();
        case 'connect_store': return await this.connectStore(args);
        case 'get_shop': return await this.curated('get_shop', args, {});
        case 'search_products': return await this.curated('search_products', args, { query: args.query, first: args.first ?? 20, after: args.after });
        case 'list_orders': return await this.curated('list_orders', args, { query: args.query, first: args.first ?? 20, after: args.after });
        case 'graphql_query': return await this.graphql(args, false);
        case 'graphql_mutation': return await this.graphql(args, true);
        case 'graphql_query_all_stores': return await this.queryAll(args);
        default: break;
      }
      if (!this.devToolNames.size && this.devMcp.active) await this.listTools();
      const devName = this.devToolNames.get(name);
      if (devName) return await this.devMcp.callTool(devName, args);
      return errorResult(`Unknown tool "${name}". Call list_stores, or list the tools again: the Shopify Dev MCP tools may still be starting.`);
    } catch (err) {
      if (err instanceof ToolError) return errorResult(err.message);
      return errorResult(`${name} failed: ${err.message}`);
    }
  }

  // The first call after install waits for the CLI; past FIRST_INSTALL_WAIT_MS it returns a
  // message to retry instead of holding the client on an npm install.
  async withCliReady(fn) {
    if (!this.toolchain.status(CLI_PACKAGE).version) {
      const ready = this.cli.binary();
      const timedOut = await Promise.race([ready.then(() => false), new Promise((r) => setTimeout(() => r(true), FIRST_INSTALL_WAIT_MS).unref())]);
      if (timedOut) throw new ToolError('Shopify CLI is still installing (first run only, about a minute). Try the same call again shortly.');
    }
    return fn();
  }

  async run(store, request) {
    return this.withCliReady(async () => {
      try {
        const { result, cliVersion } = await this.cli.execute(store.domain, request);
        return { ok: true, result, cliVersion };
      } catch (err) {
        return { ok: false, err };
      }
    });
  }

  async curated(tool, args, variables) {
    const store = resolveStore(this.config.stores(), args.store);
    const out = await this.run(store, { query: CURATED_QUERIES[tool], variables: stripUndefined(variables) });
    return out.ok ? storeResult(store, out.result) : cliFailure(out.err, store);
  }

  async graphql(args, mutation) {
    const store = resolveStore(this.config.stores(), args.store);
    if (!args.query) throw new ToolError('"query" is required.');
    if (!mutation) assertNotMutation(args.query);
    if (mutation && store.readOnly) throw new ToolError(`Store "${store.name}" is read-only, so mutations are refused. Reconnect it with read_only false to allow changes.`);
    const out = await this.run(store, { query: args.query, variables: args.variables, apiVersion: args.api_version, allowMutations: mutation });
    return out.ok ? storeResult(store, out.result) : cliFailure(out.err, store);
  }

  async queryAll(args) {
    const all = this.config.stores();
    if (!args.query) throw new ToolError('"query" is required.');
    assertNotMutation(args.query);
    const picked = args.stores?.length && !args.stores.includes('all')
      ? args.stores.map((s) => resolveStore(all, s))
      : Object.values(all);
    if (!picked.length) throw new ToolError('No stores are connected yet. Call connect_store first.');
    const results = [];
    for (const store of picked) {
      const out = await this.run(store, { query: args.query, variables: args.variables, apiVersion: args.api_version });
      results.push(out.ok
        ? { store: store.name, domain: store.domain, ...out.result }
        : { store: store.name, domain: store.domain, error: cliFailure(out.err, store).content[0].text });
    }
    const text = results.map((r) => `store: ${r.store} (${r.domain})\n${JSON.stringify(r.error ? { error: r.error } : { data: r.data, extensions: r.extensions }, null, 2)}`).join('\n\n');
    return textResult(text, { results });
  }

  async listStores() {
    const stores = this.config.stores();
    let sessions = [];
    let sessionError = null;
    try {
      sessions = await this.withCliReady(() => this.cli.sessions());
    } catch (err) {
      sessionError = err.message;
    }
    const byDomain = new Map(sessions.map((s) => [String(s.store).toLowerCase(), s]));
    const now = Date.now();
    const rows = Object.values(stores).map((s) => {
      const session = byDomain.get(s.domain);
      const refreshExpired = session?.refreshTokenExpiresAt && Date.parse(session.refreshTokenExpiresAt) < now;
      const pending = this.pendingAuth.get(s.name);
      return {
        store: s.name,
        domain: s.domain,
        label: s.label || null,
        readOnly: Boolean(s.readOnly),
        signedIn: Boolean(session) && !refreshExpired,
        awaitingApproval: Boolean(pending),
        scopes: session?.scopes || [],
        user: session?.associatedUser?.email || null,
        expiresAt: session?.expiresAt || null,
        refreshTokenExpiresAt: session?.refreshTokenExpiresAt || null,
      };
    });
    const known = new Set(Object.values(stores).map((s) => s.domain));
    const unconfigured = sessions.map((s) => String(s.store).toLowerCase()).filter((d) => !known.has(d));
    const payload = {
      stores: rows,
      signedInButNotAdded: unconfigured,
      toolchain: { shopifyCli: this.toolchain.status(CLI_PACKAGE), devMcp: this.devMcp.status() },
      ...(sessionError ? { sessionError } : {}),
    };
    const lines = rows.length
      ? rows.map((r) => `${r.store}: ${r.domain}${r.label ? ` (${r.label})` : ''} - ${r.signedIn ? 'signed in' : r.awaitingApproval ? 'waiting for browser approval' : 'not signed in'}${r.readOnly ? ', read-only' : ''}`)
      : ['No stores connected. Call connect_store with a name and myshopify.com domain.'];
    if (unconfigured.length) lines.push(`Signed in with Shopify CLI but not added here: ${unconfigured.join(', ')} (add with connect_store).`);
    lines.push(`Shopify CLI ${payload.toolchain.shopifyCli.version || 'not installed yet'}, Dev MCP ${payload.toolchain.devMcp.running || payload.toolchain.devMcp.version || 'not running yet'}.`);
    return textResult(`${lines.join('\n')}\n\n${JSON.stringify(payload, null, 2)}`, payload);
  }

  async connectStore(args) {
    const before = this.config.stores();
    const existing = before[String(args.store || '').trim().toLowerCase()];
    const spec = connectArgs(args, existing);
    const clash = Object.values(before).find((s) => s.domain === spec.domain && s.name !== spec.name);
    if (clash) throw new ToolError(`${spec.domain} is already connected as "${clash.name}". Use that name.`);
    const store = await this.config.upsertStore(spec.name, { domain: spec.domain, label: spec.label, readOnly: spec.readOnly, scopes: spec.scopes });
    if (!existing || existing.domain !== spec.domain || Boolean(existing.readOnly) !== spec.readOnly) this.toolsChanged();

    let handle = this.pendingAuth.get(spec.name);
    const waitMs = handle ? RECONNECT_WAIT_MS : CONNECT_WAIT_MS;
    if (!handle) {
      await this.withCliReady(async () => {});
      handle = this.cli.startAuth(spec.domain, spec.scopes);
      this.pendingAuth.set(spec.name, handle);
      handle.done.finally(() => { if (this.pendingAuth.get(spec.name) === handle) this.pendingAuth.delete(spec.name); }).catch(() => {});
    }
    const outcome = await Promise.race([
      handle.done.then((r) => ({ state: 'done', r }), (err) => ({ state: 'failed', err })),
      new Promise((r) => setTimeout(() => r({ state: 'waiting' }), waitMs).unref()),
    ]);
    if (outcome.state === 'done') {
      const scopes = outcome.r.scopes?.join(', ') || spec.scopes.join(', ');
      return textResult(`Connected "${store.name}" (${store.domain})${store.readOnly ? ' read-only' : ''}. Granted scopes: ${scopes}.`, { store: store.name, domain: store.domain, ...outcome.r });
    }
    if (outcome.state === 'failed') return errorResult(`Sign-in for "${store.name}" (${store.domain}) did not complete: ${outcome.err.message}`);
    const link = handle.url ? ` If no browser window appeared, the user can open: ${handle.url}` : '';
    return textResult(`Waiting for the user to approve access to ${store.domain} in the browser window Shopify opened.${link} Call connect_store with store "${store.name}" again to wait for the result; the sign-in stays open for 5 minutes.`, { store: store.name, domain: store.domain, awaitingApproval: true });
  }
}

function stripUndefined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ''));
}
