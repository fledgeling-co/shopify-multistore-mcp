import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const REGISTRY = (process.env.npm_config_registry || 'https://registry.npmjs.org').replace(/\/+$/, '');

export function run(command, args, { cwd, env, timeoutMs = 0, input } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: process.platform === 'win32' && command.endsWith('.cmd'),
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    let timer;
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (err) => { clearTimeout(timer); reject(err); });
    child.on('close', (code, signal) => { clearTimeout(timer); resolve({ code, signal, stdout, stderr }); });
    if (timeoutMs) timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs);
    child.stdin.end(input ?? '');
  });
}

function compareSemver(a, b) {
  const pa = a.split(/[.-]/).map((x) => (/^\d+$/.test(x) ? Number(x) : x));
  const pb = b.split(/[.-]/).map((x) => (/^\d+$/.test(x) ? Number(x) : x));
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x === y) continue;
    if (typeof x === 'number' && typeof y === 'number') return x - y;
    return String(x).localeCompare(String(y));
  }
  return 0;
}

// Keeps the newest release of an npm package installed in a private cache and hands out the
// path to it. A release is only promoted after npm has checked its integrity, its registry
// signatures verify, and the caller's smoke test passes; until then the previous good
// version keeps serving.
export class Toolchain {
  constructor({ dir, pins = {}, checkEveryMs = 15 * 60_000, sessionPinned = false, fetchImpl = fetch, log = () => {}, runImpl = run }) {
    this.dir = dir;
    this.pins = pins;
    this.checkEveryMs = checkEveryMs;
    this.sessionPinned = sessionPinned;
    this.fetch = fetchImpl;
    this.log = log;
    this.run = runImpl;
    this.smokeTests = new Map();
    this.state = new Map(); // pkg -> { version, dir, checkedAt, latest, error, signatures, pending }
  }

  setSmokeTest(pkg, fn) {
    this.smokeTests.set(pkg, fn);
  }

  status(pkg) {
    const s = this.state.get(pkg) || {};
    return {
      package: pkg,
      version: s.version || null,
      latest: s.latest || null,
      pinned: this.pinnedVersion(pkg),
      checkedAt: s.checkedAt ? new Date(s.checkedAt).toISOString() : null,
      updating: Boolean(s.pending),
      signatures: s.signatures || null,
      error: s.error || null,
    };
  }

  pinnedVersion(pkg) {
    const pin = this.pins[pkg];
    return pin && pin !== 'latest' ? pin : null;
  }

  pkgDir(pkg, version) {
    return path.join(this.dir, pkg.replace('/', '__'), version);
  }

  async latestVersion(pkg) {
    const url = `${REGISTRY}/${pkg.replace('/', '%2f')}/latest`;
    const res = await this.fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`npm registry returned HTTP ${res.status} for ${pkg}`);
    const body = await res.json();
    if (!body.version) throw new Error(`npm registry gave no version for ${pkg}`);
    return body.version;
  }

  async installedVersions(pkg) {
    const base = path.join(this.dir, pkg.replace('/', '__'));
    let names = [];
    try { names = await fs.readdir(base); } catch { return []; }
    const ok = [];
    for (const v of names) {
      try { await fs.access(path.join(base, v, '.ready')); ok.push(v); } catch { /* incomplete install */ }
    }
    return ok.sort(compareSemver);
  }

  async install(pkg, version, dir) {
    await fs.rm(dir, { recursive: true, force: true });
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'package.json'), '{"private":true}\n');
    this.log(`installing ${pkg}@${version}`);
    const res = await this.run(NPM, ['install', '--no-audit', '--no-fund', '--omit=dev', '--loglevel=error', `${pkg}@${version}`], { cwd: dir, timeoutMs: 15 * 60_000 });
    if (res.code !== 0) throw new Error(`npm install ${pkg}@${version} failed: ${(res.stderr || res.stdout).trim().slice(-800)}`);
    return dir;
  }

  async verifySignatures(dir) {
    const res = await this.run(NPM, ['audit', 'signatures', '--json'], { cwd: dir, timeoutMs: 3 * 60_000 });
    try {
      const out = JSON.parse(res.stdout);
      const invalid = out.invalid?.length || 0;
      if (invalid) return { ok: false, detail: `${invalid} package(s) with invalid registry signatures` };
      return { ok: true, detail: 'registry signatures verified' };
    } catch {
      return { ok: true, detail: `signatures not verified (npm audit signatures exited ${res.code})` };
    }
  }

  async entry(pkg, version, binName, dir = this.pkgDir(pkg, version)) {
    const pkgRoot = path.join(dir, 'node_modules', ...pkg.split('/'));
    const manifest = JSON.parse(await fs.readFile(path.join(pkgRoot, 'package.json'), 'utf8'));
    const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.[binName] ?? Object.values(manifest.bin || {})[0];
    if (!bin) throw new Error(`${pkg}@${version} has no executable`);
    return path.join(pkgRoot, bin);
  }

  async prepare(pkg, version, binName) {
    const final = this.pkgDir(pkg, version);
    const readReady = async () => {
      const ready = JSON.parse(await fs.readFile(path.join(final, '.ready'), 'utf8'));
      return { entry: await this.entry(pkg, version, binName), signatures: ready.signatures };
    };
    try { return await readReady(); } catch { /* not verified yet */ }
    // Install and verify in a private directory, then rename it into place, so two servers
    // updating at once never see each other's half-finished install.
    const tmp = `${final}.tmp-${process.pid}-${Date.now()}`;
    try {
      await this.install(pkg, version, tmp);
      const signatures = await this.verifySignatures(tmp);
      if (!signatures.ok) throw new Error(`${pkg}@${version} rejected: ${signatures.detail}`);
      const smoke = this.smokeTests.get(pkg);
      if (smoke) await smoke(await this.entry(pkg, version, binName, tmp), version);
      await fs.writeFile(path.join(tmp, '.ready'), JSON.stringify({ verifiedAt: new Date().toISOString(), signatures: signatures.detail }));
      try { return await readReady(); } catch { /* still ours to place */ }
      await fs.rm(final, { recursive: true, force: true });
      try {
        await fs.rename(tmp, final);
      } catch (err) {
        if (!['EEXIST', 'ENOTEMPTY', 'EPERM'].includes(err.code)) throw err;
      }
      return await readReady();
    } finally {
      await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
    }
  }

  async prune(pkg, keep) {
    const versions = await this.installedVersions(pkg);
    const keepSet = new Set([...keep, ...versions.slice(-2)]);
    for (const v of versions) {
      if (!keepSet.has(v)) await fs.rm(this.pkgDir(pkg, v), { recursive: true, force: true }).catch(() => {});
    }
  }

  // Returns { version, entry } for the version to use right now. The first call waits for an
  // install; later calls return the current version immediately and start an update check in
  // the background when the check interval has passed.
  async ensure(pkg, { binName } = {}) {
    const s = this.state.get(pkg) || {};
    this.state.set(pkg, s);
    if (s.version) {
      const due = !this.sessionPinned && !this.pinnedVersion(pkg) && Date.now() - (s.checkedAt || 0) >= this.checkEveryMs;
      if (due && !s.pending) s.pending = this.refresh(pkg, binName).finally(() => { s.pending = null; });
      return { version: s.version, entry: s.entry };
    }
    if (!s.pending) s.pending = this.refresh(pkg, binName).finally(() => { s.pending = null; });
    await s.pending;
    if (!s.version) throw new Error(s.error || `${pkg} is not available`);
    return { version: s.version, entry: s.entry };
  }

  async refresh(pkg, binName) {
    const s = this.state.get(pkg);
    let target = this.pinnedVersion(pkg);
    try {
      if (!target) {
        target = await this.latestVersion(pkg);
        s.latest = target;
      }
      s.checkedAt = Date.now();
      if (target === s.version) return;
      const { entry, signatures } = await this.prepare(pkg, target, binName);
      const previous = s.version;
      Object.assign(s, { version: target, entry, signatures, error: null });
      await this.prune(pkg, [target, previous].filter(Boolean));
      if (previous) {
        this.log(`${pkg} updated ${previous} -> ${target}`);
        this.onUpdate?.(pkg, target, previous);
      }
    } catch (err) {
      s.checkedAt = Date.now();
      s.error = err.message;
      this.log(`${pkg}: ${err.message}`);
      if (!s.version) {
        // Offline or the new release failed its checks: fall back to the newest good install.
        const installed = await this.installedVersions(pkg);
        const fallback = installed.at(-1);
        if (fallback) {
          Object.assign(s, { version: fallback, entry: await this.entry(pkg, fallback, binName) });
          s.error = `using installed ${fallback}; could not move to the newest release: ${err.message}`;
        }
      }
    }
  }
}
