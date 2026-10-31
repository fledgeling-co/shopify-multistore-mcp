// Ready-made cross-store reports. Each report is a fixed Admin GraphQL query (checked against the
// newest schema by `doctor`), a page cap so a large store cannot hold a call open for minutes, and a
// pure `combine` step that turns per-store results into one answer. Page sizes keep every query under
// Shopify's 1,000-point single-query cost limit.

export class ReportError extends Error {}

const DAY_MS = 86_400_000;

export const REPORT_QUERIES = {
  overview: `query Overview($recent: String!) {
  shop { name myshopifyDomain currencyCode ianaTimezone plan { publicDisplayName } }
  activeProducts: productsCount(query: "status:active") { count precision }
  draftProducts: productsCount(query: "status:draft") { count precision }
  recentOrders: ordersCount(query: $recent) { count precision }
  openUnfulfilled: ordersCount(query: "status:open fulfillment_status:unfulfilled") { count precision }
  locationsCount { count precision }
}`,
  sales: `query Sales($query: String!, $after: String) {
  orders(first: 200, after: $after, query: $query, sortKey: PROCESSED_AT) {
    nodes { processedAt cancelledAt test currentTotalPriceSet { shopMoney { amount currencyCode } } }
    pageInfo { hasNextPage endCursor }
  }
}`,
  unfulfilled: `query Unfulfilled($query: String!, $after: String) {
  orders(first: 200, after: $after, query: $query, sortKey: CREATED_AT) {
    nodes { name createdAt displayFulfillmentStatus currentTotalPriceSet { shopMoney { amount currencyCode } } }
    pageInfo { hasNextPage endCursor }
  }
}`,
  variants: `query Variants($query: String, $after: String) {
  productVariants(first: 200, after: $after, query: $query) {
    nodes { sku title price compareAtPrice inventoryQuantity inventoryItem { tracked } product { title handle status } }
    pageInfo { hasNextPage endCursor }
  }
}`,
  find: `query Find($query: String!) {
  products(first: 10, query: $query) {
    nodes {
      title handle status vendor totalInventory
      variants(first: 25) { nodes { sku title price compareAtPrice inventoryQuantity } }
    }
  }
}`,
  catalog: `query Catalog($query: String, $after: String) {
  products(first: 250, after: $after, query: $query, sortKey: ID) {
    nodes { handle title status }
    pageInfo { hasNextPage endCursor }
  }
}`,
  health: `query Health($query: String, $after: String) {
  products(first: 100, after: $after, query: $query) {
    nodes {
      handle title status vendor productType
      description(truncateAt: 40)
      seo { title description }
      featuredMedia { alt }
      priceRangeV2 { minVariantPrice { amount } }
    }
    pageInfo { hasNextPage endCursor }
  }
}`,
  changes: `query Changes($query: String!, $after: String) {
  products(first: 100, after: $after, query: $query, sortKey: UPDATED_AT, reverse: true) {
    nodes { handle title status updatedAt }
    pageInfo { hasNextPage endCursor }
  }
}`,
};

// --------------------------------------------------------------------------- helpers

export function isoDay(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

// "7" days back from now, or explicit since/until days. Shopify reads a bare date in the store's
// own time zone, so a day boundary lands where the merchant expects it.
export function period({ days, since, until }, now = Date.now()) {
  const d = days === undefined ? 7 : Number(days);
  if (since !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(since))) throw new ReportError('"since" must be a date like 2026-10-01.');
  if (until !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(until))) throw new ReportError('"until" must be a date like 2026-10-31.');
  if (!(d >= 0 && d <= 366)) throw new ReportError('"days" must be between 0 and 366.');
  const from = since ?? isoDay(now - d * DAY_MS);
  return { since: from, until: until ?? null, label: until ? `${from} to ${until}` : `since ${from}` };
}

function range({ since, until }, field) {
  return `${field}:>=${since}${until ? ` ${field}:<${until}` : ''}`;
}

function money(set) {
  const m = set?.shopMoney;
  return m ? { amount: Number(m.amount), currency: m.currencyCode } : null;
}

function addTo(totals, m) {
  if (!m || !Number.isFinite(m.amount)) return;
  totals[m.currency] = round2((totals[m.currency] || 0) + m.amount);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function fmtMoney(totals) {
  const parts = Object.entries(totals).map(([c, a]) => `${a.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${c}`);
  return parts.length ? parts.join(' + ') : '0';
}

function count(c) {
  if (!c) return 'n/a';
  return c.precision && c.precision !== 'EXACT' ? `${c.count}+` : String(c.count);
}

// Follows pageInfo.endCursor until the connection ends or `maxPages` is reached.
export async function paginate(gql, query, variables, connection, maxPages) {
  const nodes = [];
  let after;
  for (let page = 0; page < maxPages; page++) {
    const data = await gql(query, { ...variables, after });
    const conn = connection(data);
    nodes.push(...(conn?.nodes || []));
    if (!conn?.pageInfo?.hasNextPage) return { nodes, complete: true };
    after = conn.pageInfo.endCursor;
  }
  return { nodes, complete: false };
}

const quote = (v) => `"${String(v).replace(/["\\]/g, '\\$&')}"`;

function capped(n, complete, noun) {
  return complete ? '' : ` (first ${n} ${noun} only; ask for a narrower period or raise max_pages)`;
}

// --------------------------------------------------------------------------- reports
// gather(gql, params, store) runs on one store; combine(rows, params) sees every store's
// { store, domain, data } or { store, domain, error } and returns { text, summary }.

export const REPORTS = {
  overview: {
    title: 'Overview of every store',
    description: 'Name, currency, plan, active and draft product counts, orders in the period, open unfulfilled orders and locations, per store.',
    async gather(gql, p) {
      const per = period(p);
      const data = await gql(REPORT_QUERIES.overview, { recent: range(per, 'created_at') });
      return { period: per.label, ...data };
    },
    combine(rows) {
      const lines = rows.filter((r) => r.data).map(({ store, data: d }) =>
        `| ${store} | ${d.shop?.name ?? ''} | ${d.shop?.currencyCode ?? ''} | ${count(d.activeProducts)} | ${count(d.draftProducts)} | ${count(d.recentOrders)} | ${count(d.openUnfulfilled)} | ${count(d.locationsCount)} |`);
      const period = rows.find((r) => r.data)?.data.period ?? '';
      return {
        text: `| store | name | currency | active products | draft products | orders ${period} | open unfulfilled | locations |\n|---|---|---|---|---|---|---|---|\n${lines.join('\n')}`,
      };
    },
  },

  sales: {
    title: 'Sales by store',
    description: 'Order count, sales total (current order totals, after edits and refunds) and average order value per store for a period, excluding test and cancelled orders. Totals stay in each store\'s own currency.',
    async gather(gql, p) {
      const per = period(p);
      const { nodes, complete } = await paginate(gql, REPORT_QUERIES.sales, { query: range(per, 'processed_at') }, (d) => d.orders, p.max_pages ?? 10);
      const totals = {};
      let orders = 0;
      let cancelled = 0;
      for (const o of nodes) {
        if (o.test) continue;
        if (o.cancelledAt) { cancelled++; continue; }
        orders++;
        addTo(totals, money(o.currentTotalPriceSet));
      }
      const average = {};
      for (const [c, a] of Object.entries(totals)) average[c] = round2(a / Math.max(orders, 1));
      return { period: per.label, orders, cancelled, totals, average, complete, scanned: nodes.length };
    },
    combine(rows) {
      const ok = rows.filter((r) => r.data);
      const grand = {};
      let orders = 0;
      for (const { data } of ok) { orders += data.orders; for (const [c, a] of Object.entries(data.totals)) addTo(grand, { amount: a, currency: c }); }
      const lines = ok.map(({ store, data: d }) => `| ${store} | ${d.orders} | ${fmtMoney(d.totals)} | ${fmtMoney(d.average)} | ${d.cancelled} |${capped(d.scanned, d.complete, 'orders')}`);
      return {
        text: `Sales ${ok[0]?.data.period ?? ''}, test and cancelled orders excluded.\n\n| store | orders | sales | average order | cancelled |\n|---|---|---|---|---|\n${lines.join('\n')}\n\nAll stores: ${orders} orders, ${fmtMoney(grand)}. Currencies are not converted.`,
        summary: { orders, totals: grand },
      };
    },
  },

  unfulfilled: {
    title: 'Unfulfilled orders by age',
    description: 'Open orders not yet fully fulfilled, grouped by age (under 1 day, 1-2, 2-7, over 7 days), with the oldest listed per store.',
    async gather(gql, p, store, now = Date.now()) {
      const query = 'status:open (fulfillment_status:unfulfilled OR fulfillment_status:partial)';
      const { nodes, complete } = await paginate(gql, REPORT_QUERIES.unfulfilled, { query }, (d) => d.orders, p.max_pages ?? 5);
      const buckets = { under_1_day: 0, '1_to_2_days': 0, '2_to_7_days': 0, over_7_days: 0 };
      for (const o of nodes) {
        const age = (now - Date.parse(o.createdAt)) / DAY_MS;
        buckets[age < 1 ? 'under_1_day' : age < 2 ? '1_to_2_days' : age < 7 ? '2_to_7_days' : 'over_7_days']++;
      }
      const oldest = nodes.slice(0, p.limit ?? 5).map((o) => ({ order: o.name, created: o.createdAt.slice(0, 10), status: o.displayFulfillmentStatus, total: money(o.currentTotalPriceSet) }));
      return { total: nodes.length, buckets, oldest, complete };
    },
    combine(rows) {
      const ok = rows.filter((r) => r.data);
      const lines = ok.map(({ store, data: d }) => `| ${store} | ${d.total}${d.complete ? '' : '+'} | ${d.buckets.under_1_day} | ${d.buckets['1_to_2_days']} | ${d.buckets['2_to_7_days']} | ${d.buckets.over_7_days} | ${d.oldest.map((o) => `${o.order} (${o.created})`).join(', ') || 'none'} |`);
      const total = ok.reduce((n, r) => n + r.data.total, 0);
      return {
        text: `| store | unfulfilled | under 1 day | 1-2 days | 2-7 days | over 7 days | oldest |\n|---|---|---|---|---|---|---|\n${lines.join('\n')}\n\nAll stores: ${total} open orders waiting.`,
        summary: { total },
      };
    },
  },

  low_stock: {
    title: 'Low stock, with stock in other stores',
    description: 'Variants of active products with tracked inventory at or below a threshold (default 5). When more than one store is included, each low SKU is looked up in the other stores so stock can be moved.',
    async gather(gql, p) {
      const threshold = Number(p.threshold ?? 5);
      const { nodes, complete } = await paginate(gql, REPORT_QUERIES.variants, { query: `inventory_quantity:<=${threshold} product_status:active` }, (d) => d.productVariants, p.max_pages ?? 5);
      const low = nodes.filter((v) => v.inventoryItem?.tracked !== false && v.inventoryQuantity <= threshold)
        .map((v) => ({ sku: v.sku || null, product: v.product?.title, variant: v.title, handle: v.product?.handle, quantity: v.inventoryQuantity }))
        .sort((a, b) => a.quantity - b.quantity);
      return { threshold, low, complete };
    },
    // Second pass: where else is each low SKU in stock?
    async crossCheck(rows, gqlFor) {
      const ok = rows.filter((r) => r.data);
      if (ok.length < 2) return;
      const skus = [...new Set(ok.flatMap((r) => r.data.low.map((v) => v.sku)).filter(Boolean))].slice(0, 100);
      if (!skus.length) return;
      await Promise.all(ok.map(async (r) => {
        const found = {};
        for (let i = 0; i < skus.length; i += 25) {
          const chunk = skus.slice(i, i + 25);
          try {
            const data = await gqlFor(r.store)(REPORT_QUERIES.variants, { query: chunk.map((s) => `sku:${quote(s)}`).join(' OR ') });
            for (const v of data.productVariants?.nodes || []) if (v.sku) found[v.sku] = (found[v.sku] || 0) + (v.inventoryQuantity || 0);
          } catch { /* the main report already covers this store */ }
        }
        r.data.stockBySku = found;
      }));
    },
    combine(rows) {
      const ok = rows.filter((r) => r.data);
      const sections = ok.map(({ store, data: d }) => {
        if (!d.low.length) return `store: ${store}\nNothing at or below ${d.threshold}.`;
        const elsewhere = (sku) => ok.filter((o) => o.store !== store && sku && (o.data.stockBySku?.[sku] ?? 0) > d.threshold)
          .map((o) => `${o.store} ${o.data.stockBySku[sku]}`).join(', ');
        const lines = d.low.slice(0, 40).map((v) => `| ${v.sku ?? ''} | ${v.product}${v.variant && v.variant !== 'Default Title' ? ` / ${v.variant}` : ''} | ${v.quantity} | ${elsewhere(v.sku) || ''} |`);
        return `store: ${store}\n| sku | product | on hand | in stock elsewhere |\n|---|---|---|---|\n${lines.join('\n')}${d.low.length > 40 ? `\n...and ${d.low.length - 40} more` : ''}${capped(d.low.length, d.complete, 'variants')}`;
      });
      return { text: sections.join('\n\n') };
    },
  },

  find_product: {
    title: 'Find a product in every store',
    description: 'Look a product up by SKU, handle or title words in every store, with its status, price, compare-at price and stock per variant. Use it to compare one product across stores.',
    async gather(gql, p) {
      const q = p.sku ? `sku:${quote(p.sku)}` : p.handle ? `handle:${quote(p.handle)}` : p.query ? String(p.query) : null;
      if (!q) throw new ReportError('Pass "sku", "handle" or "query".');
      const data = await gql(REPORT_QUERIES.find, { query: q });
      const products = (data.products?.nodes || []).map((pr) => ({
        title: pr.title, handle: pr.handle, status: pr.status, vendor: pr.vendor, totalInventory: pr.totalInventory,
        variants: (pr.variants?.nodes || []).filter((v) => !p.sku || v.sku === p.sku),
      }));
      return { query: q, products };
    },
    combine(rows) {
      const lines = [];
      for (const { store, data } of rows.filter((r) => r.data)) {
        if (!data.products.length) { lines.push(`| ${store} | not found | | | | |`); continue; }
        for (const pr of data.products) {
          for (const v of pr.variants.length ? pr.variants : [{}]) {
            lines.push(`| ${store} | ${pr.title}${v.title && v.title !== 'Default Title' ? ` / ${v.title}` : ''} | ${v.sku ?? ''} | ${pr.status} | ${v.price ?? ''}${v.compareAtPrice ? ` (was ${v.compareAtPrice})` : ''} | ${v.inventoryQuantity ?? pr.totalInventory ?? ''} |`);
          }
        }
      }
      return { text: `| store | product | sku | status | price | stock |\n|---|---|---|---|---|---|\n${lines.join('\n')}\n\nPrices are in each store's own currency.` };
    },
  },

  catalog_gaps: {
    title: 'Catalogue gaps between stores',
    description: 'Compares products by handle across stores: products missing from some stores, and products whose status (active, draft, archived) differs between stores.',
    async gather(gql, p) {
      const { nodes, complete } = await paginate(gql, REPORT_QUERIES.catalog, { query: p.query }, (d) => d.products, p.max_pages ?? 20);
      return { products: Object.fromEntries(nodes.map((n) => [n.handle, { title: n.title, status: n.status }])), complete };
    },
    combine(rows) {
      const ok = rows.filter((r) => r.data);
      if (ok.length < 2) return { text: 'Catalogue gaps need at least two stores that answered.' };
      const handles = new Set(ok.flatMap((r) => Object.keys(r.data.products)));
      const missing = [];
      const differ = [];
      for (const h of [...handles].sort()) {
        const has = ok.filter((r) => r.data.products[h]);
        if (has.length < ok.length) missing.push({ handle: h, title: has[0].data.products[h].title, in: has.map((r) => r.store), missingFrom: ok.filter((r) => !r.data.products[h]).map((r) => r.store) });
        else if (new Set(has.map((r) => r.data.products[h].status)).size > 1) differ.push({ handle: h, title: has[0].data.products[h].title, statuses: Object.fromEntries(has.map((r) => [r.store, r.data.products[h].status])) });
      }
      const partial = ok.filter((r) => !r.data.complete).map((r) => r.store);
      const text = [
        `${handles.size} distinct products across ${ok.length} stores. ${missing.length} missing from at least one store, ${differ.length} with a different status.`,
        missing.length ? `\n| product | handle | missing from |\n|---|---|---|\n${missing.slice(0, 50).map((m) => `| ${m.title} | ${m.handle} | ${m.missingFrom.join(', ')} |`).join('\n')}${missing.length > 50 ? `\n...and ${missing.length - 50} more` : ''}` : '',
        differ.length ? `\n| product | handle | status per store |\n|---|---|---|\n${differ.slice(0, 50).map((d) => `| ${d.title} | ${d.handle} | ${Object.entries(d.statuses).map(([s, st]) => `${s}: ${st}`).join(', ')} |`).join('\n')}` : '',
        partial.length ? `\nOnly part of the catalogue was read for ${partial.join(', ')}; raise max_pages for a full comparison.` : '',
      ].filter(Boolean).join('\n');
      return { text, summary: { missing, differ } };
    },
  },

  catalog_health: {
    title: 'Catalogue health',
    description: 'Active products with gaps that hurt sales or search: no image, image without alt text, empty description, no SEO description, no product type, or a zero price.',
    async gather(gql, p) {
      const { nodes, complete } = await paginate(gql, REPORT_QUERIES.health, { query: p.query ?? 'status:active' }, (d) => d.products, p.max_pages ?? 10);
      const checks = {
        no_image: (n) => !n.featuredMedia,
        image_without_alt: (n) => n.featuredMedia && !n.featuredMedia.alt,
        empty_description: (n) => !String(n.description || '').trim(),
        no_seo_description: (n) => !n.seo?.description,
        no_product_type: (n) => !n.productType,
        zero_price: (n) => Number(n.priceRangeV2?.minVariantPrice?.amount) === 0,
      };
      const issues = Object.fromEntries(Object.keys(checks).map((k) => [k, []]));
      for (const n of nodes) for (const [k, fn] of Object.entries(checks)) if (fn(n)) issues[k].push(`${n.title} (${n.handle})`);
      return { scanned: nodes.length, issues, complete };
    },
    combine(rows) {
      const ok = rows.filter((r) => r.data);
      const keys = ['no_image', 'image_without_alt', 'empty_description', 'no_seo_description', 'no_product_type', 'zero_price'];
      const lines = ok.map(({ store, data: d }) => `| ${store} | ${d.scanned}${d.complete ? '' : '+'} | ${keys.map((k) => d.issues[k].length).join(' | ')} |`);
      const examples = ok.flatMap(({ store, data: d }) => keys.filter((k) => d.issues[k].length).map((k) => `${store} ${k.replace(/_/g, ' ')}: ${d.issues[k].slice(0, 5).join(', ')}${d.issues[k].length > 5 ? ', ...' : ''}`));
      return { text: `| store | products checked | no image | image without alt | empty description | no SEO description | no product type | zero price |\n|---|---|---|---|---|---|---|---|\n${lines.join('\n')}${examples.length ? `\n\nProducts (handle in brackets):\n${examples.join('\n')}` : ''}` };
    },
  },

  duplicate_skus: {
    title: 'Duplicate and conflicting SKUs',
    description: 'SKUs used by more than one variant inside a store, and SKUs that point at different products in different stores.',
    async gather(gql, p) {
      const { nodes, complete } = await paginate(gql, REPORT_QUERIES.variants, { query: p.query ?? null }, (d) => d.productVariants, p.max_pages ?? 20);
      const bySku = {};
      for (const v of nodes) if (v.sku) (bySku[v.sku] ||= []).push(v.product?.handle);
      return { bySku, scanned: nodes.length, complete };
    },
    combine(rows) {
      const ok = rows.filter((r) => r.data);
      const inside = ok.flatMap(({ store, data }) => Object.entries(data.bySku).filter(([, hs]) => hs.length > 1).map(([sku, hs]) => ({ store, sku, products: hs })));
      const skus = new Set(ok.flatMap((r) => Object.keys(r.data.bySku)));
      const across = [];
      for (const sku of skus) {
        const where = ok.filter((r) => r.data.bySku[sku]).map((r) => ({ store: r.store, handle: r.data.bySku[sku][0] }));
        if (where.length > 1 && new Set(where.map((w) => w.handle)).size > 1) across.push({ sku, where });
      }
      const text = [
        `${skus.size} distinct SKUs. ${inside.length} repeated inside a store, ${across.length} pointing at different products in different stores.`,
        inside.length ? `\n| store | sku | products |\n|---|---|---|\n${inside.slice(0, 50).map((d) => `| ${d.store} | ${d.sku} | ${d.products.join(', ')} |`).join('\n')}` : '',
        across.length ? `\n| sku | product per store |\n|---|---|\n${across.slice(0, 50).map((a) => `| ${a.sku} | ${a.where.map((w) => `${w.store}: ${w.handle}`).join(', ')} |`).join('\n')}` : '',
      ].filter(Boolean).join('\n');
      return { text, summary: { inside, across } };
    },
  },

  recent_changes: {
    title: 'Recently changed products',
    description: 'Products updated in the period (default the last 7 days), newest first, per store.',
    async gather(gql, p) {
      const per = period(p);
      const { nodes, complete } = await paginate(gql, REPORT_QUERIES.changes, { query: range(per, 'updated_at') }, (d) => d.products, p.max_pages ?? 3);
      return { period: per.label, products: nodes, complete };
    },
    combine(rows) {
      const sections = rows.filter((r) => r.data).map(({ store, data: d }) =>
        `store: ${store} (${d.products.length}${d.complete ? '' : '+'} changed ${d.period})\n${d.products.slice(0, 20).map((pr) => `- ${pr.updatedAt.slice(0, 16).replace('T', ' ')} ${pr.title} (${pr.handle}, ${pr.status})`).join('\n') || '- none'}`);
      return { text: sections.join('\n\n') };
    },
  },
};

export const REPORT_NAMES = Object.keys(REPORTS);

// Runs `gather` on every store at once (the CLI layer caps how many run together), then combines.
export async function runReport(name, stores, params, gqlFor) {
  const report = REPORTS[name];
  if (!report) throw new ReportError(`Unknown report "${name}". Reports: ${REPORT_NAMES.join(', ')}.`);
  const rows = await Promise.all(stores.map(async (s) => {
    try {
      return { store: s.name, domain: s.domain, data: await report.gather(gqlFor(s.name), params, s) };
    } catch (err) {
      return { store: s.name, domain: s.domain, error: err.message };
    }
  }));
  if (report.crossCheck) await report.crossCheck(rows, gqlFor);
  const { text, summary } = report.combine(rows, params);
  const failed = rows.filter((r) => r.error).map((r) => `store: ${r.store} (${r.domain}) did not answer: ${r.error}`);
  const header = `${report.title}: ${rows.filter((r) => r.data).length} of ${rows.length} stores answered.`;
  return {
    text: [header, text, ...failed].filter(Boolean).join('\n\n'),
    structured: { report: name, stores: rows, ...(summary ? { summary } : {}) },
  };
}
