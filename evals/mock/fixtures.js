// Deterministic store data for the evals. Dates are relative to `now`, and no order sits within a
// day and a half of the 7-day boundary, so "the last 7 days" means the same orders to any reader.

const DAY = 86_400_000;

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

const STORE_DEFS = {
  harbour: { domain: 'harbour-coffee.myshopify.com', title: 'Harbour Coffee', currency: 'AUD', tz: 'Australia/Sydney', country: 'AU', prefix: 'HB', seed: 11 },
  tidewater: { domain: 'tidewater-swim.myshopify.com', title: 'Tidewater Swim', currency: 'NZD', tz: 'Pacific/Auckland', country: 'NZ', prefix: 'TW', seed: 23 },
  northpaper: { domain: 'northpaper.myshopify.com', title: 'Northpaper', currency: 'GBP', tz: 'Europe/London', country: 'GB', prefix: 'NP', seed: 37 },
};

// Products with a fixed story per store; the eval tasks are written against these.
const CATALOGUES = {
  harbour: [
    ['Coffee beans 1kg', 'coffee-beans-1kg', 'HB-BEANS-1KG', 42, 18, { compareAt: 48 }],
    ['Coffee beans 250g', 'coffee-beans-250g', 'HB-BEANS-250', 14, 64],
    ['Pour-over kettle', 'pour-over-kettle', 'HB-KETTLE', 89, 3],
    ['Ceramic mug', 'ceramic-mug', 'HB-MUG-01', 24, 40],
    ['Ceramic mug, speckled', 'ceramic-mug-speckled', 'HB-MUG-01', 26, 12],
    ['Linen apron', 'linen-apron', 'HB-APRON', 29, 9],
    ['Burr grinder', 'burr-grinder', 'HB-GRINDER', 149, 0],
    ['Cold brew jar', 'cold-brew-jar', 'HB-COLDBREW', 35, 5, { noImage: true }],
    ['Gift card', 'gift-card', 'HB-GIFT', 50, 0, { untracked: true }],
    ['Tasting flight', 'tasting-flight', 'HB-FLIGHT', 39, 22, { noImage: true }],
    ['Barista course', 'barista-course', 'HB-COURSE', 120, 7, { status: 'DRAFT' }],
    ['Filter papers', 'filter-papers', 'HB-FILTERS', 8, 4],
  ],
  tidewater: [
    ['Coffee beans 1kg', 'coffee-beans-1kg', 'HB-BEANS-1KG', 46, 0],
    ['Swim cap', 'swim-cap', 'TW-CAP', 19, 55],
    ['Goggles', 'goggles', 'TW-GOGGLES', 32, 2],
    ['Beach towel', 'beach-towel', 'TW-TOWEL', 45, 30],
    ['Kickboard', 'kickboard', 'TW-KICK', 28, 14, { noImage: true }],
    ['Pull buoy', 'pull-buoy', 'TW-BUOY', 22, 5],
    ['Wetsuit', 'wetsuit', 'TW-WETSUIT', 340, 6],
    ['Ceramic mug', 'ceramic-mug', 'TW-MUG', 24, 11, { status: 'DRAFT' }],
    ['Fins', 'fins', 'TW-FINS', 65, 1],
    ['Dry bag', 'dry-bag', 'TW-DRYBAG', 38, 20],
  ],
  northpaper: [
    ['Linen-bound notebook', 'linen-notebook', 'NP-NOTE-LINEN', 18.5, 26],
    ['A5 notebook, ruled', 'a5-notebook-ruled', 'NP-PAD-A5', 12, 0],
    ['A5 notebook, dotted', 'a5-notebook-dotted', 'NP-PAD-A5', 12, 33],
    ['Fountain pen', 'fountain-pen', 'NP-PEN', 64, 8],
    ['Ink, blue-black', 'ink-blue-black', 'NP-INK', 15, 3],
    ['Desk calendar', 'desk-calendar', 'NP-CAL', 21, 41, { noImage: true }],
    ['Pencil set', 'pencil-set', 'NP-PENCILS', 9.5, 70],
    ['Ceramic mug', 'ceramic-mug', 'NP-MUG', 16, 13],
    ['Letterpress cards', 'letterpress-cards', 'NP-CARDS', 14, 5, { noImage: true }],
    ['Coffee beans 250g', 'coffee-beans-250g', 'NP-BEANS', 11, 0, { status: 'ARCHIVED' }],
  ],
};

// Orders: [daysAgo, total, { cancelled, test, fulfilment }]. Nothing between 5.5 and 8.5 days ago.
const ORDERS = {
  harbour: [[0.2, 42], [0.6, 14, { fulfilment: 'UNFULFILLED' }], [1.4, 89, { fulfilment: 'UNFULFILLED' }], [2.2, 66], [3.1, 24, { fulfilment: 'PARTIALLY_FULFILLED' }], [3.9, 120, { cancelled: true }], [4.5, 300, { test: true }], [5.2, 56], [9, 42, { fulfilment: 'UNFULFILLED' }], [12, 75], [15, 33], [20, 149]],
  tidewater: [[0.3, 19], [1.1, 65, { fulfilment: 'UNFULFILLED' }], [2.5, 340], [4.4, 45, { fulfilment: 'UNFULFILLED' }], [5.1, 22, { cancelled: true }], [10, 32], [13, 90, { fulfilment: 'UNFULFILLED' }], [18, 38]],
  northpaper: [[0.5, 18.5], [0.9, 64, { fulfilment: 'UNFULFILLED' }], [1.8, 24], [2.6, 12, { test: true }], [3.3, 30.5], [4.9, 9.5], [9.5, 41], [16, 15, { fulfilment: 'UNFULFILLED' }], [25, 28, { fulfilment: 'UNFULFILLED' }]],
};

const money = (amount, currencyCode) => ({ amount: Number(amount).toFixed(2), currencyCode });
const moneyBag = (amount, currencyCode) => ({ shopMoney: money(amount, currencyCode), presentmentMoney: money(amount, currencyCode) });

function buildStore(name, def, catalogue, orders, now) {
  const r = rng(def.seed);
  let nextId = def.seed * 1000;
  const id = (type) => `gid://shopify/${type}/${++nextId}`;
  const location = { id: id('Location'), name: `${def.title} warehouse`, isActive: true, fulfillsOnlineOrders: true, address: { city: 'Main', country: def.country, countryCode: def.country, formatted: [def.country] } };
  const products = [];
  const variants = [];
  catalogue.forEach(([title, handle, sku, price, qty, opt = {}], i) => {
    const createdAt = new Date(now - (60 + i * 3) * DAY).toISOString();
    const updatedAt = new Date(now - (i % 4 === 0 ? 2 + i * 0.1 : 20 + i) * DAY).toISOString();
    const product = {
      id: id('Product'), title, handle, status: opt.status || 'ACTIVE', vendor: def.title, productType: i % 3 ? 'Goods' : '',
      tags: i % 2 ? ['core'] : [], createdAt, updatedAt, publishedAt: createdAt,
      description: i % 5 === 4 ? '' : `${title} from ${def.title}.`,
      descriptionHtml: i % 5 === 4 ? '' : `<p>${title} from ${def.title}.</p>`,
      onlineStoreUrl: `https://${def.domain}/products/${handle}`,
      seo: { title: null, description: i % 2 ? `${title}, made well.` : null },
      tracksInventory: !opt.untracked, hasOnlyDefaultVariant: true, isGiftCard: Boolean(opt.untracked),
    };
    const media = opt.noImage ? null : { id: id('MediaImage'), alt: i % 4 === 1 ? '' : title, mediaContentType: 'IMAGE', preview: { image: { url: `https://cdn.example.com/${handle}.jpg`, altText: i % 4 === 1 ? '' : title, width: 800, height: 800 } }, status: 'READY' };
    product.featuredMedia = media;
    product.featuredImage = media ? { id: media.id, url: media.preview.image.url, altText: media.alt, width: 800, height: 800 } : null;
    product.images = media ? [product.featuredImage] : [];
    product.media = media ? [media] : [];
    const inventoryItem = { id: id('InventoryItem'), sku, tracked: !opt.untracked, requiresShipping: true, unitCost: money(price * 0.4, def.currency) };
    const variant = {
      id: id('ProductVariant'), title: 'Default Title', displayName: `${title} - Default Title`, sku, barcode: null, position: 1,
      price: Number(price).toFixed(2), compareAtPrice: opt.compareAt ? Number(opt.compareAt).toFixed(2) : null,
      inventoryQuantity: qty, inventoryPolicy: 'DENY', availableForSale: qty > 0 || Boolean(opt.untracked), taxable: true, createdAt, updatedAt,
      selectedOptions: [{ name: 'Title', value: 'Default Title' }], inventoryItem, product,
    };
    inventoryItem.variant = variant;
    inventoryItem.inventoryLevels = [{ id: id('InventoryLevel'), location, quantities: [{ name: 'available', quantity: qty }, { name: 'on_hand', quantity: qty }, { name: 'committed', quantity: 0 }] }];
    product.variants = [variant];
    product.totalInventory = qty;
    product.priceRangeV2 = { minVariantPrice: money(price, def.currency), maxVariantPrice: money(price, def.currency) };
    product.priceRange = product.priceRangeV2;
    product.options = [{ name: 'Title', values: ['Default Title'] }];
    products.push(product);
    variants.push(variant);
  });
  const customers = [1, 2, 3, 4].map((n) => ({ id: id('Customer'), firstName: `Customer${n}`, lastName: name, displayName: `Customer${n} ${name}`, email: `c${n}@${name}.example`, createdAt: new Date(now - n * 30 * DAY).toISOString(), numberOfOrders: String(n), amountSpent: money(n * 50, def.currency), state: 'ENABLED', tags: [] }));
  const builtOrders = orders.map(([daysAgo, total, opt = {}], i) => {
    const at = new Date(now - daysAgo * DAY).toISOString();
    const fulfilment = opt.fulfilment || 'FULFILLED';
    const variant = variants[Math.floor(r() * variants.length)];
    const open = !opt.cancelled && fulfilment !== 'FULFILLED';
    return {
      id: id('Order'), name: `#${1001 + i}`, createdAt: at, processedAt: at, updatedAt: at,
      cancelledAt: opt.cancelled ? at : null, cancelReason: opt.cancelled ? 'CUSTOMER' : null,
      closed: !open, closedAt: open ? null : at, test: Boolean(opt.test), confirmed: true,
      email: customers[i % 4].email, customer: customers[i % 4], currencyCode: def.currency, presentmentCurrencyCode: def.currency,
      displayFinancialStatus: 'PAID', displayFulfillmentStatus: fulfilment, fulfillable: fulfilment !== 'FULFILLED',
      currentTotalPriceSet: moneyBag(total, def.currency), totalPriceSet: moneyBag(total, def.currency),
      subtotalPriceSet: moneyBag(total, def.currency), currentSubtotalPriceSet: moneyBag(total, def.currency),
      totalDiscountsSet: moneyBag(0, def.currency), currentTotalDiscountsSet: moneyBag(0, def.currency), totalShippingPriceSet: moneyBag(0, def.currency), currentShippingPriceSet: moneyBag(0, def.currency),
      totalTaxSet: moneyBag(0, def.currency), currentTotalTaxSet: moneyBag(0, def.currency), totalRefundedSet: moneyBag(0, def.currency),
      netPaymentSet: moneyBag(total, def.currency), totalReceivedSet: moneyBag(total, def.currency),
      sourceName: 'web', tags: [], note: null, shippingAddress: { city: 'Main', country: def.country, countryCodeV2: def.country, provinceCode: null },
      lineItems: [{ id: id('LineItem'), title: variant.product.title, name: variant.product.title, quantity: 1, sku: variant.sku, variant, product: variant.product, originalTotalSet: moneyBag(total, def.currency), discountedTotalSet: moneyBag(total, def.currency), originalUnitPriceSet: moneyBag(total, def.currency), unfulfilledQuantity: fulfilment === 'FULFILLED' ? 0 : 1, fulfillableQuantity: fulfilment === 'FULFILLED' ? 0 : 1 }],
    };
  });
  return {
    name,
    token: `eval-token-${name}`,
    shop: {
      id: id('Shop'), name: def.title, myshopifyDomain: def.domain, email: `hello@${name}.example`, contactEmail: `hello@${name}.example`,
      currencyCode: def.currency, ianaTimezone: def.tz, timezoneAbbreviation: def.tz.split('/')[1].slice(0, 4).toUpperCase(),
      primaryDomain: { url: `https://${name}.example`, host: `${name}.example` }, url: `https://${name}.example`,
      plan: { publicDisplayName: 'Basic', partnerDevelopment: false, shopifyPlus: false, displayName: 'Basic' },
      billingAddress: { country: def.country, countryCodeV2: def.country, city: 'Main' }, weightUnit: 'KILOGRAMS',
      enabledPresentmentCurrencies: [def.currency], currencyFormats: { moneyFormat: '${{amount}}' },
    },
    products, variants, orders: builtOrders, customers, locations: [location], collections: [],
  };
}

// Extra stores for the speed benchmark: same shape, generated catalogue and orders.
function syntheticDefs(count) {
  const out = {};
  for (let i = 1; i <= count; i++) {
    const name = `store${i}`;
    out[name] = { domain: `bench-store-${i}.myshopify.com`, title: `Bench store ${i}`, currency: 'USD', tz: 'America/New_York', country: 'US', prefix: `S${i}`, seed: 100 + i };
  }
  return out;
}

export function buildFixtures({ now = Date.now(), bench = 0 } = {}) {
  const stores = {};
  for (const [name, def] of Object.entries(STORE_DEFS)) stores[name] = buildStore(name, def, CATALOGUES[name], ORDERS[name], now);
  for (const [name, def] of Object.entries(syntheticDefs(bench))) {
    const cat = CATALOGUES.harbour.map(([t, h, sku, p, q, o]) => [t, h, sku.replace('HB', def.prefix), p, q, o]);
    stores[name] = buildStore(name, def, cat, ORDERS.harbour, now);
  }
  for (const s of Object.values(stores)) { s.domain = s.shop.myshopifyDomain; stampTypes(s); }
  return { now, stores };
}

// Interfaces such as Node and Media resolve by __typename, which every gid already names.
function stampTypes(root) {
  const seen = new Set();
  const walk = (v) => {
    if (!v || typeof v !== 'object' || seen.has(v)) return;
    seen.add(v);
    if (Array.isArray(v)) { v.forEach(walk); return; }
    const m = typeof v.id === 'string' && v.id.match(/^gid:\/\/shopify\/(\w+)\//);
    if (m && !v.__typename) v.__typename = m[1];
    Object.values(v).forEach(walk);
  };
  walk(root);
}

export const EVAL_STORES = Object.keys(STORE_DEFS);
