import assert from 'node:assert/strict';
import { test } from 'node:test';
import { REPORTS, paginate, period, runReport } from '../src/reports.js';

const NOW = Date.parse('2026-10-31T12:00:00Z');
const stores = [{ name: 'au', domain: 'acme-au.myshopify.com' }, { name: 'nz', domain: 'acme-nz.myshopify.com' }];

// Answers by store and query name, the way the Admin API would.
function fakeStores(answers) {
  const calls = [];
  const gqlFor = (store) => async (query, variables) => {
    const name = query.match(/query (\w+)/)[1];
    calls.push({ store, name, variables });
    const a = answers[store]?.[name];
    if (a instanceof Error) throw a;
    return typeof a === 'function' ? a(variables) : a;
  };
  return { calls, gqlFor };
}

const price = (amount, currencyCode) => ({ shopMoney: { amount: String(amount), currencyCode } });

test('period reads days, since and until, and rejects bad input', () => {
  assert.deepEqual(period({}, NOW), { since: '2026-10-24', until: null, label: 'since 2026-10-24' });
  assert.equal(period({ days: 1 }, NOW).since, '2026-10-30');
  assert.equal(period({ since: '2026-10-01', until: '2026-11-01' }, NOW).label, '2026-10-01 to 2026-11-01');
  assert.throws(() => period({ since: 'last week' }), /must be a date/);
  assert.throws(() => period({ days: 900 }), /between 0 and 366/);
});

test('paginate follows cursors and stops at the page cap', async () => {
  const pages = [{ nodes: [1, 2], pageInfo: { hasNextPage: true, endCursor: 'a' } }, { nodes: [3], pageInfo: { hasNextPage: true, endCursor: 'b' } }];
  const seen = [];
  const gql = async (q, v) => { seen.push(v.after); return { c: pages[seen.length - 1] }; };
  const out = await paginate(gql, 'q', {}, (d) => d.c, 2);
  assert.deepEqual(out, { nodes: [1, 2, 3], complete: false });
  assert.deepEqual(seen, [undefined, 'a']);
});

test('sales keeps currencies apart and leaves out test and cancelled orders', async () => {
  const { gqlFor, calls } = fakeStores({
    au: { Sales: { orders: { nodes: [
      { currentTotalPriceSet: price(100, 'AUD') }, { currentTotalPriceSet: price(50.5, 'AUD') },
      { test: true, currentTotalPriceSet: price(999, 'AUD') }, { cancelledAt: '2026-10-30', currentTotalPriceSet: price(70, 'AUD') },
    ], pageInfo: { hasNextPage: false } } } },
    nz: { Sales: { orders: { nodes: [{ currentTotalPriceSet: price(20, 'NZD') }], pageInfo: { hasNextPage: false } } } },
  });
  const { text, structured } = await runReport('sales', stores, { days: 7 }, gqlFor);
  const au = structured.stores.find((s) => s.store === 'au').data;
  assert.deepEqual(au.totals, { AUD: 150.5 });
  assert.equal(au.orders, 2);
  assert.equal(au.cancelled, 1);
  assert.deepEqual(au.average, { AUD: 75.25 });
  assert.deepEqual(structured.summary.totals, { AUD: 150.5, NZD: 20 });
  assert.match(text, /All stores: 3 orders, 150\.50 AUD \+ 20\.00 NZD\. Currencies are not converted\./);
  assert.match(calls[0].variables.query, /^processed_at:>=\d{4}-\d{2}-\d{2}$/);
});

test('a store that fails is named and the others still answer', async () => {
  const { gqlFor } = fakeStores({
    au: { Overview: { shop: { name: 'Acme AU', currencyCode: 'AUD' }, activeProducts: { count: 12, precision: 'EXACT' }, draftProducts: { count: 1 }, recentOrders: { count: 10000, precision: 'AT_LEAST' }, openUnfulfilled: { count: 3 }, locationsCount: { count: 2 } } },
    nz: { Overview: new Error('Store "nz" (acme-nz.myshopify.com) is not signed in') },
  });
  const { text } = await runReport('overview', stores, {}, gqlFor);
  assert.match(text, /1 of 2 stores answered/);
  assert.match(text, /\| au \| Acme AU \| AUD \| 12 \| 1 \| 10000\+ \| 3 \| 2 \|/);
  assert.match(text, /store: nz \(acme-nz\.myshopify\.com\) did not answer: Store "nz"/);
});

test('unfulfilled orders are bucketed by age', async () => {
  const at = (h) => new Date(Date.now() - h * 3_600_000).toISOString();
  const { gqlFor } = fakeStores({ au: { Unfulfilled: { orders: { nodes: [
    { name: '#1', createdAt: at(240), displayFulfillmentStatus: 'UNFULFILLED' },
    { name: '#2', createdAt: at(30), displayFulfillmentStatus: 'PARTIALLY_FULFILLED' },
    { name: '#3', createdAt: at(2), displayFulfillmentStatus: 'UNFULFILLED' },
  ], pageInfo: { hasNextPage: false } } } } });
  const { structured, text } = await runReport('unfulfilled', [stores[0]], { limit: 2 }, gqlFor);
  assert.deepEqual(structured.stores[0].data.buckets, { under_1_day: 1, '1_to_2_days': 1, '2_to_7_days': 0, over_7_days: 1 });
  assert.equal(structured.stores[0].data.oldest.length, 2);
  assert.match(text, /\| au \| 3 \| 1 \| 1 \| 0 \| 1 \| #1/);
});

test('low stock names where else each SKU is in stock', async () => {
  const lowAu = { productVariants: { nodes: [
    { sku: 'CAP-1', title: 'Default Title', inventoryQuantity: 1, inventoryItem: { tracked: true }, product: { title: 'Field cap', handle: 'field-cap' } },
    { sku: 'UNTRACKED', title: 'Default Title', inventoryQuantity: 0, inventoryItem: { tracked: false }, product: { title: 'Gift card', handle: 'gift' } },
  ], pageInfo: { hasNextPage: false } } };
  const { gqlFor } = fakeStores({
    au: { Variants: (v) => (v.query.startsWith('inventory_quantity') ? lowAu : { productVariants: { nodes: [{ sku: 'CAP-1', inventoryQuantity: 1 }] } }) },
    nz: { Variants: (v) => (v.query.startsWith('inventory_quantity') ? { productVariants: { nodes: [], pageInfo: { hasNextPage: false } } } : { productVariants: { nodes: [{ sku: 'CAP-1', inventoryQuantity: 40 }] } }) },
  });
  const { text, structured } = await runReport('low_stock', stores, {}, gqlFor);
  assert.equal(structured.stores[0].data.low.length, 1, 'untracked inventory is not low stock');
  assert.match(text, /\| CAP-1 \| Field cap \| 1 \| nz 40 \|/);
  assert.match(text, /store: nz\nNothing at or below 5\./);
});

test('catalogue gaps list missing products and status differences', async () => {
  const cat = (nodes) => ({ Catalog: { products: { nodes, pageInfo: { hasNextPage: false } } } });
  const { gqlFor } = fakeStores({
    au: cat([{ handle: 'cap', title: 'Cap', status: 'ACTIVE' }, { handle: 'mug', title: 'Mug', status: 'ACTIVE' }]),
    nz: cat([{ handle: 'cap', title: 'Cap', status: 'DRAFT' }]),
  });
  const { text, structured } = await runReport('catalog_gaps', stores, {}, gqlFor);
  assert.deepEqual(structured.summary.missing.map((m) => [m.handle, m.missingFrom]), [['mug', ['nz']]]);
  assert.deepEqual(structured.summary.differ[0].statuses, { au: 'ACTIVE', nz: 'DRAFT' });
  assert.match(text, /2 distinct products across 2 stores\. 1 missing from at least one store, 1 with a different status\./);
});

test('catalogue health counts each gap once per product', async () => {
  const { structured } = await runReport('catalog_health', [stores[0]], {}, fakeStores({ au: { Health: { products: { nodes: [
    { handle: 'a', title: 'A', description: '', productType: '', seo: {}, featuredMedia: null, priceRangeV2: { minVariantPrice: { amount: '0.0' } } },
    { handle: 'b', title: 'B', description: 'Nice', productType: 'Hat', seo: { description: 'x' }, featuredMedia: { alt: '' }, priceRangeV2: { minVariantPrice: { amount: '20' } } },
  ], pageInfo: { hasNextPage: false } } } } }).gqlFor);
  const i = structured.stores[0].data.issues;
  assert.deepEqual([i.no_image, i.image_without_alt, i.empty_description, i.no_seo_description, i.no_product_type, i.zero_price].map((l) => l.map((x) => x.match(/\((\w+)\)$/)[1])), [['a'], ['b'], ['a'], ['a'], ['a'], ['a']]);
});

test('duplicate SKUs: repeated inside a store, and the same SKU on different products', async () => {
  const v = (sku, handle) => ({ sku, product: { handle } });
  const { structured } = await runReport('duplicate_skus', stores, {}, fakeStores({
    au: { Variants: { productVariants: { nodes: [v('A', 'cap'), v('A', 'hat'), v('B', 'mug')], pageInfo: { hasNextPage: false } } } },
    nz: { Variants: { productVariants: { nodes: [v('B', 'bowl'), v('C', 'cup')], pageInfo: { hasNextPage: false } } } },
  }).gqlFor);
  assert.deepEqual(structured.summary.inside, [{ store: 'au', sku: 'A', products: ['cap', 'hat'] }]);
  assert.deepEqual(structured.summary.across.map((a) => a.sku), ['B']);
});

test('find_product quotes the SKU and keeps only matching variants', async () => {
  const { gqlFor, calls } = fakeStores({
    au: { Find: { products: { nodes: [{ title: 'Cap', handle: 'cap', status: 'ACTIVE', variants: { nodes: [{ sku: 'CAP-1', price: '30.00', inventoryQuantity: 4 }, { sku: 'CAP-2', price: '30.00' }] } }] } } },
    nz: { Find: { products: { nodes: [] } } },
  });
  const { text } = await runReport('find_product', stores, { sku: 'CAP-1' }, gqlFor);
  assert.equal(calls[0].variables.query, 'sku:"CAP-1"');
  assert.match(text, /\| au \| Cap \| CAP-1 \| ACTIVE \| 30\.00 \| 4 \|/);
  assert.doesNotMatch(text, /CAP-2/);
  assert.match(text, /\| nz \| not found/);
  await assert.rejects(REPORTS.find_product.gather(async () => ({}), {}), /Pass "sku", "handle" or "query"/);
});

test('an unknown report is refused with the list', async () => {
  await assert.rejects(runReport('nope', stores, {}, () => async () => ({})), /Reports: overview, sales/);
});
