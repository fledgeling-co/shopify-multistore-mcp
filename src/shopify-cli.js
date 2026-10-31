import { spawn } from 'node:child_process';
import path from 'node:path';
import { run } from './toolchain.js';

export const CLI_PACKAGE = '@shopify/cli';
const ANSI = /\x1b\[[0-9;?]*[A-Za-z]/g;

// Runs jobs one at a time.
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

// Lets at most `max` jobs run at once.
export class Limiter {
  constructor(max) {
    this.max = Math.max(1, max);
    this.active = 0;
    this.waiting = [];
  }

  async run(job) {
    if (this.active >= this.max) await new Promise((resolve) => this.waiting.push(resolve));
    this.active++;
    try {
      return await job();
    } finally {
      this.active--;
      this.waiting.shift()?.();
    }
  }
}

// Every `store execute` may refresh a token, the CLI keeps sessions in one settings file per home
// folder, and each refresh hands back a new refresh token, so two CLI processes writing the same
// file at once can keep the stale one and silently lose a session. Each connected store therefore
// gets its own home folder (its own settings file), calls for one home run in order, and
// different homes run side by side up to the concurrency limit. Stores signed in before 0.3.0
// share the CLI's default home and stay in one queue.
export function sessionEnv(home) {
  if (!home) return {};
  return {
    HOME: home,
    USERPROFILE: home,
    XDG_CONFIG_HOME: path.join(home, '.config'),
    XDG_DATA_HOME: path.join(home, '.local', 'share'),
    XDG_STATE_HOME: path.join(home, '.local', 'state'),
    XDG_CACHE_HOME: path.join(home, '.cache'),
    APPDATA: path.join(home, 'AppData', 'Roaming'),
    LOCALAPPDATA: path.join(home, 'AppData', 'Local'),
  };
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
  constructor({ toolchain, log = () => {}, timeoutMs = 120_000, runImpl = run, spawnImpl = spawn, concurrency = 4, retryDelayMs = 1000 }) {
    this.toolchain = toolchain;
    this.log = log;
    this.timeoutMs = timeoutMs;
    this.run = runImpl;
    this.spawn = spawnImpl;
    this.limiter = new Limiter(concurrency);
    this.lanes = new Map(); // home folder (or '') -> Queue
    this.authQueue = new Queue();
    this.retryDelayMs = retryDelayMs;
    toolchain.setSmokeTest(CLI_PACKAGE, async (entry, version) => {
      const res = await this.run(process.execPath, [entry, '--version'], { timeoutMs: 60_000 });
      if (res.code !== 0 || !res.stdout.includes(version)) {
        throw new Error(`smoke test failed: shopify --version exited ${res.code}: ${stripAnsi(res.stderr || res.stdout).trim().slice(0, 300)}`);
      }
    });
  }

  async binary() {
    // Evals point this at a stand-in CLI that answers from a local mock store.
    if (process.env.SHOPHERD_CLI_ENTRY) return { entry: process.env.SHOPHERD_CLI_ENTRY, version: 'eval' };
    return this.toolchain.ensure(CLI_PACKAGE, { binName: 'shopify' });
  }

  lane(home) {
    const key = home || '';
    if (!this.lanes.has(key)) this.lanes.set(key, new Queue());
    return this.lanes.get(key);
  }

  async json(args, { timeoutMs = this.timeoutMs, home } = {}) {
    const { entry, version } = await this.binary();
    const res = await this.lane(home).add(() => this.limiter.run(() =>
      this.run(process.execPath, [entry, ...args, '--json', '--no-input'], { timeoutMs, env: sessionEnv(home) })));
    if (res.code !== 0) throw errorFrom(res);
    const parsed = parseJson(res.stdout);
    if (parsed === undefined) throw new CliError(`Shopify CLI ${version} returned no JSON: ${stripAnsi(res.stdout).trim().slice(0, 500)}`);
    return { result: parsed, cliVersion: version };
  }

  // `target` is { domain, home }; home is the store's own session folder, or empty for the CLI's
  // default. Queries that Shopify throttles are retried up to three times; mutations never are,
  // so a change is not applied twice.
  async execute(target, { query, variables, apiVersion, allowMutations = false }) {
    const args = ['store', 'execute', '--store', target.domain, '--query', query];
    if (variables && Object.keys(variables).length) args.push('--variables', JSON.stringify(variables));
    if (apiVersion) args.push('--version', apiVersion);
    if (allowMutations) args.push('--allow-mutations');
    for (let attempt = 0; ; attempt++) {
      let out;
      let throttled;
      try {
        out = await this.json(args, { home: target.home });
        throttled = isThrottled(out.result);
      } catch (err) {
        if (!(err instanceof CliError) || !/throttl/i.test(err.message)) throw err;
        throttled = err;
      }
      if (!throttled || allowMutations || attempt >= 3) {
        if (throttled instanceof Error) throw throttled;
        return out;
      }
      await new Promise((r) => setTimeout(r, this.retryDelayMs * 2 ** attempt));
    }
  }

  async sessions(home) {
    const { result } = await this.json(['store', 'auth', 'list'], { home });
    return Array.isArray(result?.sessions) ? result.sessions : [];
  }

  // Starts `shopify store auth`, which opens the browser and waits up to five minutes for the
  // merchant to approve. Returns at once with a handle; `done` settles when the CLI exits.
  // Sign-ins run one at a time because each opens a browser window and a local callback.
  startAuth(target, scopes) {
    const domain = target.domain;
    const handle = { domain, startedAt: Date.now(), output: '', url: null, done: null };
    handle.done = this.authQueue.add(() => this.lane(target.home).add(async () => {
      const { entry } = await this.binary();
      return new Promise((resolve, reject) => {
        const child = this.spawn(process.execPath, [entry, 'store', 'auth', '--store', domain, '--scopes', scopes.join(','), '--json'], {
          env: { ...process.env, ...sessionEnv(target.home) },
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
    }));
    handle.done.catch(() => {});
    return handle;
  }
}

export function isThrottled(result) {
  const errors = Array.isArray(result?.errors) ? result.errors : [];
  return errors.some((e) => e?.extensions?.code === 'THROTTLED' || /throttl/i.test(e?.message || ''));
}
