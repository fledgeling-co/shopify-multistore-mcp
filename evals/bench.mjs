// Benchmarks without a model: how much context each server's tool list costs, how long a
// cross-store question takes at 3 and 8 stores, and what each one installs.
//
//   node evals/bench.mjs [--runs 5]

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { COMPETITOR_IMAGE, HERE, REPO, connect, median, serverSpecs, startWorld, text } from './lib.mjs';

const RUNS = Number(process.argv[process.argv.indexOf('--runs') + 1] || 5) || 5;
const out = { date: new Date().toISOString(), runs: RUNS, note: 'shopify-multistore-mcp calls go through a stand-in for Shopify CLI that waits 470 ms per call, the start-up time measured for Shopify CLI 5.0.0; neither server pays network latency to Shopify here.' };

async function timed(client, name, args) {
  const ms = [];
  let last;
  for (let i = 0; i < RUNS + 1; i++) {
    const t = Date.now();
    last = await client.callTool({ name, arguments: args });
    if (i) ms.push(Date.now() - t); // first call warms up
  }
  return { medianMs: median(ms), isError: Boolean(last.isError), sample: text(last).slice(0, 200) };
}

// 1. Tool list size, as each server serves it once warm.
{
  const world = await startWorld();
  const specs = serverSpecs(world);
  out.toolList = {};
  for (const [arm, spec] of Object.entries({ shopherd: specs.shopherd, 'shopify-multi-store': specs.competitor })) {
    const c = await connect(spec);
    let tools = (await c.listTools()).tools;
    for (let i = 0; arm === 'shopherd' && i < 60 && tools.length < 10; i++) { await new Promise((r) => setTimeout(r, 1000)); tools = (await c.listTools()).tools; }
    const chars = JSON.stringify(tools).length;
    out.toolList[arm] = { tools: tools.length, characters: chars, approxTokens: Math.round(chars / 4), names: tools.map((t) => t.name) };
    await c.close();
  }
  await world.mock.close();
}

// 2. Cross-store questions at 3 and 8 stores, and one single-store read.
out.speed = {};
for (const count of [3, 8]) {
  const names = ['harbour', 'tidewater', 'northpaper', ...Array.from({ length: count - 3 }, (_, i) => `store${i + 1}`)];
  const world = await startWorld({ bench: count - 3, names });
  const stores = names;
  const arms = {
    shopherd: [serverSpecs({ ...world }).shopherd, 'store_report', { report: 'unfulfilled' }],
    'shopherd, one store at a time (0.2 behaviour)': [serverSpecs({ ...world, concurrency: 1 }).shopherd, 'store_report', { report: 'unfulfilled' }],
    'shopify-multi-store': [serverSpecs({ ...world }).competitor, 'shopify_report', { report: 'list_unfulfilled_orders', stores, days: 365 }],
  };
  for (const [arm, [spec, tool, args]] of Object.entries(arms)) {
    const c = await connect(spec);
    if (arm.startsWith('shopherd')) await c.listTools();
    (out.speed[`${count} stores`] ||= {})[arm] = await timed(c, tool, args);
    if (count === 3 && !arm.includes('0.2')) {
      const single = arm === 'shopherd' ? ['get_shop', { store: 'northpaper' }] : ['shopify_get_shop_info', { store: 'northpaper' }];
      (out.speed['1 store, shop details'] ||= {})[arm] = await timed(c, ...single);
    }
    await c.close();
  }
  await world.mock.close();
}

// 3. What each one installs.
{
  const pack = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json'], { cwd: REPO, encoding: 'utf8' }))[0];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shopherd-install-'));
  const tgz = execFileSync('npm', ['pack', '--pack-destination', tmp], { cwd: REPO, encoding: 'utf8' }).trim().split('\n').pop();
  execFileSync('npm', ['init', '-y'], { cwd: tmp, stdio: 'ignore' });
  execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', path.join(tmp, tgz)], { cwd: tmp, stdio: 'ignore' });
  const du = (p) => Number(execFileSync('du', ['-sk', p], { encoding: 'utf8' }).split('\t')[0]) * 1024;
  const pkgs = (dir) => execFileSync('npm', ['ls', '--all', '--parseable'], { cwd: dir, encoding: 'utf8' }).trim().split('\n').length - 1;
  const cache = ['shopherd', 'storerow'].map((n) => path.join(os.homedir(), '.cache', n, 'packages')).find((p) => fs.existsSync(p));
  out.install = {
    shopherd: { packageBytes: pack.size, unpackedBytes: pack.unpackedSize, installedBytes: du(path.join(tmp, 'node_modules')), installedPackages: pkgs(tmp), firstRunDownloadBytes: cache ? du(cache) : null, firstRunDownload: 'Shopify CLI and Shopify Dev MCP, fetched and checked on first start' },
    'shopify-multi-store': {
      installedBytes: Number(execFileSync('docker', ['run', '--rm', '--entrypoint', 'sh', COMPETITOR_IMAGE, '-c', 'du -sk /usr/local/lib/node_modules/shopify-multi-store-mcp-server'], { encoding: 'utf8' }).split('\t')[0]) * 1024,
      installedPackages: Number(execFileSync('docker', ['run', '--rm', '--entrypoint', 'sh', COMPETITOR_IMAGE, '-c', 'cd /usr/local/lib/node_modules/shopify-multi-store-mcp-server && npm ls --all --parseable 2>/dev/null | wc -l'], { encoding: 'utf8' }).trim()) - 1,
    },
  };
  fs.rmSync(tmp, { recursive: true, force: true });
}

fs.mkdirSync(path.join(HERE, 'results'), { recursive: true });
const file = path.join(HERE, 'results', `bench-${out.date.slice(0, 10)}.json`);
fs.writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify({ toolList: Object.fromEntries(Object.entries(out.toolList).map(([k, v]) => [k, { tools: v.tools, approxTokens: v.approxTokens }])), speed: out.speed, install: out.install }, (k, v) => (k === 'sample' ? undefined : v), 2));
console.log(`written ${file}`);
