import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { applyClaudeCode, applyJson, applyToml, clientTargets, detect, nodeVersionOk, serverEntry } from '../src/setup.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'smm-setup-'));
const entry = { command: '/opt/node/bin/npx', args: ['-y', 'shopify-multistore-mcp@latest'], env: { PATH: '/opt/node/bin:/usr/bin:/bin' } };

test('serverEntry names the npx beside the running Node and puts that Node on PATH', () => {
  const e = serverEntry({ platform: 'darwin', execPath: '/opt/node/bin/node', exists: () => true });
  assert.deepEqual(e, { command: '/opt/node/bin/npx', args: ['-y', 'shopify-multistore-mcp@latest'], env: { PATH: '/opt/node/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin' } });
  assert.equal(serverEntry({ platform: 'linux', execPath: '/x/node', exists: () => false }).command, 'npx');
  const win = serverEntry({ platform: 'win32', execPath: 'C:\\node\\node.exe', exists: () => true });
  assert.equal(win.command, 'cmd');
  assert.equal(win.args[0], '/c');
});

test('clientTargets uses each app\'s own config location', () => {
  const t = Object.fromEntries(clientTargets({ platform: 'darwin', home: '/Users/a', env: {} }).map((x) => [x.id, x]));
  assert.equal(t['claude-desktop'].file, '/Users/a/Library/Application Support/Claude/claude_desktop_config.json');
  assert.equal(t.vscode.file, '/Users/a/Library/Application Support/Code/User/mcp.json');
  assert.equal(t.vscode.key, 'servers');
  assert.equal(t.cursor.file, '/Users/a/.cursor/mcp.json');
  assert.equal(t.codex.file, '/Users/a/.codex/config.toml');
  const linux = Object.fromEntries(clientTargets({ platform: 'linux', home: '/home/a', env: {} }).map((x) => [x.id, x]));
  assert.equal(linux['claude-desktop'].file, '/home/a/.config/Claude/claude_desktop_config.json');
});

test('detect marks apps installed by their folder, and Claude Code by its command', () => {
  const found = detect(clientTargets({ platform: 'darwin', home: '/Users/a', env: {} }), { exists: (p) => p.endsWith('.cursor'), claudeCode: () => true });
  assert.deepEqual(found.filter((t) => t.installed).map((t) => t.id), ['claude-code', 'cursor']);
});

test('JSON: adds to a new file, keeps other servers, backs up, and is idempotent', () => {
  const dir = tmp();
  const target = { kind: 'json', key: 'mcpServers', file: path.join(dir, 'Claude', 'claude_desktop_config.json') };
  assert.equal(applyJson(target, entry).status, 'added');
  assert.deepEqual(JSON.parse(fs.readFileSync(target.file, 'utf8')).mcpServers['shopify-multistore-mcp'], entry);

  const doc = JSON.parse(fs.readFileSync(target.file, 'utf8'));
  doc.mcpServers.other = { command: 'other' };
  doc.theme = 'dark';
  fs.writeFileSync(target.file, JSON.stringify(doc));
  const again = applyJson(target, entry);
  assert.equal(again.status, 'unchanged');
  const changed = applyJson(target, { ...entry, args: ['-y', 'shopify-multistore-mcp@0.3.0'] });
  assert.equal(changed.status, 'updated');
  assert.ok(fs.existsSync(changed.backup));
  const after = JSON.parse(fs.readFileSync(target.file, 'utf8'));
  assert.equal(after.theme, 'dark');
  assert.deepEqual(after.mcpServers.other, { command: 'other' });
});

test('JSON: replaces entries left by the old names and adds type for VS Code', () => {
  const dir = tmp();
  const file = path.join(dir, 'mcp.json');
  fs.writeFileSync(file, JSON.stringify({ servers: { shopify: { command: 'npx', args: ['-y', 'github:fledgeling-co/shopify-multi-mcp'] }, keep: { command: 'x' } } }));
  const r = applyJson({ kind: 'json', key: 'servers', extra: { type: 'stdio' }, file }, entry);
  assert.equal(r.status, 'added');
  assert.match(r.detail, /replaced the old "shopify" entry/);
  const servers = JSON.parse(fs.readFileSync(file, 'utf8')).servers;
  assert.deepEqual(Object.keys(servers).sort(), ['keep', 'shopify-multistore-mcp']);
  assert.equal(servers['shopify-multistore-mcp'].type, 'stdio');
});

test('JSON: an unreadable file is left exactly as it was', () => {
  const file = path.join(tmp(), 'mcp.json');
  fs.writeFileSync(file, '{ "mcpServers": { oops ');
  const r = applyJson({ kind: 'json', key: 'mcpServers', file }, entry);
  assert.equal(r.status, 'skipped');
  assert.equal(fs.readFileSync(file, 'utf8'), '{ "mcpServers": { oops ');
});

test('JSON: remove takes only our entry out', () => {
  const file = path.join(tmp(), 'mcp.json');
  fs.writeFileSync(file, JSON.stringify({ mcpServers: { 'shopify-multistore-mcp': entry, other: { command: 'o' } } }));
  assert.equal(applyJson({ kind: 'json', key: 'mcpServers', file }, entry, { remove: true }).status, 'removed');
  assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(file, 'utf8')).mcpServers), ['other']);
});

test('TOML: appends our block, replaces it on change, and removes only it', () => {
  const file = path.join(tmp(), 'config.toml');
  fs.writeFileSync(file, 'model = "gpt"\n\n[mcp_servers.other]\ncommand = "o"\n');
  assert.equal(applyToml({ file }, entry).status, 'added');
  let text = fs.readFileSync(file, 'utf8');
  assert.match(text, /\[mcp_servers\.shopify-multistore-mcp\]\ncommand = "\/opt\/node\/bin\/npx"\nargs = \["-y", "shopify-multistore-mcp@latest"\]/);
  assert.match(text, /\[mcp_servers\.shopify-multistore-mcp\.env\]\nPATH = "\/opt\/node\/bin:\/usr\/bin:\/bin"/);
  assert.equal(applyToml({ file }, entry).status, 'unchanged');
  assert.equal(applyToml({ file }, { ...entry, args: ['-y', 'shopify-multistore-mcp@0.3.0'] }).status, 'updated');
  text = fs.readFileSync(file, 'utf8');
  assert.equal(text.match(/\[mcp_servers\.shopify-multistore-mcp\]/g).length, 1);
  assert.equal(applyToml({ file }, entry, { remove: true }).status, 'removed');
  text = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(text, /shopify-multistore-mcp/);
  assert.match(text, /model = "gpt"[\s\S]*\[mcp_servers\.other\]\ncommand = "o"/);
});

test('Claude Code: adds with claude mcp add once, with the PATH env', () => {
  const calls = [];
  const spawn = (cmd, args) => { calls.push(args); return { status: args[1] === 'get' ? 1 : 0, stdout: '', stderr: '' }; };
  assert.equal(applyClaudeCode(entry, { spawn }).status, 'added');
  assert.deepEqual(calls[1], ['mcp', 'add', '--scope', 'user', 'shopify-multistore-mcp', '--env', 'PATH=/opt/node/bin:/usr/bin:/bin', '--', '/opt/node/bin/npx', '-y', 'shopify-multistore-mcp@latest']);
  assert.equal(applyClaudeCode(entry, { spawn: () => ({ status: 0 }) }).status, 'unchanged');
});

test('nodeVersionOk matches Shopify CLI\'s floor of 22.12', () => {
  assert.equal(nodeVersionOk('22.12.0'), true);
  assert.equal(nodeVersionOk('22.11.9'), false);
  assert.equal(nodeVersionOk('24.1.0'), true);
  assert.equal(nodeVersionOk('20.18.0'), false);
});
