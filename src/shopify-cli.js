import { spawn } from 'node:child_process';
import { run } from './toolchain.js';

export const CLI_PACKAGE = '@shopify/cli';
const ANSI = /\x1b\[[0-9;?]*[A-Za-z]/g;

// Runs jobs one at a time. Every `store execute` may refresh a token, the CLI keeps all store
// sessions in one file, and each refresh hands back a new refresh token, so two CLI processes
// writing at once can keep the stale one and silently lose a session.
export class Queue {
  constructor() {
    this.tail = Promise.resolve();
  }

  add(job) {
    const result = this.tail.then(job, job);
    this.tail = result.catch(() => {});
    return result;
  }
}

export function stripAnsi(text) {
  return String(text || '').replace(ANSI, '');
}

// The CLI prints its --json result last; anything before it is progress output.
export function parseJson(text) {
  const t = stripAnsi(text).trim();
  if (!t) return undefined;
  try { return JSON.parse(t); } catch { /* look for the trailing object */ }
  const lines = t.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i].trimStart();
    if (!l.startsWith('{') && !l.startsWith('[')) continue;
    try { return JSON.parse(lines.slice(i).join('\n')); } catch { /* keep looking */ }
  }
  return undefined;
}

export class CliError extends Error {
  constructor(message, { notAuthenticated = false, output } = {}) {
    super(message);
    this.notAuthenticated = notAuthenticated;
    this.output = output;
  }
}

function errorFrom(res) {
  const parsed = parseJson(res.stdout) ?? parseJson(res.stderr);
  const fromJson = parsed?.error?.message || parsed?.message || parsed?.error;
  const text = stripAnsi(typeof fromJson === 'string' ? fromJson : `${res.stderr}\n${res.stdout}`)
    .split('\n').map((l) => l.trim()).filter(Boolean).join(' ').slice(0, 1500);
  const message = text || (res.signal ? `Shopify CLI was stopped (${res.signal})` : `Shopify CLI exited with code ${res.code}`);
  const notAuthenticated = /store auth|not authenticated|no (stored|saved)( app)? (auth|session)|authenticat(e|ion) (required|again)|re-?run .*auth|expired/i.test(message);
  return new CliError(message, { notAuthenticated, output: parsed });
}

export class ShopifyCli {
  constructor({ toolchain, log = () => {}, timeoutMs = 120_000, runImpl = run, spawnImpl = spawn }) {
    this.toolchain = toolchain;
    this.log = log;
    this.timeoutMs = timeoutMs;
    this.run = runImpl;
    this.spawn = spawnImpl;
    this.queue = new Queue();
    this.authQueue = new Queue();
    toolchain.setSmokeTest(CLI_PACKAGE, async (entry, version) => {
      const res = await this.run(process.execPath, [entry, '--version'], { timeoutMs: 60_000 });
      if (res.code !== 0 || !res.stdout.includes(version)) {
        throw new Error(`smoke test failed: shopify --version exited ${res.code}: ${stripAnsi(res.stderr || res.stdout).trim().slice(0, 300)}`);
      }
    });
  }

  async binary() {
    return this.toolchain.ensure(CLI_PACKAGE, { binName: 'shopify' });
  }

  async json(args, { timeoutMs = this.timeoutMs } = {}) {
    const { entry, version } = await this.binary();
    const res = await this.queue.add(() => this.run(process.execPath, [entry, ...args, '--json', '--no-input'], { timeoutMs }));
    if (res.code !== 0) throw errorFrom(res);
    const parsed = parseJson(res.stdout);
    if (parsed === undefined) throw new CliError(`Shopify CLI ${version} returned no JSON: ${stripAnsi(res.stdout).trim().slice(0, 500)}`);
    return { result: parsed, cliVersion: version };
  }

  execute(domain, { query, variables, apiVersion, allowMutations = false }) {
    const args = ['store', 'execute', '--store', domain, '--query', query];
    if (variables && Object.keys(variables).length) args.push('--variables', JSON.stringify(variables));
    if (apiVersion) args.push('--version', apiVersion);
    if (allowMutations) args.push('--allow-mutations');
    return this.json(args);
  }

  async sessions() {
    const { result } = await this.json(['store', 'auth', 'list']);
    return Array.isArray(result?.sessions) ? result.sessions : [];
  }

  // Starts `shopify store auth`, which opens the browser and waits up to five minutes for the
  // merchant to approve. Returns at once with a handle; `done` settles when the CLI exits.
  startAuth(domain, scopes) {
    const handle = { domain, startedAt: Date.now(), output: '', url: null, done: null };
    handle.done = this.authQueue.add(async () => {
      const { entry } = await this.binary();
      return new Promise((resolve, reject) => {
        const child = this.spawn(process.execPath, [entry, 'store', 'auth', '--store', domain, '--scopes', scopes.join(','), '--json'], {
          env: process.env,
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
        });
        let stdout = '';
        let stderr = '';
        const onData = (chunk, sink) => {
          const text = stripAnsi(chunk);
          handle.output += text;
          const url = text.match(/https:\/\/\S+\/admin\/oauth\/authorize\S*/)?.[0] || text.match(/http:\/\/127\.0\.0\.1:\d+\/auth\/handoff\S*/)?.[0];
          if (url && !handle.url) handle.url = url;
          return sink + chunk;
        };
        child.stdout.on('data', (d) => { stdout = onData(d, stdout); });
        child.stderr.on('data', (d) => { stderr = onData(d, stderr); });
        const timer = setTimeout(() => child.kill('SIGTERM'), 330_000);
        child.on('error', (err) => { clearTimeout(timer); reject(err); });
        child.on('close', (code, signal) => {
          clearTimeout(timer);
          const res = { code, signal, stdout, stderr };
          if (code !== 0) return reject(errorFrom(res));
          resolve(parseJson(stdout) ?? {});
        });
      });
    });
    handle.done.catch(() => {});
    return handle;
  }
}
