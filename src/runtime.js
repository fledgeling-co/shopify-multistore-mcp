import fs from 'node:fs';
import path from 'node:path';
import { Config, cacheDir, parseStoreSpec } from './config.js';
import { DevMcp } from './dev-mcp.js';
import { ShopifyCli } from './shopify-cli.js';
import { Toolchain } from './toolchain.js';

export const VERSION = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

export function log(message) {
  process.stderr.write(`[shopify-multi-mcp] ${message}\n`);
}

// Stores can come from the config file, repeated --store name=domain flags, or
// SHOPIFY_STORES="name=domain,name2=domain2"; --read-only name marks one read-only.
const VALUE_FLAGS = new Set(['store', 'read-only', 'label', 'scopes']);

export function parseArgs(argv, env = process.env) {
  const positional = [];
  const flags = { store: [], 'read-only': [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { positional.push(a); continue; }
    const eq = a.indexOf('=');
    const key = eq === -1 ? a.slice(2) : a.slice(2, eq);
    let value = eq === -1 ? true : a.slice(eq + 1);
    // `connect ... --read-only` is a switch; `serve --read-only acme` names a store.
    const wantsValue = VALUE_FLAGS.has(key) && !(key === 'read-only' && positional[0] === 'connect');
    if (value === true && wantsValue && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) value = argv[++i];
    if (Array.isArray(flags[key])) flags[key].push(value);
    else flags[key] = value;
  }
  const specs = [...flags.store.filter((s) => typeof s === 'string')];
  if (env.SHOPIFY_STORES) specs.push(...env.SHOPIFY_STORES.split(',').map((s) => s.trim()).filter(Boolean));
  return { positional, flags, stores: specs.map(parseStoreSpec), readOnly: flags['read-only'].filter((s) => typeof s === 'string') };
}

export async function createRuntime({ stores = [], readOnly = [] } = {}) {
  const config = await new Config({ cliStores: stores, cliReadOnly: readOnly }).load();
  const sessionPinned = process.env.SHOPIFY_MULTI_MCP_UPDATES === 'session';
  const toolchain = new Toolchain({
    dir: path.join(cacheDir(), 'packages'),
    pins: { ...config.pins(), ...envPins() },
    checkEveryMs: config.updateCheckMs(),
    sessionPinned,
    log,
  });
  const cli = new ShopifyCli({ toolchain, log });
  const devMcp = new DevMcp({ toolchain, log, clientInfo: { name: 'shopify-multi-mcp', version: VERSION } });
  return { config, toolchain, cli, devMcp };
}

function envPins() {
  const pins = {};
  if (process.env.SHOPIFY_CLI_VERSION) pins['@shopify/cli'] = process.env.SHOPIFY_CLI_VERSION;
  if (process.env.SHOPIFY_DEV_MCP_VERSION) pins['@shopify/dev-mcp'] = process.env.SHOPIFY_DEV_MCP_VERSION;
  return pins;
}
