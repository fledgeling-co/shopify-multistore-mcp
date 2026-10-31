// The agent tasks: questions an agency account manager asks about several stores. Every expected
// answer is computed from the fixtures, and grading is deterministic: each fact must appear in the
// part of the answer that talks about its store.

const DAY = 86_400_000;
const STORES = ['harbour', 'tidewater', 'northpaper'];
const LABELS = { harbour: /harbour/gi, tidewater: /tidewater/gi, northpaper: /northpaper/gi };

// Text after each mention of a store, up to the next mention of any store.
export function segments(answer) {
  const marks = [];
  for (const s of STORES) for (const m of answer.matchAll(LABELS[s])) marks.push({ s, at: m.index });
  marks.sort((a, b) => a.at - b.at);
  const out = Object.fromEntries(STORES.map((s) => [s, '']));
  marks.forEach((m, i) => { out[m.s] += ` ${answer.slice(m.at, marks[i + 1]?.at ?? answer.length)}`; });
  return out;
}

const num = (n) => {
  const fixed = Number(n).toFixed(2);
  const whole = Number.isInteger(Number(n)) ? String(Number(n)) : null;
  const variants = [fixed, fixed.replace(/\.?0+$/, ''), whole, Number(n).toLocaleString('en', { minimumFractionDigits: 2 })].filter(Boolean);
  return new RegExp(`(?<![\\d.])(${[...new Set(variants)].map((v) => v.replace('.', '\\.')).join('|')})(?![\\d])`);
};
const word = (w) => (w instanceof RegExp ? w : new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));

function check(answer, expect) {
  const seg = segments(answer);
  const misses = [];
  for (const [store, facts] of Object.entries(expect.byStore || {})) {
    for (const f of facts) if (!(typeof f === 'number' ? num(f) : word(f)).test(seg[store])) misses.push(`${store}: ${f}`);
  }
  for (const f of expect.anywhere || []) if (!word(f).test(answer)) misses.push(`answer: ${f}`);
  return { pass: misses.length === 0, misses };
}

export function buildTasks(fixtures) {
  const S = fixtures.stores;
  const now = fixtures.now;
  const open = (o) => !o.cancelledAt && ['UNFULFILLED', 'PARTIALLY_FULFILLED'].includes(o.displayFulfillmentStatus);
  const active = (s) => s.products.filter((p) => p.status === 'ACTIVE');
  const weekSales = (s) => s.orders.filter((o) => !o.test && !o.cancelledAt && Date.parse(o.processedAt) >= now - 7 * DAY).reduce((a, o) => a + Number(o.currentTotalPriceSet.shopMoney.amount), 0);
  const low = (s) => s.variants.filter((v) => v.product.status === 'ACTIVE' && v.inventoryItem.tracked && v.inventoryQuantity <= 5).map((v) => v.sku);
  const noImage = (s) => active(s).filter((p) => !p.featuredMedia);
  const dupes = (s) => { const c = {}; for (const v of s.variants) c[v.sku] = (c[v.sku] || 0) + 1; return Object.keys(c).filter((k) => c[k] > 1); };
  const sku = 'HB-BEANS-1KG';
  const beans = (s) => s.variants.find((v) => v.sku === sku);
  const tideHandles = new Set(S.tidewater.products.map((p) => p.handle));
  const gaps = active(S.harbour).filter((p) => !tideHandles.has(p.handle));
  const gapWord = { 'coffee-beans-250g': /250/, 'pour-over-kettle': /kettle/i, 'ceramic-mug-speckled': /speckled/i, 'linen-apron': /apron/i, 'burr-grinder': /grinder/i, 'cold-brew-jar': /cold[ -]brew/i, 'gift-card': /gift/i, 'tasting-flight': /tasting|flight/i, 'filter-papers': /filter/i };
  const oldest = (s) => s.orders.filter(open).sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0].name;

  const tasks = [
    // As in Shopify admin's Unfulfilled view: unfulfilled or partially fulfilled, not cancelled.
    { id: 'unfulfilled', prompt: 'How many orders are still waiting to be fulfilled in each store, and which order has been waiting longest in each?',
      expect: { byStore: Object.fromEntries(STORES.map((s) => [s, [S[s].orders.filter(open).length, oldest(S[s])]])) } },
    { id: 'sales', prompt: 'What did each store sell over the last 7 days? Leave out cancelled and test orders, and give each total in the store\'s own currency.',
      expect: { byStore: Object.fromEntries(STORES.map((s) => [s, [weekSales(S[s])]])) } },
    { id: 'low_stock', prompt: 'Which products have 5 or fewer units left in each store? Give me the SKUs.',
      expect: { byStore: Object.fromEntries(STORES.map((s) => [s, low(S[s])])) } },
    { id: 'compare_sku', prompt: `Compare SKU ${sku} across all my stores: price, compare-at price and stock in each.`,
      expect: { byStore: { harbour: [Number(beans(S.harbour).price), beans(S.harbour).inventoryQuantity], tidewater: [Number(beans(S.tidewater).price), /\b0\b|out of stock|none left/i], northpaper: [/not|no |isn|doesn|missing|n\/a|none|absent|—/i] } } },
    { id: 'catalog_gap', prompt: 'Which active products does harbour sell that tidewater doesn\'t carry at all?',
      expect: { anywhere: gaps.map((p) => gapWord[p.handle] ?? p.title) } },
    { id: 'no_image', prompt: 'Which active products have no image, in each store?',
      // A product counts as named by its title or its handle.
      expect: { byStore: Object.fromEntries(STORES.map((s) => [s, noImage(S[s]).map((p) => new RegExp(`${p.title.split(' ').slice(0, 2).join(' ')}|${p.handle}`, 'i'))])) } },
    { id: 'duplicate_skus', prompt: 'Is any SKU used by more than one product or variant inside the same store? Tell me which store.',
      expect: { byStore: Object.fromEntries(STORES.filter((s) => dupes(S[s]).length).map((s) => [s, dupes(S[s])])) } },
    { id: 'active_count', prompt: 'How many active products does each store have?',
      expect: { byStore: Object.fromEntries(STORES.map((s) => [s, [active(S[s]).length]])) } },
    { id: 'shop_settings', prompt: 'What currency and time zone does the northpaper store use?',
      expect: { anywhere: [/GBP|pound/i, /London/i] } },
    { id: 'find_title', prompt: 'Which of my stores sell something with "linen" in the name, and at what price?',
      expect: { byStore: { harbour: [/apron/i, Number(S.harbour.products.find((p) => /linen/i.test(p.title)).variants[0].price)], northpaper: [/notebook/i, Number(S.northpaper.products.find((p) => /linen/i.test(p.title)).variants[0].price)] } } },
  ];
  return tasks.map((t) => ({ ...t, grade: (answer) => check(answer, t.expect) }));
}
