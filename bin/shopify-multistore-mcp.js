#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { connectArgs, CURATED_QUERIES } from '../src/tools.js';
import { REPORT_QUERIES } from '../src/reports.js';
import { runSetup } from '../src/setup-cli.js';
import { CLI_PACKAGE } from '../src/shopify-cli.js';
import { MultiStoreServer } from '../src/server.js';
import { VERSION, createRuntime, log, parseArgs } from '../src/runtime.js';

const HELP = `shopify-multistore-mcp ${VERSION} (run as npx -y shopify-multistore-mcp@latest <command>)
Several Shopify stores in one AI assistant, always on the newest Shopify CLI and Dev MCP.

Usage:
  shopify-multistore-mcp setup                            Add this server to your AI apps and connect stores (start here)
        [--yes] [--client claude-desktop,cursor,vscode,windsurf,codex,claude-code] [--remove]
  shopify-multistore-mcp                    Start the MCP server on stdio (what your MCP client runs)
  shopify-multistore-mcp connect <name> <domain>          Sign in to a store and add it, e.g. connect acme acme.myshopify.com
        [--label "AU retail"] [--read-only] [--scopes read_products,write_products]
  shopify-multistore-mcp list                             Show stores and their sign-in status
  shopify-multistore-mcp remove <name>                    Forget a store (Shopify access stays until you uninstall it in admin)
  shopify-multistore-mcp doctor                           Install the newest Shopify packages and check everything works

Server flags (also usable in your MCP client config):
  --store name=domain       Add a store for this run (repeatable); or SHOPIFY_STORES="a=a.myshopify.com,b=b.myshopify.com"
  --read-only name          Refuse mutations for that store (repeatable)

Environment:
  SHOPIFY_MULTISTORE_MCP_UPDATE_MINUTES           How often to look for new Shopify releases while running (default 15)
  SHOPIFY_MULTISTORE_MCP_UPDATES=session          Resolve versions once per server start instead
  SHOPIFY_MULTISTORE_MCP_CONCURRENCY              How many stores to query at once (default 4)
  SHOPIFY_CLI_VERSION / SHOPIFY_DEV_MCP_VERSION  Pin an exact version instead of the newest`;

async function main() {
  const { positional, flags, stores, readOnly } = parseArgs(process.argv.slice(2));
  if (flags.help || positional[0] === 'help') return console.log(HELP);
  if (flags.version) return console.log(VERSION);
  const command = positional[0] || 'serve';
  if (command === 'setup') return runSetup({ flags, connect: (args) => connectFlow(args) });
  const runtime = await createRuntime({ stores, readOnly });

  if (command === 'serve') {
    const app = new MultiStoreServer({ ...runtime, version: VERSION, log });
    await app.server.connect(new StdioServerTransport());
    app.warmUp();
    const shutdown = async () => { await runtime.devMcp.close(); process.exit(0); };
    process.stdin.on('close', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
    return;
  }

  if (command === 'connect') {
    const [, name, domain] = positional;
    await connectFlow({
      store: name,
      domain,
      label: typeof flags.label === 'string' ? flags.label : undefined,
      read_only: flags['read-only'].length ? true : undefined,
      scopes: typeof flags.scopes === 'string' ? flags.scopes.split(',').map((x) => x.trim()).filter(Boolean) : undefined,
    }, runtime);
    return;
  }

  if (command === 'list') {
    const all = Object.values(runtime.config.stores());
    const sessions = await allSessions(runtime).catch((err) => { console.error(`Could not read Shopify CLI sessions: ${err.message}`); return []; });
    const byDomain = new Map(sessions.map((s) => [String(s.store).toLowerCase(), s]));
    if (!all.length) console.log('No stores yet. Add one with: shopify-multistore-mcp connect <name> <domain>');
    for (const s of all) {
      const session = byDomain.get(s.domain);
      console.log(`${s.name.padEnd(16)} ${s.domain.padEnd(32)} ${session ? 'signed in' : 'not signed in'}${s.readOnly ? ', read-only' : ''}${s.label ? `  ${s.label}` : ''}`);
    }
    return;
  }

  if (command === 'remove') {
    const name = String(positional[1] || '').toLowerCase();
    const removed = await runtime.config.removeStore(name);
    console.log(removed
      ? `Removed "${name}" and its sign-in on this computer. To revoke the app's access to the store too, uninstall it in Shopify admin.`
      : `No store named "${name}" in ${runtime.config.file}.`);
    return;
  }

  if (command === 'doctor') return doctor(runtime);

  console.error(`Unknown command "${command}".\n\n${HELP}`);
  process.exitCode = 2;
}

async function doctor({ cli, devMcp, toolchain, config }) {
  let failed = 0;
  const check = async (label, fn) => {
    try {
      console.log(`ok   ${label}: ${await fn()}`);
    } catch (err) {
      failed++;
      console.log(`FAIL ${label}: ${err.message}`);
    }
  };
  await check('Shopify CLI', async () => {
    const { version } = await cli.binary();
    const s = toolchain.status(CLI_PACKAGE);
    return `${version} (newest on npm: ${s.latest || 'unknown'}; ${s.signatures || 'signatures not checked'})`;
  });
  await check('Shopify Dev MCP', async () => {
    const inst = await devMcp.current();
    const s = devMcp.status();
    return `${inst.version}, ${inst.tools.length} tools (newest on npm: ${s.latest || 'unknown'}; ${s.signatures || 'signatures not checked'})`;
  });
  await check('Built-in and report queries against the newest Admin schema', async () => {
    const { tools } = await devMcp.current();
    const validator = tools.find((t) => /^validate(_graphql\w*)?$/.test(t.name));
    if (!validator) throw new Error(`Dev MCP has no GraphQL validation tool (tools: ${tools.map((t) => t.name).join(', ')})`);
    const learned = await devMcp.callTool('learn_shopify_api', { api: 'admin' });
    const learnedText = learned.content?.map((c) => c.text || '').join('\n') || '';
    const conversationId = learned.structuredContent?.conversationId || learnedText.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i)?.[0];
    if (!conversationId) throw new Error(`learn_shopify_api returned no conversationId: ${learnedText.slice(0, 300)}`);
    // Dev MCP has used both `code` and `codeblocks` for the list of blocks.
    const listKey = validator.inputSchema?.properties?.code ? 'code' : 'codeblocks';
    const failures = [];
    const queries = { ...CURATED_QUERIES, ...Object.fromEntries(Object.entries(REPORT_QUERIES).map(([k, v]) => [`report:${k}`, v])) };
    for (const [name, content] of Object.entries(queries)) {
      const res = await devMcp.callTool(validator.name, { conversationId, api: 'admin', [listKey]: [{ content }] });
      const text = res.content?.map((c) => c.text || '').join('\n') || '';
      if (res.isError || /\b(fail(ed|ure)?|invalid|cannot query|not defined|unknown|deprecated)\b/i.test(text)) failures.push(`${name}: ${text.slice(0, 600)}`);
      else if (process.env.DEBUG) console.log(`     ${name}: ${text.slice(0, 300)}`);
    }
    if (failures.length) throw new Error(failures.join('\n'));
    return `${Object.keys(queries).length} queries valid (${validator.name})`;
  });
  await check('Store sessions', async () => {
    const sessions = await allSessions({ cli, config });
    const configured = Object.values(config.stores());
    const signed = new Set(sessions.map((s) => String(s.store).toLowerCase()));
    const missing = configured.filter((s) => !signed.has(s.domain)).map((s) => s.name);
    if (missing.length) throw new Error(`not signed in: ${missing.join(', ')} (run: shopify-multistore-mcp connect <name> <domain>)`);
    return `${configured.length} configured, ${sessions.length} signed in with Shopify CLI`;
  });
  await devMcp.close();
  if (failed) process.exitCode = 1;
}

// Signs a store in from the terminal: saves it, opens Shopify's approval page and waits.
async function connectFlow(args, runtime) {
  runtime ||= await createRuntime();
  const existing = runtime.config.stores()[String(args.store || '').toLowerCase()];
  const spec = connectArgs(args, existing);
  const store = await runtime.config.upsertStore(spec.name, { domain: spec.domain, label: spec.label, readOnly: spec.readOnly, scopes: spec.scopes, session: 'own' });
  console.log('Preparing Shopify CLI (the first run installs it, about 30 seconds)...');
  const { version } = await runtime.cli.binary();
  console.log(`Shopify CLI ${version}: opening your browser to approve access to ${spec.domain}${spec.readOnly ? ' (read-only)' : ''}.`);
  const handle = runtime.cli.startAuth(runtime.config.target(store), spec.scopes);
  const shown = setInterval(() => {
    if (handle.url) { console.log(`If no browser opened, visit: ${handle.url}`); clearInterval(shown); }
  }, 1000);
  try {
    const result = await handle.done;
    console.log(`Connected "${spec.name}" (${spec.domain}). Scopes: ${(result.scopes || spec.scopes).join(', ')}`);
  } finally {
    clearInterval(shown);
  }
}

// Sessions from every store's own folder plus the CLI's default one, read side by side.
async function allSessions({ cli, config }) {
  const homes = [...new Set(Object.values(config.stores()).map((s) => config.target(s).home))];
  if (!homes.includes('')) homes.push('');
  return (await Promise.all(homes.map((h) => cli.sessions(h)))).flat();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
