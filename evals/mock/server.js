// A local stand-in for the Shopify Admin GraphQL API, shared by both servers under test.
// It validates and executes each request against Shopify's own published schema for the requested
// API version (the files Shopify's Dev MCP bundles), answers from fixtures.js, and implements the
// search syntax and connections the Admin API uses. A field the fixtures do not hold is answered
// with an empty value of the right type and counted, so gaps show up in the results.

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import zlib from 'node:zlib';
import { buildClientSchema, execute, getNamedType, getNullableType, isEnumType, isListType, isNonNullType, isObjectType, isScalarType, parse, validate } from 'graphql';
import { matches } from './search.js';

const schemas = new Map();

export function schemaDir() {
  const base = process.env.SCHEMA_DIR;
  if (base) return base;
  const cache = path.join(process.env.HOME, '.cache');
  for (const app of ['shopify-multistore-mcp', 'shopherd', 'storerow']) {
    const root = path.join(cache, app, 'packages', '@shopify__dev-mcp');
    if (!fs.existsSync(root)) continue;
    for (const v of fs.readdirSync(root).sort().reverse()) {
      const dir = path.join(root, v, 'node_modules', '@shopify', 'dev-mcp', 'dist', 'data');
      if (fs.existsSync(dir)) return dir;
    }
  }
  throw new Error('Admin schema not found. Run `npx shopify-multistore-mcp doctor` once (it downloads Shopify Dev MCP), or set SCHEMA_DIR.');
}

function schemaFor(version) {
  if (!schemas.has(version)) {
    const file = path.join(schemaDir(), `admin_${version}.json.gz`);
    if (!fs.existsSync(file)) throw new Error(`No Admin schema for ${version}`);
    const json = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8'));
    schemas.set(version, buildClientSchema(json.data));
  }
  return schemas.get(version);
}

// Which list a connection or count field reads, by field name.
const LISTS = {
  products: (s) => s.products, productVariants: (s) => s.variants, orders: (s) => s.orders, draftOrders: () => [],
  customers: (s) => s.customers, locations: (s) => s.locations, collections: (s) => s.collections, inventoryItems: (s) => s.variants.map((v) => v.inventoryItem),
  variants: (p) => p.variants, lineItems: (o) => o.lineItems, inventoryLevels: (i) => i.inventoryLevels, media: (p) => p.media, images: (p) => p.images,
  fulfillmentOrders: () => [], fulfillments: () => [], metafields: () => [], events: () => [], refunds: () => [], transactions: () => [], webhookSubscriptions: () => [],
};
const KIND = { products: 'product', productVariants: 'variant', variants: 'variant', orders: 'order', customers: 'customer', locations: 'location' };

const SORTS = {
  TITLE: (n) => n.title || n.product?.title || '', ID: (n) => Number(String(n.id).split('/').pop()), UPDATED_AT: (n) => n.updatedAt, CREATED_AT: (n) => n.createdAt,
  PROCESSED_AT: (n) => n.processedAt, INVENTORY_TOTAL: (n) => n.totalInventory, INVENTORY_QUANTITY: (n) => n.inventoryQuantity, SKU: (n) => n.sku || '',
  TOTAL_PRICE: (n) => Number(n.currentTotalPriceSet?.shopMoney.amount), ORDER_NUMBER: (n) => Number(String(n.name).replace(/\D/g, '')), NAME: (n) => n.name || '', POSITION: (n) => n.position,
};

const cursor = (i) => Buffer.from(`i:${i}`).toString('base64');
const fromCursor = (c) => Number(Buffer.from(String(c), 'base64').toString().slice(2));

function connection(all, args, kind) {
  let list = args.query && kind ? all.filter((n) => matches(n, args.query, kind)) : [...all];
  const sortKey = args.sortKey && SORTS[args.sortKey] ? args.sortKey : null;
  if (sortKey) list.sort((a, b) => { const x = SORTS[sortKey](a); const y = SORTS[sortKey](b); return x < y ? -1 : x > y ? 1 : 0; });
  if (args.reverse) list.reverse();
  let start = args.after ? fromCursor(args.after) + 1 : 0;
  let end = args.before ? fromCursor(args.before) : list.length;
  if (args.first != null) end = Math.min(end, start + args.first);
  if (args.last != null) start = Math.max(start, end - args.last);
  const page = list.slice(start, end).map((node, i) => ({ node, cursor: cursor(start + i) }));
  return {
    edges: page, nodes: page.map((e) => e.node),
    pageInfo: { hasNextPage: end < list.length, hasPreviousPage: start > 0, startCursor: page[0]?.cursor ?? null, endCursor: page.at(-1)?.cursor ?? null },
  };
}

function emptyOf(type, ctx, coord) {
  ctx.defaulted.add(coord);
  const t = getNullableType(type);
  if (isListType(t)) return [];
  if (isEnumType(t)) return t.getValues()[0].value;
  if (isScalarType(t)) {
    return { String: '', Int: 0, Float: 0, Boolean: false, ID: 'gid://shopify/Unknown/0', Decimal: '0.0', Money: '0.0', DateTime: new Date(0).toISOString(), Date: '1970-01-01', URL: 'https://example.com', HTML: '', FormattedString: '', UnsignedInt64: '0', JSON: {} }[t.name] ?? '';
  }
  return {};
}

function resolver(store) {
  return (source, args, ctx, info) => {
    const name = info.fieldName;
    const type = info.returnType;
    const named = getNamedType(type);
    const coord = `${info.parentType.name}.${name}`;
    const root = info.parentType.name === 'QueryRoot';
    if (root && name === 'shop') return store.shop;
    if (named.name.endsWith('Connection') && LISTS[name]) return connection(LISTS[name](root ? store : source) || [], args, KIND[name]);
    if (named.name === 'Count' && LISTS[name.replace(/Count$/, '')]) {
      const list = LISTS[name.replace(/Count$/, '')](root ? store : source) || [];
      const n = args.query ? list.filter((x) => matches(x, args.query, KIND[name.replace(/Count$/, '')])).length : list.length;
      return { count: args.limit != null ? Math.min(n, args.limit) : n, precision: args.limit != null && n > args.limit ? 'AT_LEAST' : 'EXACT' };
    }
    if (root && ['product', 'order', 'productVariant', 'customer', 'location', 'node', 'inventoryItem'].includes(name) && args.id) {
      return [...store.products, ...store.variants, ...store.orders, ...store.customers, ...store.locations, ...store.variants.map((v) => v.inventoryItem)].find((n) => n.id === args.id) ?? null;
    }
    if (root && name === 'nodes' && args.ids) return args.ids.map((id) => [...store.products, ...store.variants, ...store.orders].find((n) => n.id === id) ?? null);
    if (root && (name === 'productByHandle' || name === 'productByIdentifier')) {
      const h = args.handle ?? args.identifier?.handle; const id = args.identifier?.id;
      return store.products.find((p) => (h && p.handle === h) || (id && p.id === id)) ?? null;
    }
    if (name === '__typename') return info.parentType.name;
    if (name === 'inventoryLevel' && source?.inventoryLevels) return source.inventoryLevels[0] ?? null;
    if (name === 'quantities' && Array.isArray(source?.quantities)) return args.names ? source.quantities.filter((q) => args.names.includes(q.name)) : source.quantities;
    if (name === 'description' && typeof source?.description === 'string' && args.truncateAt) return source.description.slice(0, args.truncateAt);
    const value = source?.[name];
    if (value !== undefined && value !== null) {
      if (isObjectType(named) && Array.isArray(value) && !isListType(getNullableType(type))) return value[0] ?? null;
      return value;
    }
    if (value === null && !isNonNullType(type)) return null;
    return isNonNullType(type) ? emptyOf(type, ctx, coord) : (ctx.defaulted.add(coord), null);
  };
}

export async function startMock({ fixtures, port = 0, host = '127.0.0.1' }) {
  const byToken = new Map(Object.values(fixtures.stores).map((s) => [s.token, s]));
  const stats = { requests: 0, errors: 0, defaulted: new Set(), byStore: {} };
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', async () => {
      const send = (code, payload) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(payload)); };
      const m = req.url.match(/^\/admin\/api\/([^/]+)\/graphql\.json/);
      if (req.method !== 'POST' || !m) return send(404, { errors: 'Not Found' });
      const store = byToken.get(req.headers['x-shopify-access-token']);
      if (!store) return send(401, { errors: '[API] Invalid API key or access token (unrecognized login or wrong password)' });
      stats.requests++;
      stats.byStore[store.name] = (stats.byStore[store.name] || 0) + 1;
      let schema;
      try {
        schema = schemaFor(m[1]);
      } catch (err) {
        return send(404, { errors: err.message });
      }
      let doc;
      try {
        const { query, variables } = JSON.parse(body || '{}');
        doc = parse(query);
        const problems = validate(schema, doc);
        if (problems.length) { stats.errors++; return send(200, { errors: problems.map((e) => ({ message: e.message, locations: e.locations })) }); }
        const ctx = { defaulted: stats.defaulted };
        const result = await execute({ schema, document: doc, variableValues: variables, contextValue: ctx, fieldResolver: resolver(store), rootValue: {} });
        if (result.errors?.length) stats.errors++;
        send(200, {
          ...(result.data !== undefined ? { data: result.data } : {}),
          ...(result.errors ? { errors: result.errors.map((e) => ({ message: e.message, path: e.path })) } : {}),
          extensions: { cost: { requestedQueryCost: 10, actualQueryCost: 10, throttleStatus: { maximumAvailable: 2000, currentlyAvailable: 1990, restoreRate: 100 } } },
        });
      } catch (err) {
        stats.errors++;
        send(200, { errors: [{ message: err.message }] });
      }
    });
  });
  await new Promise((r) => server.listen(port, host, r));
  const actual = server.address().port;
  return { url: `http://${host}:${actual}`, port: actual, stats, close: () => new Promise((r) => server.close(r)) };
}
