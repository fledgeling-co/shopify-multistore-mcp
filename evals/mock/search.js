// Shopify's search syntax, enough of it for the Admin API's `query` argument: field:value terms,
// comparisons (>, >=, <, <=), quoted values, * wildcards, implicit AND, OR, NOT / leading -, and
// parentheses. As in Shopify, a filter on a field this resource does not support is ignored.

function tokenize(q) {
  const out = [];
  const re = /\s*(\(|\)|-?[^\s():"]+:(?:"[^"]*"|[^\s()]+)|"[^"]*"|[^\s()]+)/g;
  let m;
  while ((m = re.exec(q))) out.push(m[1]);
  return out;
}

const unq = (v) => String(v).replace(/^"(.*)"$/, '$1');
const day = (v) => String(v).slice(0, 10);

const FIELDS = {
  product: {
    title: (n) => n.title, handle: (n) => n.handle, status: (n) => n.status, vendor: (n) => n.vendor, product_type: (n) => n.productType,
    tag: (n) => n.tags, sku: (n) => n.variants.map((v) => v.sku), inventory_total: (n) => n.totalInventory, created_at: (n) => n.createdAt,
    updated_at: (n) => n.updatedAt, published_status: () => 'published', id: (n) => String(n.id).split('/').pop(), gift_card: (n) => n.isGiftCard, barcode: () => null,
  },
  variant: {
    sku: (n) => n.sku, title: (n) => n.title, inventory_quantity: (n) => n.inventoryQuantity, product_status: (n) => n.product.status, product_id: (n) => String(n.product.id).split('/').pop(),
    vendor: (n) => n.product.vendor, product_type: (n) => n.product.productType, tag: (n) => n.product.tags, barcode: (n) => n.barcode, updated_at: (n) => n.updatedAt, managed: (n) => n.inventoryItem.tracked,
  },
  order: {
    name: (n) => [n.name, n.name.replace('#', '')], created_at: (n) => n.createdAt, processed_at: (n) => n.processedAt, updated_at: (n) => n.updatedAt, test: (n) => n.test, email: (n) => n.email, tag: (n) => n.tags,
    sku: (n) => n.lineItems.map((l) => l.sku), financial_status: (n) => n.displayFinancialStatus.toLowerCase(),
    status: (n) => (n.cancelledAt ? ['cancelled', 'closed'] : n.closed ? ['closed'] : ['open']),
    fulfillment_status: (n) => ({ UNFULFILLED: ['unfulfilled', 'unshipped'], PARTIALLY_FULFILLED: ['partial', 'partially_fulfilled'], FULFILLED: ['shipped', 'fulfilled'] })[n.displayFulfillmentStatus] || [],
  },
  customer: { email: (n) => n.email, created_at: (n) => n.createdAt, state: (n) => n.state },
  location: { name: (n) => n.name, active: (n) => n.isActive },
};

function compare(actual, op, raw) {
  const values = Array.isArray(actual) ? actual : [actual];
  const want = unq(raw);
  return values.some((a) => {
    if (a === null || a === undefined) return false;
    if (typeof a === 'boolean') return String(a) === want.toLowerCase();
    if (want.toLowerCase() === 'any') return true;
    const isDate = /^\d{4}-\d{2}-\d{2}/.test(want) && /^\d{4}-\d{2}-\d{2}/.test(String(a));
    const num = !isDate && typeof a === 'number' && want !== '' && !Number.isNaN(Number(want));
    const x = isDate ? (want.length > 10 ? String(a) : day(a)) : num ? a : String(a).toLowerCase();
    const y = isDate ? want : num ? Number(want) : want.toLowerCase();
    switch (op) {
      case '>': return x > y;
      case '>=': return x >= y;
      case '<': return x < y;
      case '<=': return x <= y;
      default:
        if (typeof y === 'string' && y.includes('*')) return new RegExp(`^${y.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`, 'i').test(String(x));
        return x === y;
    }
  });
}

function atom(node, tok, kind) {
  const m = tok.match(/^([a-z_]+):(>=|<=|>|<)?(.*)$/i);
  if (!m) {
    const word = unq(tok).toLowerCase().replace(/\*/g, '');
    const text = [node.title, node.handle, node.name, node.sku, node.vendor, ...(node.tags || []), node.product?.title].filter(Boolean).join(' ').toLowerCase();
    return text.includes(word);
  }
  const field = FIELDS[kind]?.[m[1].toLowerCase()];
  if (!field) return true; // Shopify ignores filters it does not know
  return compare(field(node), m[2] || '=', m[3]);
}

export function matches(node, query, kind) {
  const toks = tokenize(String(query || ''));
  let i = 0;
  const expr = () => {
    let v = term();
    while (toks[i] === 'OR') { i++; const r = term(); v = v || r; }
    return v;
  };
  const term = () => {
    let v = true;
    while (i < toks.length && toks[i] !== ')' && toks[i] !== 'OR') {
      if (toks[i] === 'AND') { i++; continue; }
      const f = factor();
      v = v && f;
    }
    return v;
  };
  const factor = () => {
    let neg = false;
    if (toks[i] === 'NOT') { neg = true; i++; }
    let t = toks[i++];
    if (t?.startsWith('-') && t.length > 1) { neg = !neg; t = t.slice(1); }
    let v;
    if (t === '(') { v = expr(); if (toks[i] === ')') i++; } else v = atom(node, t, kind);
    return neg ? !v : v;
  };
  return toks.length ? expr() : true;
}
