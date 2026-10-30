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
    sessions: async () => signedIn.map((store) => ({ store, scopes: ['write_products'], associatedUser: { email: 'owner@example.com' } })),
    execute: async (domain, req) => {
      calls.push({ domain, ...req });
      if (domain === 'acme-us.myshopify.com') throw new CliError('No stored app authentication found for acme-us.myshopify.com. Run shopify store auth.', { notAuthenticated: true });
      return { result: { data: { shop: { name: domain.split('.')[0] } } }, cliVersion: '5.0.0' };
    },
    startAuth: (domain, scopes) => ({ domain, url: null, done: Promise.resolve({ store: domain, scopes }) }),
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
