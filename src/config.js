import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// Scopes requested when a store is connected without an explicit list. In Shopify a
// write_ scope includes its read_ counterpart, so read-only stores get the read_ forms.
export const DEFAULT_SCOPES = [
  'write_products',
  'write_inventory',
  'read_locations',
  'write_orders',
  'write_draft_orders',
  'write_fulfillments',
  'write_customers',
  'write_discounts',
  'write_content',
  'write_metaobjects',
  'write_files',
  'write_publications',
  'read_themes',
  'read_reports',
  'read_analytics',
];

export function readOnlyScopes(scopes) {
  return [...new Set(scopes.map((s) => s.replace(/^write_/, 'read_')))];
}

export function configDir(env = process.env) {
  if (env.SHOPIFY_MULTI_MCP_HOME) return env.SHOPIFY_MULTI_MCP_HOME;
  const base = env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(base, 'shopify-multi-mcp');
}

export function cacheDir(env = process.env) {
  if (env.SHOPIFY_MULTI_MCP_CACHE) return env.SHOPIFY_MULTI_MCP_CACHE;
  const base = env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
  return path.join(base, 'shopify-multi-mcp');
}

// "acme", "acme.myshopify.com", "https://acme.myshopify.com/admin" all become
// "acme.myshopify.com". Custom domains are rejected because the CLI needs the
// myshopify.com domain.
export function normalizeDomain(input) {
  let d = String(input || '').trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!d) throw new Error('A store domain is required, for example acme.myshopify.com.');
  if (!d.includes('.')) d = `${d}.myshopify.com`;
  if (!d.endsWith('.myshopify.com')) {
    throw new Error(`"${input}" is not a myshopify.com domain. Use the store's permanent domain, for example acme.myshopify.com (shown in Shopify admin under Settings > Domains).`);
  }
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(d)) throw new Error(`"${input}" is not a valid myshopify.com domain.`);
  return d;
}

export function normalizeName(input) {
  const n = String(input || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!n) throw new Error('A store name is required, for example "acme".');
  if (n === 'all') throw new Error('"all" is reserved. Pick another store name.');
  return n;
}

// `--store acme=acme.myshopify.com` or SHOPIFY_STORES="acme=acme.myshopify.com,beta=beta"
export function parseStoreSpec(spec) {
  const [rawName, rawDomain] = spec.includes('=') ? spec.split('=', 2) : [spec.split('.')[0], spec];
  return { name: normalizeName(rawName), domain: normalizeDomain(rawDomain) };
}

export class Config {
  constructor({ dir = configDir(), cliStores = [], cliReadOnly = [] } = {}) {
    this.file = path.join(dir, 'stores.json');
    this.cliStores = cliStores;
    this.cliReadOnly = new Set(cliReadOnly.map(normalizeName));
    this.data = { stores: {}, pins: {} };
  }

  async load() {
    try {
      const parsed = JSON.parse(await fs.readFile(this.file, 'utf8'));
      this.data = { stores: parsed.stores || {}, pins: parsed.pins || {}, updateCheckMinutes: parsed.updateCheckMinutes };
    } catch (err) {
      if (err.code !== 'ENOENT') throw new Error(`Could not read ${this.file}: ${err.message}`);
    }
    return this;
  }

  async save() {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, `${JSON.stringify(this.data, null, 2)}\n`);
    await fs.rename(tmp, this.file);
  }

  // Stores from the file, overlaid by stores passed on the command line or in env.
  stores() {
    const out = {};
    for (const [name, s] of Object.entries(this.data.stores)) out[name] = { name, ...s };
    for (const { name, domain } of this.cliStores) out[name] = { ...out[name], name, domain };
    for (const name of this.cliReadOnly) if (out[name]) out[name].readOnly = true;
    return out;
  }

  pins() {
    return { ...this.data.pins };
  }

  updateCheckMs() {
    const minutes = Number(process.env.SHOPIFY_MULTI_MCP_UPDATE_MINUTES ?? this.data.updateCheckMinutes ?? 15);
    return Math.max(0, minutes) * 60_000;
  }

  async upsertStore(name, fields) {
    const current = this.data.stores[name] || {};
    const next = { ...current };
    for (const [k, v] of Object.entries(fields)) if (v !== undefined) next[k] = v;
    this.data.stores[name] = next;
    await this.save();
    return { name, ...next };
  }

  async removeStore(name) {
    const existed = Boolean(this.data.stores[name]);
    delete this.data.stores[name];
    await this.save();
    return existed;
  }
}
