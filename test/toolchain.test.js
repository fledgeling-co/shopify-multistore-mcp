import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { Toolchain } from '../src/toolchain.js';

const PKG = '@shopify/cli';

// Fakes npm: `install pkg@v` writes a package with a bin, `audit signatures` reports per `badSignatures`.
function fakeNpm({ badSignatures = new Set(), installs = [] } = {}) {
  return async (cmd, args, { cwd }) => {
    if (args[0] === 'install') {
      const spec = args.at(-1);
      const at = spec.lastIndexOf('@');
      const [name, version] = [spec.slice(0, at), spec.slice(at + 1)];
      installs.push(version);
      const root = path.join(cwd, 'node_modules', ...name.split('/'));
      await fs.mkdir(path.join(root, 'bin'), { recursive: true });
      await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ name, version, bin: { shopify: './bin/run.js' } }));
      await fs.writeFile(path.join(root, 'bin', 'run.js'), '');
      await fs.writeFile(path.join(cwd, 'installed-version'), version);
      return { code: 0, stdout: '', stderr: '' };
    }
    if (args[0] === 'audit') {
      const version = await fs.readFile(path.join(cwd, 'installed-version'), 'utf8');
      return { code: 0, stdout: JSON.stringify({ invalid: badSignatures.has(version) ? [{ name: 'x' }] : [], missing: [] }), stderr: '' };
    }
    throw new Error(`unexpected npm ${args.join(' ')}`);
  };
}

function registry(versions) {
  let i = 0;
  return async () => {
    const v = versions[Math.min(i++, versions.length - 1)];
    if (v instanceof Error) throw v;
    return { ok: true, json: async () => ({ version: v }) };
  };
}

async function tmp() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'smm-tc-'));
}

test('first ensure installs, verifies and smoke-tests the newest release', async () => {
  const installs = [];
  const smoked = [];
  const tc = new Toolchain({ dir: await tmp(), fetchImpl: registry(['5.0.0']), runImpl: fakeNpm({ installs }) });
  tc.setSmokeTest(PKG, async (entry, version) => { smoked.push(version); assert.match(entry, /bin[\\/]run\.js$/); });
  const got = await tc.ensure(PKG, { binName: 'shopify' });
  assert.equal(got.version, '5.0.0');
  assert.match(got.entry, /5\.0\.0[\\/]node_modules[\\/]@shopify[\\/]cli[\\/]bin[\\/]run\.js$/);
  assert.deepEqual(installs, ['5.0.0']);
  assert.deepEqual(smoked, ['5.0.0']);
  assert.equal(tc.status(PKG).signatures, 'registry signatures verified');
});

test('a newer release is promoted in the background once the check interval passes', async () => {
  const dir = await tmp();
  const updates = [];
  const tc = new Toolchain({ dir, checkEveryMs: 0, fetchImpl: registry(['5.0.0', '5.1.0']), runImpl: fakeNpm() });
  tc.onUpdate = (pkg, next, prev) => updates.push([pkg, next, prev]);
  assert.equal((await tc.ensure(PKG)).version, '5.0.0');
  const during = await tc.ensure(PKG); // starts the check, keeps serving the current version
  assert.equal(during.version, '5.0.0');
  await tc.state.get(PKG).pending;
  assert.equal((await tc.ensure(PKG)).version, '5.1.0');
  assert.deepEqual(updates, [[PKG, '5.1.0', '5.0.0']]);
});

test('a release with invalid signatures is rejected and the previous version keeps serving', async () => {
  const tc = new Toolchain({ dir: await tmp(), checkEveryMs: 0, fetchImpl: registry(['5.0.0', '5.1.0']), runImpl: fakeNpm({ badSignatures: new Set(['5.1.0']) }) });
  await tc.ensure(PKG);
  await tc.ensure(PKG);
  await tc.state.get(PKG).pending;
  assert.equal((await tc.ensure(PKG)).version, '5.0.0');
  assert.match(tc.status(PKG).error, /5\.1\.0 rejected: 1 package\(s\) with invalid registry signatures/);
});

test('a release that fails its smoke test is not promoted', async () => {
  const tc = new Toolchain({ dir: await tmp(), checkEveryMs: 0, fetchImpl: registry(['5.0.0', '5.1.0']), runImpl: fakeNpm() });
  tc.setSmokeTest(PKG, async (_entry, version) => { if (version === '5.1.0') throw new Error('smoke test failed'); });
  await tc.ensure(PKG);
  await tc.ensure(PKG);
  await tc.state.get(PKG).pending;
  assert.equal((await tc.ensure(PKG)).version, '5.0.0');
  const installed = await tc.installedVersions(PKG);
  assert.deepEqual(installed, ['5.0.0']);
});

test('offline start falls back to the newest verified install', async () => {
  const dir = await tmp();
  await new Toolchain({ dir, fetchImpl: registry(['5.0.0']), runImpl: fakeNpm() }).ensure(PKG);
  const offline = new Toolchain({ dir, fetchImpl: registry([new Error('getaddrinfo ENOTFOUND registry.npmjs.org')]), runImpl: fakeNpm() });
  const got = await offline.ensure(PKG);
  assert.equal(got.version, '5.0.0');
  assert.match(offline.status(PKG).error, /using installed 5\.0\.0/);
});

test('a pinned version is used without asking the registry', async () => {
  let asked = 0;
  const tc = new Toolchain({ dir: await tmp(), pins: { [PKG]: '4.9.0' }, fetchImpl: async () => { asked++; throw new Error('no'); }, runImpl: fakeNpm() });
  assert.equal((await tc.ensure(PKG)).version, '4.9.0');
  assert.equal(asked, 0);
});

test('session-pinned mode never re-checks after the first resolve', async () => {
  let asked = 0;
  const fetchImpl = async () => { asked++; return { ok: true, json: async () => ({ version: `5.${asked}.0` }) }; };
  const tc = new Toolchain({ dir: await tmp(), checkEveryMs: 0, sessionPinned: true, fetchImpl, runImpl: fakeNpm() });
  await tc.ensure(PKG);
  await tc.ensure(PKG);
  assert.equal(asked, 1);
});

test('old versions are pruned down to the current and previous release', async () => {
  const dir = await tmp();
  const tc = new Toolchain({ dir, checkEveryMs: 0, fetchImpl: registry(['5.0.0', '5.1.0', '5.2.0']), runImpl: fakeNpm() });
  await tc.ensure(PKG);
  for (let i = 0; i < 2; i++) { await tc.ensure(PKG); await tc.state.get(PKG).pending; }
  assert.deepEqual(await tc.installedVersions(PKG), ['5.1.0', '5.2.0']);
});
