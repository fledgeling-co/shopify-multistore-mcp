// Turns the newest results files into evals/results/SUMMARY.md, the table the README quotes.
//   node evals/summary.mjs

import fs from 'node:fs';
import path from 'node:path';
import { HERE, median } from './lib.mjs';

const dir = path.join(HERE, 'results');
const newest = (prefix) => fs.readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith('.json') && !/-run\d/.test(f)).sort().pop();
const agent = JSON.parse(fs.readFileSync(path.join(dir, newest('agent-')), 'utf8'));
const bench = JSON.parse(fs.readFileSync(path.join(dir, newest('bench-')), 'utf8'));
const A = agent.summary.shopherd;
const B = agent.summary['shopify-multi-store'];
const pct = (x) => `${Math.round((x.passed / x.runs) * 100)}%`;
const k = (n) => `${Math.round(n / 1000)}k`; // thousands
const ms = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)} s` : `${Math.round(n)} ms`);
const mb = (n) => `${(n / 1e6).toFixed(0)} MB`;
const sp = bench.speed;
const costs = Object.fromEntries(['shopherd', 'shopify-multi-store'].map((arm) => [arm, median(agent.results.filter((r) => r.arm === arm).map((r) => r.costUsd))]));
const cents = (usd) => `${(usd * 100).toFixed(1)}¢`;
// Both cells of a row, the lower one in bold.
const lower = (a, b, f) => (a < b ? `**${f(a)}** | ${f(b)}` : a > b ? `${f(a)} | **${f(b)}**` : `${f(a)} | ${f(b)}`);

const lines = [
  `# Eval summary`,
  '',
  `Agent eval ${agent.date.slice(0, 10)}: ${agent.tasks.length} questions x ${agent.repeats} runs per server, model ${agent.model}. Benchmarks ${bench.date.slice(0, 10)}, median of ${bench.runs} runs.`,
  '',
  '| Measure | Shopherd 0.3.0 | Shopify Multi-Store MCP 2.0.3 |',
  '|---|---|---|',
  `| Questions answered correctly | **${A.passed} of ${A.runs} (${pct(A)})** | ${B.passed} of ${B.runs} (${pct(B)}) |`,
  `| Tool calls per question (median) | **${A.medianToolCalls}** | ${B.medianToolCalls} |`,
  `| Time per question, end to end (median) | ${lower(A.medianSeconds, B.medianSeconds, (x) => `${x.toFixed(1)} s`)} |`,
  `| Model cost per question (median) | ${lower(costs.shopherd, costs['shopify-multi-store'], cents)} |`,
  `| Tools in the list sent with every message | ${bench.toolList.shopherd.tools} (~${k(bench.toolList.shopherd.approxTokens)} tokens) | ${bench.toolList['shopify-multi-store'].tools} (~${k(bench.toolList['shopify-multi-store'].approxTokens)} tokens) |`,
  `| One store's details, one call | ${ms(sp['1 store, shop details'].shopherd.medianMs)} | **${ms(sp['1 store, shop details']['shopify-multi-store'].medianMs)}** |`,
  `| Unfulfilled orders across 3 stores | ${ms(sp['3 stores'].shopherd.medianMs)} | **${ms(sp['3 stores']['shopify-multi-store'].medianMs)}** |`,
  `| Unfulfilled orders across 8 stores | ${ms(sp['8 stores'].shopherd.medianMs)} | **${ms(sp['8 stores']['shopify-multi-store'].medianMs)}** |`,
  `| Installed size | ${mb(bench.install.shopherd.installedBytes)}, plus ${mb(bench.install.shopherd.firstRunDownloadBytes)} of Shopify's CLI and Dev MCP on first start | **${mb(bench.install['shopify-multi-store'].installedBytes)}** |`,
  '',
  `Shopherd 0.2 asked stores one at a time: ${ms(sp['3 stores']['shopherd, one store at a time (0.2 behaviour)'].medianMs)} for 3 stores and ${ms(sp['8 stores']['shopherd, one store at a time (0.2 behaviour)'].medianMs)} for 8.`,
  '',
  '## Per question',
  '',
  '| Question | Shopherd | Shopify Multi-Store MCP |',
  '|---|---|---|',
  ...agent.tasks.map((t) => `| ${t.prompt} | ${A.byTask[t.id]} | ${B.byTask[t.id]} |`),
  '',
  `Mock: ${agent.mock.requests} Admin API requests, ${agent.mock.errors} rejected by the schema, fields answered with an empty default: ${agent.mock.defaultedFields.length ? agent.mock.defaultedFields.join(', ') : 'none'}.`,
];
fs.writeFileSync(path.join(dir, 'SUMMARY.md'), `${lines.join('\n')}\n`);
console.log(lines.join('\n'));
