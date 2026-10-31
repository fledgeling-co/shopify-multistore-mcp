#!/usr/bin/env node
// Stands in for `shopify` (Shopify CLI) in the evals: `store execute` sends the query to the local
// mock Admin API, `store auth list` lists the mock's stores, `--version` prints a version. It waits
// FAKE_CLI_STARTUP_MS first (default 470), the start-up time measured for Shopify CLI 5.0.0 on the
// machine these evals were written on, so per-call overhead stays realistic.

const startup = Number(process.env.FAKE_CLI_STARTUP_MS ?? 470);
const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(`--${n}`); return i === -1 ? undefined : args[i + 1]; };
const tokens = JSON.parse(process.env.MOCK_SHOPIFY_TOKENS || '{}');

await new Promise((r) => setTimeout(r, startup));
if (args[0] === '--version') { console.log('5.0.0'); process.exit(0); }
if (args[0] === 'store' && args[1] === 'auth' && args[2] === 'list') {
  console.log(JSON.stringify({ sessions: Object.keys(tokens).map((store) => ({ store, scopes: ['write_products', 'write_orders'] })) }));
  process.exit(0);
}
if (args[0] === 'store' && args[1] === 'execute') {
  const store = flag('store');
  const query = flag('query');
  if (!tokens[store]) { console.log(JSON.stringify({ error: { type: 'abort', message: `No stored app authentication found for ${store}.` } })); process.exit(1); }
  if (/^\s*mutation\b/.test(query) && !args.includes('--allow-mutations')) { console.log(JSON.stringify({ error: { message: 'Mutations are disabled. Pass --allow-mutations.' } })); process.exit(1); }
  const res = await fetch(`${process.env.MOCK_SHOPIFY_URL}/admin/api/${flag('version') || '2026-10'}/graphql.json`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-shopify-access-token': tokens[store] },
    body: JSON.stringify({ query, variables: flag('variables') ? JSON.parse(flag('variables')) : undefined }),
  });
  console.log(JSON.stringify(await res.json()));
  process.exit(0);
}
console.error(`fake shopify: unsupported ${args.join(' ')}`);
process.exit(2);
