// MCP prompts: ready-made questions that AI apps show as slash commands or in their prompt menu,
// so a non-technical user can start from a list instead of a blank box.

import { ToolError } from './tools.js';

export const PROMPTS = [
  {
    name: 'morning-check',
    title: 'Morning check across every store',
    description: 'Overview, unfulfilled orders by age and low stock for every connected store.',
    arguments: [],
    build: () => 'Give me a morning check across every connected store: run store_report with overview (days 1), then unfulfilled, then low_stock. Summarise what needs attention first, store by store, and keep each store\'s numbers labelled with its name.',
  },
  {
    name: 'sales',
    title: 'Sales by store',
    description: 'Orders, sales and average order value per store for a period.',
    arguments: [{ name: 'period', description: 'For example "yesterday", "last 7 days" or "October 2026". Defaults to the last 7 days.', required: false }],
    build: ({ period }) => `Show sales by store for ${period || 'the last 7 days'} using store_report with report "sales" (work out days, or since and until, from the period). Keep currencies separate and point out the biggest changes.`,
  },
  {
    name: 'unfulfilled-orders',
    title: 'Unfulfilled orders',
    description: 'Open orders waiting to ship, grouped by age, in every store.',
    arguments: [],
    build: () => 'Which orders are still waiting to be fulfilled in each store? Use store_report with report "unfulfilled" and call out anything older than two days.',
  },
  {
    name: 'low-stock',
    title: 'Low stock',
    description: 'Variants at or below a stock threshold, with stock available in the other stores.',
    arguments: [{ name: 'threshold', description: 'Report variants at or below this quantity. Defaults to 5.', required: false }],
    build: ({ threshold }) => `What is running low? Use store_report with report "low_stock"${threshold ? ` and threshold ${Number(threshold) || 5}` : ''}, and say where another store has stock that could be moved.`,
  },
  {
    name: 'compare-product',
    title: 'Compare a product across stores',
    description: 'Price, status and stock of one product in every store.',
    arguments: [{ name: 'product', description: 'A SKU, handle or product name.', required: true }],
    build: ({ product }) => {
      if (!product) throw new ToolError('"product" is required: a SKU, handle or product name.');
      return `Compare "${product}" across every store with store_report report "find_product" (pass it as sku if it looks like a SKU, as handle if it looks like a handle, otherwise as query). Show price, compare-at price, status and stock side by side, and flag differences.`;
    },
  },
  {
    name: 'catalogue-check',
    title: 'Catalogue check',
    description: 'Products missing from some stores, status mismatches, and listings with no image, alt text or description.',
    arguments: [],
    build: () => 'Check the catalogue across my stores: run store_report with catalog_gaps, then catalog_health. List the gaps and the fixes worth doing first, store by store.',
  },
  {
    name: 'connect-store',
    title: 'Connect a store',
    description: 'Sign in to a Shopify store through Shopify\'s own approval page.',
    arguments: [
      { name: 'domain', description: 'The store\'s myshopify.com address, for example acme.myshopify.com.', required: true },
      { name: 'name', description: 'A short name to call it by, for example "acme". Defaults to the first part of the address.', required: false },
      { name: 'read_only', description: '"yes" to refuse all changes to this store.', required: false },
    ],
    build: ({ domain, name, read_only: ro }) => {
      if (!domain) throw new ToolError('"domain" is required, for example acme.myshopify.com.');
      const short = name || String(domain).replace(/^https?:\/\//, '').split('.')[0];
      return `Connect ${domain} as "${short}"${/^(y|yes|true)$/i.test(String(ro || '')) ? ', read-only' : ''} with connect_store, then tell me to approve it in the browser window that opens.`;
    },
  },
];

export function promptMessages(name, args) {
  const prompt = PROMPTS.find((p) => p.name === name);
  if (!prompt) throw new ToolError(`Unknown prompt "${name}". Prompts: ${PROMPTS.map((p) => p.name).join(', ')}.`);
  return {
    description: prompt.description,
    messages: [{ role: 'user', content: { type: 'text', text: prompt.build(args) } }],
  };
}
