import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Config } from '../src/config.js';
import { CliError } from '../src/shopify-cli.js';
import { MultiStoreServer } from '../src/server.js';

function fakeToolchain() {
  return { status: () => ({ version: '5.0.0', latest: '5.0.0' }), setSmokeTest() {} };
}

function fakeCli({ signedIn = ['acme-au.myshopify.com', 'acme-nz.myshopify.com', 'other.myshopify.com'] } = {}) {
  const calls = [];
  return {
    calls,
    binary: async () => ({ version: '5.0.0' }),
    sessions: async (home) => (home ? [] : signedIn.map((store) => ({ store, scopes: ['write_products'], associatedUser: { email: 'owner@example.com' } }))),
    execute: async (target, req) => {
      const domain = target.domain;
      calls.push({ domain, home: target.home, ...req });
      if (domain === 'acme-us.myshopify.com') throw new CliError('No stored app authentication found for acme-us.myshopify.com. Run shopify store auth.', { notAuthenticated: true });
      return { result: { data: { shop: { name: domain.split('.')[0] } } }, cliVersion: '5.0.0' };
    },
    auths: [],
    startAuth(target, scopes) { this.auths.push(target); return { domain: target.domain, url: null, done: Promise.resolve({ store: target.domain, scopes }) }; },
  };
}

function fakeDevMcp() {
  const tools = [
    { name: 'learn_shopify_api', description: 'docs', inputSchema: { type: 'object', properties: { api: { type: 'string' } } } },
    { name: 'graphql_query', description: 'clashes with ours', inputSchema: { type: 'object', properties: {} } },
  ];
  const calls = [];
  return {
    calls,
    active: { version: '1.18.0', tools },
    current: async () => ({ version: '1.18.0', tools }),
    listTools: async () => tools,
    callTool: async (name, args) => { calls.push([name, args]); return { content: [{ type: 'text', text: `dev:${name}` }] }; },
    status: () => ({ version: '1.18.0', running: '1.18.0' }),
  };
}

async function setup({ stores = { au: 'acme-au', nz: 'acme-nz' }, readOnly = ['nz'] } = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'smm-srv-'));
  const config = await new Config({
    dir,
    cliStores: Object.entries(stores).map(([name, d]) => ({ name, domain: `${d}.myshopify.com` })),
    cliReadOnly: readOnly,
  }).load();
  const cli = fakeCli();
  const devMcp = fakeDevMcp();
  const app = new MultiStoreServer({ config, toolchain: fakeToolchain(), cli, devMcp, version: 'test' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0' });
  await Promise.all([app.server.connect(a), client.connect(b)]);
  const call = async (name, args = {}) => {
    const res = await client.callTool({ name, arguments: args });
    return { ...res, text: res.content.map((c) => c.text).join('\n') };
  };
  return { app, client, cli, devMcp, config, call };
}

test('instructions name each store and explain the store argument', async () => {
  const { client } = await setup();
  const text = client.getInstructions();
  assert.match(text, /- au: acme-au\.myshopify\.com/);
  assert.match(text, /- nz: acme-nz\.myshopify\.com \[read-only\]/);
  assert.match(text, /exists in one store only/);
});

test('tools/list merges store tools with Dev MCP tools and renames clashes', async () => {
  const { client } = await setup();
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name);
  for (const n of ['list_stores', 'connect_store', 'get_shop', 'search_products', 'list_orders', 'graphql_query', 'graphql_mutation', 'graphql_query_all_stores', 'learn_shopify_api', 'dev_graphql_query']) {
    assert.ok(names.includes(n), `missing ${n}`);
  }
  const q = tools.find((t) => t.name === 'graphql_query');
  assert.deepEqual(q.inputSchema.properties.store.enum, ['au', 'nz']);
});

test('store tools run on the named store and label the result', async () => {
  const { call, cli } = await setup();
  const res = await call('get_shop', { store: 'nz' });
  assert.equal(res.isError, undefined);
  assert.match(res.text, /^store: nz \(acme-nz\.myshopify\.com\)/);
  assert.equal(res.structuredContent.store, 'nz');
  assert.equal(cli.calls[0].domain, 'acme-nz.myshopify.com');
  await call('search_products', { store: 'au', query: 'tag:sale', first: 5 });
  assert.deepEqual(cli.calls[1].variables, { query: 'tag:sale', first: 5 });
});

test('a missing store argument lists the choices instead of guessing', async () => {
  const { call, cli } = await setup();
  const res = await call('get_shop', {});
  assert.equal(res.isError, true);
  assert.match(res.text, /Pass "store".*au \(acme-au\.myshopify\.com\), nz \(acme-nz\.myshopify\.com\)/);
  assert.equal(cli.calls.length, 0);
});

test('queries refuse mutations, read-only stores refuse graphql_mutation', async () => {
  const { call, cli } = await setup();
  const q = await call('graphql_query', { store: 'au', query: 'mutation { productDelete(input: {id: "1"}) { deletedProductId } }' });
  assert.match(q.text, /Use graphql_mutation/);
  const ro = await call('graphql_mutation', { store: 'nz', query: 'mutation { x }' });
  assert.match(ro.text, /read-only, so mutations are refused/);
  const ok = await call('graphql_mutation', { store: 'au', query: 'mutation { x }' });
  assert.equal(ok.isError, undefined);
  assert.equal(cli.calls.at(-1).allowMutations, true);
  assert.equal(cli.calls.length, 1);
});

test('graphql_query_all_stores labels each store and keeps going past failures', async () => {
  const { call } = await setup({ stores: { au: 'acme-au', us: 'acme-us' }, readOnly: [] });
  const res = await call('graphql_query_all_stores', { query: '{ shop { name } }' });
  assert.equal(res.structuredContent.results.length, 2);
  assert.equal(res.structuredContent.results[0].data.shop.name, 'acme-au');
  assert.match(res.structuredContent.results[1].error, /not signed in.*connect_store with store "us"/);
});

test('an expired session tells the model exactly how to recover', async () => {
  const { call } = await setup({ stores: { us: 'acme-us' }, readOnly: [] });
  const res = await call('list_orders', {});
  assert.equal(res.isError, true);
  assert.match(res.text, /Store "us" \(acme-us\.myshopify\.com\) is not signed in.*Call connect_store with store "us"/);
});

test('list_stores reports sign-in state and CLI sessions not yet added', async () => {
  const { call } = await setup();
  const res = await call('list_stores');
  const au = res.structuredContent.stores.find((s) => s.store === 'au');
  assert.equal(au.signedIn, true);
  assert.equal(au.user, 'owner@example.com');
  assert.deepEqual(res.structuredContent.signedInButNotAdded, ['other.myshopify.com']);
  assert.match(res.text, /nz: acme-nz\.myshopify\.com - signed in, read-only/);
});

test('connect_store saves the store and refreshes the tool list', async () => {
  const { call, client, config } = await setup();
  const res = await call('connect_store', { store: 'US Wholesale', domain: 'acme-us', label: 'Wholesale' });
  assert.match(res.text, /Connected "us-wholesale" \(acme-us\.myshopify\.com\)/);
  assert.equal((await new Config({ dir: path.dirname(config.file) }).load()).stores()['us-wholesale'].label, 'Wholesale');
  const { tools } = await client.listTools();
  assert.ok(tools.find((t) => t.name === 'get_shop').inputSchema.properties.store.enum.includes('us-wholesale'));
  const clash = await call('connect_store', { store: 'dup', domain: 'acme-au' });
  assert.match(clash.text, /already connected as "au"/);
});

test('Dev MCP tools pass through under their own names', async () => {
  const { call, client, devMcp } = await setup();
  await client.listTools();
  const res = await call('learn_shopify_api', { api: 'admin' });
  assert.equal(res.text, 'dev:learn_shopify_api');
  await call('dev_graphql_query', {});
  assert.deepEqual(devMcp.calls.map((c) => c[0]), ['learn_shopify_api', 'graphql_query']);
});

test('store_report asks every store at once and combines the answers', async () => {
  const { call, cli } = await setup({ readOnly: [] });
  cli.execute = async (target, req) => {
    cli.calls.push({ domain: target.domain, ...req });
    const currency = target.domain.includes('-au') ? 'AUD' : 'NZD';
    return { result: { data: { orders: { nodes: [{ currentTotalPriceSet: { shopMoney: { amount: '10.00', currencyCode: currency } } }], pageInfo: { hasNextPage: false } } } } };
  };
  const res = await call('store_report', { report: 'sales', days: 1 });
  assert.equal(res.isError, undefined);
  assert.match(res.text, /^Sales by store: 2 of 2 stores answered\./);
  assert.match(res.text, /All stores: 2 orders, 10\.00 AUD \+ 10\.00 NZD/);
  assert.deepEqual(cli.calls.map((c) => c.domain).sort(), ['acme-au.myshopify.com', 'acme-nz.myshopify.com']);
  const bad = await call('store_report', { report: 'nope' });
  assert.equal(bad.isError, true);
});

test('prompts are listed and filled in', async () => {
  const { client } = await setup();
  const { prompts } = await client.listPrompts();
  assert.ok(['morning-check', 'sales', 'unfulfilled-orders', 'low-stock', 'compare-product', 'catalogue-check', 'connect-store'].every((n) => prompts.some((p) => p.name === n)));
  const got = await client.getPrompt({ name: 'compare-product', arguments: { product: 'CAP-1' } });
  assert.match(got.messages[0].content.text, /Compare "CAP-1" across every store with store_report/);
  const connect = await client.getPrompt({ name: 'connect-store', arguments: { domain: 'acme-uk.myshopify.com', read_only: 'yes' } });
  assert.match(connect.messages[0].content.text, /Connect acme-uk\.myshopify\.com as "acme-uk", read-only/);
});

test('mutations that mint credentials or charge the store are blocked', async () => {
  const { call, cli } = await setup({ readOnly: [] });
  const res = await call('graphql_mutation', { store: 'au', query: 'mutation { appSubscriptionCreate(name: "x", lineItems: []) { userErrors { message } } }' });
  assert.match(res.text, /appSubscriptionCreate is blocked/);
  assert.equal(cli.calls.length, 0);
});

test('very large results are cut and say so', async () => {
  const { call, cli } = await setup();
  cli.execute = async () => ({ result: { data: { blob: 'x'.repeat(80_000) } } });
  const res = await call('get_shop', { store: 'au' });
  assert.match(res.text, /\[Cut at 60,000 of [\d,]+ characters\./);
  assert.equal(res.structuredContent, undefined);
});

test('connect_store gives each new store its own sign-in folder', async () => {
  const { call, cli, config } = await setup();
  await call('connect_store', { store: 'uk', domain: 'acme-uk' });
  assert.equal(cli.auths[0].domain, 'acme-uk.myshopify.com');
  assert.equal(cli.auths[0].home, path.join(path.dirname(config.file), 'sessions', 'uk'));
  const saved = await new Config({ dir: path.dirname(config.file) }).load();
  assert.equal(saved.stores().uk.session, 'own');
  assert.equal(saved.target(saved.stores().au ?? { name: 'au', domain: 'acme-au.myshopify.com' }).home, '');
});

test('Dev MCP tools from the last run are served at once, and an unchanged list is not re-announced', async () => {
  const { app, client } = await setup();
  const tools = await app.devMcp.listTools();
  const live = app.devMcp.active;
  app.devMcp.active = null;
  app.devMcp.remembered = { version: '1.18.0', tools };
  let started;
  app.devMcp.current = () => new Promise((r) => { started = () => { app.devMcp.active = live; r(live); }; });
  let changed = 0;
  client.setNotificationHandler((await import('@modelcontextprotocol/sdk/types.js')).ToolListChangedNotificationSchema, () => { changed++; });
  const names = (await client.listTools()).tools.map((t) => t.name);
  assert.ok(names.includes('learn_shopify_api'), 'remembered Dev MCP tools are listed before Dev MCP runs');
  started();
  await new Promise((r) => setTimeout(r, 20));
  app.devReady();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(changed, 0);
  app.devMcp.active = { ...live, tools: [...tools, { name: 'new_tool', description: 'x', inputSchema: { type: 'object' } }] };
  app.devReady();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(changed, 1);
});
