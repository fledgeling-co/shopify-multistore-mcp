import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { Config, configDir, DEFAULT_SCOPES, normalizeDomain, parseStoreSpec, readOnlyScopes, setting } from '../src/config.js';
import { CliError, parseJson, Queue, ShopifyCli } from '../src/shopify-cli.js';
import { assertNotMutation, buildTools, connectArgs, resolveStore } from '../src/tools.js';
import { parseArgs } from '../src/runtime.js';

const stores = {
  au: { name: 'au', domain: 'acme-au.myshopify.com', label: 'AU retail' },
  nz: { name: 'nz', domain: 'acme-nz.myshopify.com', readOnly: true },
};

test('normalizeDomain accepts names, domains and admin URLs', () => {
  assert.equal(normalizeDomain('acme'), 'acme.myshopify.com');
  assert.equal(normalizeDomain('Acme.myshopify.com'), 'acme.myshopify.com');
  assert.equal(normalizeDomain('https://acme.myshopify.com/admin/products'), 'acme.myshopify.com');
  assert.throws(() => normalizeDomain('shop.acme.com'), /not a myshopify\.com domain/);
  assert.throws(() => normalizeDomain(''), /required/);
});

test('parseStoreSpec and parseArgs read stores from flags and env', () => {
  assert.deepEqual(parseStoreSpec('au=acme-au'), { name: 'au', domain: 'acme-au.myshopify.com' });
  assert.deepEqual(parseStoreSpec('acme-nz.myshopify.com'), { name: 'acme-nz', domain: 'acme-nz.myshopify.com' });
  const parsed = parseArgs(['--store', 'au=acme-au', '--store=nz=acme-nz', '--read-only', 'nz'], { SHOPIFY_STORES: 'us=acme-us' });
  assert.deepEqual(parsed.stores.map((s) => s.name), ['au', 'nz', 'us']);
  assert.deepEqual(parsed.readOnly, ['nz']);
  const connect = parseArgs(['connect', 'au', 'acme-au', '--read-only', '--label', 'AU retail']);
  assert.deepEqual(connect.positional, ['connect', 'au', 'acme-au']);
  assert.equal(connect.flags.label, 'AU retail');
  assert.deepEqual(connect.flags['read-only'], [true]);
});

test('settings and the config folder still honour the pre-0.2.0 name', async () => {
  assert.equal(setting('UPDATES', { STOREROW_UPDATES: 'session', SHOPIFY_MULTI_MCP_UPDATES: 'off' }), 'session');
  assert.equal(setting('UPDATES', { SHOPIFY_MULTI_MCP_UPDATES: 'session' }), 'session');
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'storerow-cfg-'));
  assert.equal(configDir({ XDG_CONFIG_HOME: base }), path.join(base, 'storerow'));
  await fs.mkdir(path.join(base, 'shopify-multi-mcp'));
  assert.equal(configDir({ XDG_CONFIG_HOME: base }), path.join(base, 'shopify-multi-mcp'));
  await fs.mkdir(path.join(base, 'storerow'));
  assert.equal(configDir({ XDG_CONFIG_HOME: base }), path.join(base, 'storerow'));
  await fs.rm(base, { recursive: true });
});

test('readOnlyScopes turns write scopes into read scopes', () => {
  assert.deepEqual(readOnlyScopes(['write_products', 'read_products', 'read_reports']), ['read_products', 'read_reports']);
});

test('Config overlays command-line stores on the saved file', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-'));
  const saved = await new Config({ dir }).load();
  await saved.upsertStore('au', { domain: 'acme-au.myshopify.com', label: 'AU retail' });
  const cfg = await new Config({ dir, cliStores: [{ name: 'nz', domain: 'acme-nz.myshopify.com' }], cliReadOnly: ['au'] }).load();
  assert.deepEqual(Object.keys(cfg.stores()).sort(), ['au', 'nz']);
  assert.equal(cfg.stores().au.readOnly, true);
  assert.equal(cfg.stores().au.label, 'AU retail');
  assert.equal(await cfg.removeStore('au'), true);
  assert.deepEqual(Object.keys((await new Config({ dir }).load()).stores()), []);
});

test('resolveStore matches name, domain or subdomain and explains failures', () => {
  assert.equal(resolveStore(stores, 'au').name, 'au');
  assert.equal(resolveStore(stores, 'ACME-NZ.myshopify.com').name, 'nz');
  assert.equal(resolveStore(stores, 'acme-nz').name, 'nz');
  assert.throws(() => resolveStore(stores, undefined), /Pass "store".*au \(acme-au\.myshopify\.com\)/);
  assert.throws(() => resolveStore(stores, 'us'), /Unknown store "us"/);
  assert.equal(resolveStore({ au: stores.au }, undefined).name, 'au');
  assert.throws(() => resolveStore({}, 'au'), /connect_store/);
});

test('buildTools injects a store enum and only requires it with several stores', () => {
  const many = Object.fromEntries(buildTools(stores).map((t) => [t.name, t]));
  assert.deepEqual(many.graphql_query.inputSchema.properties.store.enum, ['au', 'nz']);
  assert.deepEqual(many.graphql_query.inputSchema.required, ['store', 'query']);
  assert.match(many.graphql_query.inputSchema.properties.store.description, /"nz" \(acme-nz\.myshopify\.com, read-only\)/);
  const one = Object.fromEntries(buildTools({ au: stores.au }).map((t) => [t.name, t]));
  assert.deepEqual(one.graphql_query.inputSchema.required, ['query']);
  const none = Object.fromEntries(buildTools({}).map((t) => [t.name, t]));
  assert.equal(none.get_shop.inputSchema.properties.store.enum, undefined);
  for (const t of buildTools(stores)) assert.match(t.name, /^[a-zA-Z0-9_-]{1,64}$/);
});

test('assertNotMutation spots mutations but not the word inside strings or comments', () => {
  assert.throws(() => assertNotMutation('mutation { productDelete(input: {id: "1"}) { deletedProductId } }'), /graphql_mutation/);
  assert.throws(() => assertNotMutation('  mutation Rename($id: ID!) { x }'), /graphql_mutation/);
  assertNotMutation('query { products(first: 1, query: "title:mutation") { nodes { id } } }');
  assertNotMutation('# mutation later\nquery { shop { name } }');
});

test('connectArgs fills defaults, keeps existing settings and narrows read-only scopes', () => {
  const fresh = connectArgs({ store: 'AU Retail', domain: 'acme-au' });
  assert.equal(fresh.name, 'au-retail');
  assert.deepEqual(fresh.scopes, DEFAULT_SCOPES);
  const ro = connectArgs({ store: 'nz', read_only: true }, stores.nz);
  assert.equal(ro.domain, 'acme-nz.myshopify.com');
  assert.ok(ro.scopes.every((s) => s.startsWith('read_')));
  assert.throws(() => connectArgs({ store: 'us' }), /"domain" is required/);
  assert.throws(() => connectArgs({ store: 'all', domain: 'x' }), /reserved/);
});

test('parseJson finds the trailing JSON result after progress output', () => {
  assert.deepEqual(parseJson('{"a":1}'), { a: 1 });
  assert.deepEqual(parseJson('Refreshing token...\n\u001b[32m✓\u001b[0m done\n{\n  "data": {\n    "shop": { "name": "Acme" }\n  }\n}\n'), { data: { shop: { name: 'Acme' } } });
  assert.equal(parseJson('no json here'), undefined);
});

test('Queue runs jobs one at a time, in order, and survives failures', async () => {
  const q = new Queue();
  const order = [];
  let running = 0;
  const job = (id, fail) => async () => {
    running++;
    assert.equal(running, 1);
    await new Promise((r) => setTimeout(r, 5));
    order.push(id);
    running--;
    if (fail) throw new Error('boom');
    return id;
  };
  const results = await Promise.allSettled([q.add(job(1)), q.add(job(2, true)), q.add(job(3))]);
  assert.deepEqual(order, [1, 2, 3]);
  assert.equal(results[1].status, 'rejected');
  assert.equal(results[2].value, 3);
});

test('ShopifyCli passes flags through and classifies sign-in errors', async () => {
  const calls = [];
  const toolchain = { setSmokeTest() {}, ensure: async () => ({ version: '5.0.0', entry: '/cli/run.js' }) };
  const runImpl = async (cmd, args) => {
    calls.push(args);
    // Verbatim from Shopify CLI 5.0.0 for a store with no session.
    if (args.includes('broken.myshopify.com')) return { code: 1, stdout: '', stderr: 'No stored app authentication found for broken.myshopify.com.' };
    return { code: 0, stdout: 'warming up\n{"data":{"shop":{"name":"Acme"}}}', stderr: '' };
  };
  const cli = new ShopifyCli({ toolchain, runImpl });
  const { result, cliVersion } = await cli.execute('acme.myshopify.com', { query: 'mutation { x }', variables: { id: 1 }, apiVersion: '2026-10', allowMutations: true });
  assert.equal(cliVersion, '5.0.0');
  assert.deepEqual(result, { data: { shop: { name: 'Acme' } } });
  assert.deepEqual(calls[0], ['/cli/run.js', 'store', 'execute', '--store', 'acme.myshopify.com', '--query', 'mutation { x }', '--variables', '{"id":1}', '--version', '2026-10', '--allow-mutations', '--json', '--no-input']);
  await assert.rejects(cli.execute('broken.myshopify.com', { query: '{ shop { name } }' }), (err) => err instanceof CliError && err.notAuthenticated);
});
