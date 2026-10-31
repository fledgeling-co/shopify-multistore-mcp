// Agent eval: the same AI assistant answers the same multi-store questions through each server,
// against the same mock stores, and every answer is graded by tasks.mjs.
//
//   node evals/agent.mjs [--model claude-sonnet-5-5] [--repeats 2] [--parallel 4] [--only shopherd]
//
// Each run is `claude -p` with no built-in tools, no settings, hooks or CLAUDE.md, and only the
// server under test, so the server is the only thing that differs between the two arms.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { HERE, median, serverSpecs, startWorld } from './lib.mjs';
import { buildTasks } from './tasks.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : process.argv[i + 1]; };
const MODEL = arg('model', 'claude-sonnet-5-5');
const REPEATS = Number(arg('repeats', 2));
const PARALLEL = Number(arg('parallel', 4));
const ONLY = arg('only', null);

function runClaude({ prompt, mcpFile, cwd }) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn('claude', [
      '-p', `${prompt}\n\nUse the shop tools to answer. Name the store next to every figure.`,
      '--model', MODEL, '--mcp-config', mcpFile, '--strict-mcp-config', '--tools', '', '--allowedTools', 'mcp__shop',
      '--setting-sources', '', '--output-format', 'stream-json', '--verbose', '--max-turns', '30', '--no-session-persistence',
    ], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let buf = '';
    const toolCalls = [];
    let result = null;
    child.stdout.on('data', (d) => {
      buf += d;
      let nl;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
        try {
          const ev = JSON.parse(line);
          if (ev.type === 'assistant') for (const c of ev.message?.content || []) if (c.type === 'tool_use') toolCalls.push(c.name.replace(/^mcp__shop__/, ''));
          if (ev.type === 'result') result = ev;
        } catch { /* partial line */ }
      }
    });
    const timer = setTimeout(() => child.kill('SIGTERM'), 600_000);
    child.on('close', () => {
      clearTimeout(timer);
      const u = result?.usage || {};
      resolve({
        answer: result?.result ?? '', error: result?.is_error || !result, wallMs: Date.now() - started, durationMs: result?.duration_ms,
        turns: result?.num_turns, toolCalls,
        inputTokens: (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0), outputTokens: u.output_tokens || 0,
        costUsd: result?.total_cost_usd,
      });
    });
  });
}

async function pool(jobs, n) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < jobs.length) { const j = i++; out[j] = await jobs[j](); } }));
  return out;
}

const world = await startWorld();
const specs = serverSpecs(world);
const tasks = buildTasks(world.fixtures);
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'shopherd-agent-'));
const arms = Object.entries({ shopherd: specs.shopherd, 'shopify-multi-store': specs.competitor }).filter(([a]) => !ONLY || a === ONLY);
const mcpFiles = Object.fromEntries(arms.map(([arm, spec]) => {
  const f = path.join(work, `${arm}.mcp.json`);
  fs.writeFileSync(f, JSON.stringify({ mcpServers: { shop: spec } }));
  return [arm, f];
}));

const jobs = [];
for (let r = 0; r < REPEATS; r++) {
  for (const t of tasks) {
    for (const [arm] of arms) {
      jobs.push(async () => {
        const cwd = fs.mkdtempSync(path.join(work, 'run-'));
        const run = await runClaude({ prompt: t.prompt, mcpFile: mcpFiles[arm], cwd });
        const g = t.grade(run.answer);
        process.stderr.write(`${arm.padEnd(20)} ${t.id.padEnd(15)} r${r} ${g.pass ? 'PASS' : 'fail'} ${run.toolCalls.length} calls ${(run.wallMs / 1000).toFixed(1)}s${g.pass ? '' : `  missed: ${g.misses.join('; ')}`}\n`);
        return { arm, task: t.id, repeat: r, ...g, ...run };
      });
    }
  }
}
const results = await pool(jobs, PARALLEL);
await world.mock.close();

const summary = {};
for (const [arm] of arms) {
  const rs = results.filter((x) => x.arm === arm);
  summary[arm] = {
    runs: rs.length,
    passed: rs.filter((x) => x.pass).length,
    medianToolCalls: median(rs.map((x) => x.toolCalls.length)),
    medianSeconds: median(rs.map((x) => (x.durationMs ?? x.wallMs) / 1000)),
    medianInputTokens: median(rs.map((x) => x.inputTokens)),
    medianOutputTokens: median(rs.map((x) => x.outputTokens)),
    totalCostUsd: Number(rs.reduce((a, x) => a + (x.costUsd || 0), 0).toFixed(2)),
    byTask: Object.fromEntries(tasks.map((t) => [t.id, `${rs.filter((x) => x.task === t.id && x.pass).length}/${rs.filter((x) => x.task === t.id).length}`])),
  };
}
const out = { date: new Date().toISOString(), model: MODEL, repeats: REPEATS, tasks: tasks.map((t) => ({ id: t.id, prompt: t.prompt })), summary, mock: { requests: world.mock.stats.requests, errors: world.mock.stats.errors, defaultedFields: [...world.mock.stats.defaulted] }, results };
fs.mkdirSync(path.join(HERE, 'results'), { recursive: true });
const file = path.join(HERE, 'results', `agent-${out.date.slice(0, 10)}.json`);
fs.writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
console.log(`written ${file}`);
