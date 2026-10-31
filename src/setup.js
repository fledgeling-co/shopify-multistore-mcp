// `setup`: adds this server to the AI apps installed on this computer, so nobody has to edit a
// JSON file by hand. Every file is backed up before it changes, a file that cannot be read is left
// alone, and entries left by the project's earlier names are replaced rather than duplicated.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const SERVER_KEY = 'shopherd-shopify-mcp';
export const PACKAGE_SPEC = 'shopherd-shopify-mcp@latest';
// Entries written for the project's earlier names: shopify-multi-mcp, StoreRow, and plain shopherd.
const LEGACY = /shopify-multi-mcp|fledgeling-co\/storerow|(^|[\s/"'])(storerow|shopherd)(@|$|[\s"'])/;

// The command written into each app. Desktop apps started from the Dock or Start menu often do not
// see the PATH a terminal sees, so the entry names the npx next to the Node running setup and puts
// that Node first on PATH.
export function serverEntry({ platform = process.platform, execPath = process.execPath, exists = fs.existsSync } = {}) {
  const bin = path.dirname(execPath);
  const npx = path.join(bin, platform === 'win32' ? 'npx.cmd' : 'npx');
  const found = exists(npx);
  const pathEnv = platform === 'win32' ? bin : [bin, '/usr/local/bin', '/opt/homebrew/bin', '/usr/bin', '/bin'].join(':');
  if (platform === 'win32') return { command: 'cmd', args: ['/c', found ? npx : 'npx', '-y', PACKAGE_SPEC], env: { PATH: `${pathEnv};C:\\Windows\\System32` } };
  return { command: found ? npx : 'npx', args: ['-y', PACKAGE_SPEC], env: { PATH: pathEnv } };
}

export function clientTargets({ platform = process.platform, home = os.homedir(), env = process.env } = {}) {
  const appData = env.APPDATA || path.join(home, 'AppData', 'Roaming');
  const support = platform === 'darwin' ? path.join(home, 'Library', 'Application Support')
    : platform === 'win32' ? appData
      : env.XDG_CONFIG_HOME || path.join(home, '.config');
  const codexHome = env.CODEX_HOME || path.join(home, '.codex');
  return [
    { id: 'claude-desktop', name: 'Claude Desktop', kind: 'json', key: 'mcpServers', dir: path.join(support, 'Claude'), file: path.join(support, 'Claude', 'claude_desktop_config.json') },
    { id: 'claude-code', name: 'Claude Code', kind: 'command' },
    { id: 'cursor', name: 'Cursor', kind: 'json', key: 'mcpServers', dir: path.join(home, '.cursor'), file: path.join(home, '.cursor', 'mcp.json') },
    { id: 'vscode', name: 'VS Code', kind: 'json', key: 'servers', extra: { type: 'stdio' }, dir: path.join(support, 'Code', 'User'), file: path.join(support, 'Code', 'User', 'mcp.json') },
    { id: 'windsurf', name: 'Windsurf', kind: 'json', key: 'mcpServers', dir: path.join(home, '.codeium', 'windsurf'), file: path.join(home, '.codeium', 'windsurf', 'mcp_config.json') },
    { id: 'codex', name: 'Codex', kind: 'toml', dir: codexHome, file: path.join(codexHome, 'config.toml') },
  ];
}

export function hasClaudeCode(spawn = spawnSync) {
  const r = spawn('claude', ['--version'], { encoding: 'utf8', timeout: 15_000, shell: process.platform === 'win32' });
  return r.status === 0;
}

export function detect(targets, { exists = fs.existsSync, claudeCode = hasClaudeCode } = {}) {
  return targets.map((t) => ({ ...t, installed: t.kind === 'command' ? claudeCode() : exists(t.dir) }));
}

function backup(file, now) {
  const copy = `${file}.backup-${now.toISOString().replace(/[:.]/g, '-')}`;
  fs.copyFileSync(file, copy);
  return copy;
}

function writeAtomic(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Returns { status: 'added' | 'updated' | 'unchanged' | 'removed' | 'skipped', detail, backup? }.
export function applyJson(target, entry, { remove = false, now = new Date() } = {}) {
  let doc = {};
  const existed = fs.existsSync(target.file);
  if (existed) {
    const raw = fs.readFileSync(target.file, 'utf8').replace(/^\uFEFF/, '');
    if (raw.trim()) {
      try {
        doc = JSON.parse(raw);
      } catch (err) {
        return { status: 'skipped', detail: `could not read ${target.file} (${err.message}); left it unchanged` };
      }
    }
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return { status: 'skipped', detail: `${target.file} is not a JSON object; left it unchanged` };
  }
  const servers = doc[target.key] && typeof doc[target.key] === 'object' ? { ...doc[target.key] } : {};
  const legacy = Object.keys(servers).filter((k) => k !== SERVER_KEY && LEGACY.test(JSON.stringify(servers[k])));
  const wanted = { ...(target.extra || {}), ...entry };
  if (remove) {
    if (!(SERVER_KEY in servers) && !legacy.length) return { status: 'unchanged', detail: 'not set up there' };
    delete servers[SERVER_KEY];
  } else {
    if (same(servers[SERVER_KEY], wanted) && !legacy.length) return { status: 'unchanged', detail: 'already set up' };
  }
  for (const k of legacy) delete servers[k];
  const status = remove ? 'removed' : SERVER_KEY in servers ? 'updated' : 'added';
  if (!remove) servers[SERVER_KEY] = wanted;
  const copy = existed ? backup(target.file, now) : undefined;
  writeAtomic(target.file, `${JSON.stringify({ ...doc, [target.key]: servers }, null, 2)}\n`);
  const replaced = legacy.length ? ` (replaced the old "${legacy.join('", "')}" entry)` : '';
  return { status, detail: `${target.file}${replaced}`, backup: copy };
}

const tomlString = (s) => JSON.stringify(String(s));

function tomlBlock(entry) {
  return `[mcp_servers.${SERVER_KEY}]\ncommand = ${tomlString(entry.command)}\nargs = [${entry.args.map(tomlString).join(', ')}]\n\n[mcp_servers.${SERVER_KEY}.env]\nPATH = ${tomlString(entry.env.PATH)}\n`;
}

// Codex keeps TOML. Our block (and its .env table) is replaced as a whole; nothing else is touched.
export function applyToml(target, entry, { remove = false, now = new Date() } = {}) {
  const existed = fs.existsSync(target.file);
  const raw = existed ? fs.readFileSync(target.file, 'utf8') : '';
  const ours = new RegExp(`^\\[mcp_servers\\.${SERVER_KEY}(\\.env)?\\]\\n(?:(?!\\[)[^\\n]*\\n?)*`, 'gm');
  const without = raw.replace(ours, '').replace(/\n{3,}/g, '\n\n');
  if (remove) {
    if (without === raw) return { status: 'unchanged', detail: 'not set up there' };
    const copy = backup(target.file, now);
    writeAtomic(target.file, without.trimEnd() + '\n');
    return { status: 'removed', detail: target.file, backup: copy };
  }
  const next = `${without.trimEnd()}${without.trim() ? '\n\n' : ''}${tomlBlock(entry)}`;
  if (next === raw) return { status: 'unchanged', detail: 'already set up' };
  const copy = existed ? backup(target.file, now) : undefined;
  writeAtomic(target.file, next);
  return { status: without === raw ? 'added' : 'updated', detail: target.file, backup: copy };
}

export function applyClaudeCode(entry, { remove = false, spawn = spawnSync } = {}) {
  const opts = { encoding: 'utf8', timeout: 30_000, shell: process.platform === 'win32' };
  const present = spawn('claude', ['mcp', 'get', SERVER_KEY], opts).status === 0;
  if (remove) {
    if (!present) return { status: 'unchanged', detail: 'not set up there' };
    const r = spawn('claude', ['mcp', 'remove', '--scope', 'user', SERVER_KEY], opts);
    return r.status === 0 ? { status: 'removed', detail: 'claude mcp remove' } : { status: 'skipped', detail: (r.stderr || r.stdout || '').trim().slice(0, 300) };
  }
  if (present) return { status: 'unchanged', detail: 'already set up (claude mcp get shopherd)' };
  // --env takes several values, so it goes after the name, and -- ends it before the command.
  const args = ['mcp', 'add', '--scope', 'user', SERVER_KEY];
  for (const [k, v] of Object.entries(entry.env || {})) args.push('--env', `${k}=${v}`);
  args.push('--', entry.command, ...entry.args);
  const r = spawn('claude', args, opts);
  return r.status === 0 ? { status: 'added', detail: 'claude mcp add --scope user' } : { status: 'skipped', detail: (r.stderr || r.stdout || '').trim().slice(0, 300) };
}

export function applyTarget(target, entry, opts = {}) {
  try {
    if (target.kind === 'json') return applyJson(target, entry, opts);
    if (target.kind === 'toml') return applyToml(target, entry, opts);
    return applyClaudeCode(entry, opts);
  } catch (err) {
    return { status: 'skipped', detail: err.message };
  }
}

export function nodeVersionOk(version = process.versions.node) {
  const [major, minor] = version.split('.').map(Number);
  return major > 22 || (major === 22 && minor >= 12);
}
