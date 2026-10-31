// Shared setup for the evals: the mock store, and how to start each server against it.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { buildFixtures, EVAL_STORES } from './mock/fixtures.js';
import { startMock } from './mock/server.js';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.dirname(HERE);
export const COMPETITOR_IMAGE = 'shopherd-eval/competitor:2.0.3';

export async function startWorld({ bench = 0, names } = {}) {
  const fixtures = buildFixtures({ bench });
  const mock = await startMock({ fixtures });
  const stores = (names || EVAL_STORES).map((n) => fixtures.stores[n]);
  return { fixtures, mock, stores };
}

// How an MCP client (the eval, or Claude Code) starts each server, as { command, args, env }.
export function serverSpecs({ mock, stores, startupMs = 470, concurrency, readOnly = [] }) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'shopherd-eval-'));
  fs.writeFileSync(path.join(home, 'stores.json'), JSON.stringify({
    stores: Object.fromEntries(stores.map((s) => [s.name, { domain: s.domain, label: s.shop.name, session: 'own', ...(readOnly.includes(s.name) ? { readOnly: true } : {}) }])),
  }));
  const shopherd = {
    command: process.execPath,
    args: [path.join(REPO, 'bin', 'shopherd.js')],
    env: {
      SHOPHERD_HOME: home,
      SHOPHERD_CLI_ENTRY: path.join(HERE, 'fake-shopify-cli.mjs'),
      MOCK_SHOPIFY_URL: mock.url,
      MOCK_SHOPIFY_TOKENS: JSON.stringify(Object.fromEntries(stores.map((s) => [s.domain, s.token]))),
      FAKE_CLI_STARTUP_MS: String(startupMs),
      ...(concurrency ? { SHOPHERD_CONCURRENCY: String(concurrency) } : {}),
    },
  };
  const dockerUrl = mock.url.replace('127.0.0.1', 'host.docker.internal');
  const competitorEnv = {
    STORES_JSON: JSON.stringify({ stores: stores.map((s) => ({ alias: s.name, shop: s.domain, baseUrl: dockerUrl })) }),
    SHOPIFY_MULTI_STORE_ALLOW_INSECURE_HTTP: '1',
    ...Object.fromEntries(stores.map((s) => [`SHOPIFY_TOKEN_${s.name.toUpperCase()}`, s.token])),
  };
  const competitor = {
    command: 'docker',
    args: ['run', '-i', '--rm', '--add-host=host.docker.internal:host-gateway', ...Object.keys(competitorEnv).flatMap((k) => ['-e', k]), COMPETITOR_IMAGE, 'start'],
    env: competitorEnv,
  };
  return { shopherd, competitor, home };
}

export async function connect(spec) {
  const transport = new StdioClientTransport({ command: spec.command, args: spec.args, env: { ...process.env, ...spec.env }, stderr: 'ignore' });
  const client = new Client({ name: 'shopherd-evals', version: '1' });
  await client.connect(transport);
  return client;
}

export const text = (res) => (res.content || []).map((c) => c.text || '').join('\n');

export function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null;
}
