import { DEFAULT_SCOPES, normalizeDomain, normalizeName, readOnlyScopes } from './config.js';
import { REPORTS, REPORT_NAMES } from './reports.js';

// Curated reads use fields checked against the Admin API 2026-10 schema bundled in
// @shopify/dev-mcp 1.18.0; `shopify-multistore-mcp doctor` re-checks them against the schema in
// whatever Dev MCP release is newest.
export const CURATED_QUERIES = {
  get_shop: `query Shop {
  shop {
    name
    myshopifyDomain
    primaryDomain { url }
    email
    currencyCode
    ianaTimezone
    plan { publicDisplayName partnerDevelopment shopifyPlus }
  }
}`,
  search_products: `query SearchProducts($query: String, $first: Int!, $after: String) {
  products(first: $first, after: $after, query: $query) {
    nodes {
      id title handle status vendor productType tags totalInventory updatedAt
      priceRangeV2 { minVariantPrice { amount currencyCode } maxVariantPrice { amount currencyCode } }
    }
    pageInfo { hasNextPage endCursor }
  }
}`,
  list_orders: `query ListOrders($query: String, $first: Int!, $after: String) {
  orders(first: $first, after: $after, query: $query, sortKey: PROCESSED_AT, reverse: true) {
    nodes {
      id name createdAt processedAt cancelledAt test
      displayFinancialStatus displayFulfillmentStatus
      currentTotalPriceSet { shopMoney { amount currencyCode } }
      customer { id }
    }
    pageInfo { hasNextPage endCursor }
  }
}`,
};

export class ToolError extends Error {}

const page = {
  first: { type: 'integer', minimum: 1, maximum: 100, default: 20, description: 'How many results to return (1-100).' },
  after: { type: 'string', description: 'Pass pageInfo.endCursor from the previous result to get the next page.' },
};

function storeProperty(stores, { allowAll = false } = {}) {
  const names = Object.keys(stores);
  const listed = names.map((n) => `"${n}" (${stores[n].domain}${stores[n].label ? `, ${stores[n].label}` : ''}${stores[n].readOnly ? ', read-only' : ''})`).join('; ');
  const prop = {
    type: 'string',
    description: names.length
      ? `Which store to run this on. One of: ${listed}.${names.length === 1 ? ' Optional while only one store is connected.' : ''}`
      : 'No stores are connected yet. Call connect_store first.',
  };
  if (names.length) prop.enum = allowAll ? [...names, 'all'] : names;
  return prop;
}

function withStore(stores, properties, required = []) {
  const multi = Object.keys(stores).length !== 1;
  return {
    type: 'object',
    properties: { store: storeProperty(stores), ...properties },
    required: multi ? ['store', ...required] : required,
    additionalProperties: false,
  };
}

// `validator` is the name of the Dev MCP validation tool currently being served, so the
// descriptions follow Dev MCP when it renames its tools.
export function buildTools(stores, { validator = 'validate' } = {}) {
  return [
    {
      name: 'list_stores',
      title: 'List connected Shopify stores',
      description: 'List every store this server can work on: its name (the value to pass as "store"), myshopify.com domain, label, read-only flag, sign-in status, granted scopes and token expiry, plus the Shopify CLI and Dev MCP versions in use. Call this first when you are unsure which stores exist or why a call failed.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    {
      name: 'connect_store',
      title: 'Connect a Shopify store',
      description: 'Add a store, or sign in to one again when its session expired. Opens Shopify\'s own sign-in page in the user\'s browser (Shopify CLI "store auth"); the user must approve there, so tell them to look for the browser window. Returns within about 20 seconds; if approval is still pending, call it again with the same name to wait for the result.',
      inputSchema: {
        type: 'object',
        properties: {
          store: { type: 'string', description: 'Short name to refer to the store by, for example "au-retail". Reuse an existing name to sign in again.' },
          domain: { type: 'string', description: 'The store\'s permanent myshopify.com domain, for example "acme.myshopify.com". Required for a new store.' },
          label: { type: 'string', description: 'Optional human description, for example "Wholesale (NZ)".' },
          read_only: { type: 'boolean', description: 'Request read-only access and refuse mutations for this store.' },
          scopes: { type: 'array', items: { type: 'string' }, description: `Admin API scopes to request. Defaults to: ${DEFAULT_SCOPES.join(', ')}.` },
        },
        required: ['store'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    {
      name: 'get_shop',
      title: 'Get store details',
      description: 'Name, domains, contact email, currency, timezone and plan of one store.',
      inputSchema: withStore(stores, {}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    {
      name: 'search_products',
      title: 'Search products',
      description: 'Search or list products in one store. Returns id, title, handle, status, vendor, type, tags, total inventory and price range. "query" uses Shopify search syntax, for example `status:active vendor:Nike`, `tag:sale`, `title:hood*`, `sku:ABC-123`, `inventory_total:<5`. Shopify ignores unknown filter fields and returns everything, so use documented fields only. Product ids are only valid in the store they came from.',
      inputSchema: withStore(stores, { query: { type: 'string', description: 'Shopify product search query. Omit to list recent products.' }, ...page }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    {
      name: 'list_orders',
      title: 'List orders',
      description: 'List orders in one store, newest first. "query" uses Shopify order search syntax, for example `financial_status:paid`, `fulfillment_status:unfulfilled`, `created_at:>=2026-10-01`, `name:#1001`. Without the read_all_orders scope Shopify only returns the last 60 days. For customer names, line items or addresses use graphql_query.',
      inputSchema: withStore(stores, { query: { type: 'string', description: 'Shopify order search query.' }, ...page }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    {
      name: 'graphql_query',
      title: 'Run an Admin GraphQL query',
      description: `Run a read-only Shopify Admin GraphQL query on one store; mutations are refused here. Use it for anything the curated tools do not cover. Before writing an unfamiliar query, look the fields up with learn_shopify_api (api "admin") and check it with ${validator} (api "admin"). Select pageInfo { hasNextPage endCursor } on connections. Uses the latest stable Admin API version unless api_version is set.`,
      inputSchema: withStore(stores, {
        query: { type: 'string', description: 'GraphQL query document.' },
        variables: { type: 'object', description: 'GraphQL variables.', additionalProperties: true },
        api_version: { type: 'string', description: 'Admin API version such as "2026-10". Omit for the latest stable version.' },
      }, ['query']),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    {
      name: 'graphql_mutation',
      title: 'Run an Admin GraphQL mutation',
      description: `Run a Shopify Admin GraphQL mutation that changes data in one store. Confirm the target store and the change with the user before calling. Validate the document with ${validator} (api "admin") first, look ids up in the same store (ids from another store will not resolve), and check the userErrors field of the result. Refused for read-only stores.`,
      inputSchema: withStore(stores, {
        query: { type: 'string', description: 'GraphQL mutation document. Select userErrors { field message }.' },
        variables: { type: 'object', description: 'GraphQL variables.', additionalProperties: true },
        api_version: { type: 'string', description: 'Admin API version such as "2026-10". Omit for the latest stable version.' },
      }, ['query']),
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    {
      name: 'graphql_query_all_stores',
      title: 'Run one query on every store',
      description: 'Run the same read-only Admin GraphQL query on several stores at once and get the results side by side, each labelled with its store. For common comparisons (sales, unfulfilled orders, low stock, catalogue gaps) store_report is quicker and already combines the answers.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'GraphQL query document.' },
          variables: { type: 'object', description: 'GraphQL variables, applied to every store.', additionalProperties: true },
          stores: { type: 'array', items: storeProperty(stores), description: 'Stores to include. Omit for every connected store.' },
          api_version: { type: 'string', description: 'Admin API version such as "2026-10". Omit for the latest stable version.' },
        },
        required: ['query'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    {
      name: 'store_report',
      title: 'Run a ready-made report across stores',
      description: `Ask every store (or the ones listed) at once and get one combined, store-labelled answer. Reports:\n${REPORT_NAMES.map((n) => `- ${n}: ${REPORTS[n].description}`).join('\n')}\nPeriods default to the last 7 days; a bare date is read in each store's own time zone. Large stores are read up to max_pages pages and the result says when it stopped early.`,
      inputSchema: {
        type: 'object',
        properties: {
          report: { type: 'string', enum: REPORT_NAMES, description: 'Which report to run.' },
          stores: { type: 'array', items: storeProperty(stores, { allowAll: true }), description: 'Stores to include. Omit for every connected store.' },
          days: { type: 'integer', minimum: 0, maximum: 366, description: 'overview, sales, recent_changes: how many days back (default 7; 1 means since yesterday).' },
          since: { type: 'string', description: 'sales, overview, recent_changes: start date, for example 2026-10-01. Overrides days.' },
          until: { type: 'string', description: 'sales, overview, recent_changes: end date (exclusive), for example 2026-10-31.' },
          threshold: { type: 'integer', minimum: 0, description: 'low_stock: report variants at or below this quantity (default 5).' },
          sku: { type: 'string', description: 'find_product: exact SKU.' },
          handle: { type: 'string', description: 'find_product: product handle.' },
          query: { type: 'string', description: 'find_product: title words or Shopify search syntax. catalog_gaps, catalog_health, duplicate_skus: optional filter such as "vendor:Acme".' },
          limit: { type: 'integer', minimum: 1, maximum: 50, description: 'unfulfilled: how many of the oldest orders to list per store (default 5).' },
          max_pages: { type: 'integer', minimum: 1, maximum: 50, description: 'Upper bound on pages read per store (each page is 100-250 records). Defaults differ per report.' },
        },
        required: ['report'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
  ];
}

export const OWN_TOOL_NAMES = new Set(buildTools({}).map((t) => t.name));

export function resolveStore(stores, value) {
  const names = Object.keys(stores);
  if (!names.length) throw new ToolError('No stores are connected yet. Call connect_store with a short name and the store\'s myshopify.com domain.');
  if (value === undefined || value === null || value === '') {
    if (names.length === 1) return stores[names[0]];
    throw new ToolError(`Pass "store" to say which store to use. Connected stores: ${names.map((n) => `${n} (${stores[n].domain})`).join(', ')}.`);
  }
  const v = String(value).trim().toLowerCase();
  const hit = stores[v] || Object.values(stores).find((s) => s.domain === v || s.domain === `${v}.myshopify.com` || s.domain.split('.')[0] === v);
  if (!hit) throw new ToolError(`Unknown store "${value}". Connected stores: ${names.map((n) => `${n} (${stores[n].domain})`).join(', ')}. Call connect_store to add another.`);
  return hit;
}

// Mutations that mint credentials or charge the store are refused outright: an AI assistant has no
// business creating access tokens or app charges, and neither can be undone from the chat.
export const BLOCKED_MUTATIONS = [
  'delegateAccessTokenCreate', 'storefrontAccessTokenCreate',
  'appSubscriptionCreate', 'appSubscriptionTrialExtend', 'appPurchaseOneTimeCreate', 'appUsageRecordCreate',
  'appRevokeAccessScopes',
];

export function assertAllowedMutation(query) {
  const hit = BLOCKED_MUTATIONS.find((m) => new RegExp(`\\b${m}\\b`).test(String(query)));
  if (hit) throw new ToolError(`${hit} is blocked: it creates credentials, charges the store or changes app access. Do it in Shopify admin instead.`);
}

// Picks stores from a list of names, or every store when the list is empty or contains "all".
export function resolveStores(stores, list) {
  const picked = Array.isArray(list) && list.length && !list.includes('all')
    ? [...new Map(list.map((s) => resolveStore(stores, s)).map((s) => [s.name, s])).values()]
    : Object.values(stores);
  if (!picked.length) throw new ToolError('No stores are connected yet. Call connect_store first.');
  return picked;
}

export function assertNotMutation(query) {
  const body = String(query).replace(/#[^\n]*/g, '').replace(/"""[\s\S]*?"""|"(?:\\.|[^"\\])*"/g, '""');
  if (/(^|[\s{}])mutation\b/.test(body)) throw new ToolError('This tool only runs queries. Use graphql_mutation for changes.');
}

export function connectArgs(args, existing) {
  const name = normalizeName(args.store);
  const domain = args.domain ? normalizeDomain(args.domain) : existing?.domain;
  if (!domain) throw new ToolError(`"${name}" is a new store, so "domain" is required, for example acme.myshopify.com.`);
  const readOnly = args.read_only ?? existing?.readOnly ?? false;
  const base = args.scopes?.length ? args.scopes : existing?.scopes?.length ? existing.scopes : DEFAULT_SCOPES;
  return { name, domain, label: args.label ?? existing?.label, readOnly, scopes: readOnly ? readOnlyScopes(base) : base };
}

export function textResult(text, structured) {
  if (text.length > TEXT_LIMIT) {
    text = `${text.slice(0, TEXT_LIMIT)}\n\n[Cut at ${TEXT_LIMIT.toLocaleString('en')} of ${text.length.toLocaleString('en')} characters. Ask for fewer fields or records, or page with pageInfo.endCursor.]`;
    structured = undefined;
  }
  const result = { content: [{ type: 'text', text }] };
  if (structured !== undefined) result.structuredContent = structured;
  return result;
}

export function errorResult(text) {
  return { content: [{ type: 'text', text }], isError: true };
}

// Results go to the model as compact JSON, cut at TEXT_LIMIT characters so one large query cannot
// fill the conversation; the cut is stated so the assistant narrows the query or pages on.
export const TEXT_LIMIT = 60_000;

export function storeResult(store, payload) {
  const header = `store: ${store.name} (${store.domain})`;
  return textResult(`${header}\n${JSON.stringify(payload)}`, { store: store.name, domain: store.domain, ...payload });
}
