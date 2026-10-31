// The terminal side of `setup`: check Node, add the server to each AI app found, then offer to
// connect stores. Kept apart from setup.js so the file logic can be tested without a terminal.

import readline from 'node:readline/promises';
import { applyTarget, clientTargets, detect, nodeVersionOk, serverEntry, SERVER_KEY } from './setup.js';

export async function runSetup({ flags, connect, input = process.stdin, output = process.stdout }) {
  const say = (line = '') => output.write(`${line}\n`);
  if (!nodeVersionOk()) {
    say(`This needs Node.js 22.12 or newer; this computer has ${process.versions.node}.`);
    say('Download the LTS version from https://nodejs.org, install it, then run this command again.');
    process.exitCode = 1;
    return;
  }
  const interactive = Boolean(input.isTTY) && !flags.yes;
  const rl = interactive ? readline.createInterface({ input, output }) : null;
  const ask = async (q, fallback = '') => (rl ? (await rl.question(q)).trim() : fallback);
  try {
    const remove = Boolean(flags.remove);
    const wanted = typeof flags.client === 'string' ? new Set(flags.client.split(',').map((c) => c.trim())) : null;
    const found = detect(clientTargets()).filter((t) => (wanted ? wanted.has(t.id) : t.installed));
    if (!found.length) {
      say(wanted ? `None of ${[...wanted].join(', ')} matched. Known apps: ${clientTargets().map((t) => t.id).join(', ')}.`
        : 'No supported AI app was found on this computer (Claude Desktop, Claude Code, Cursor, VS Code, Windsurf or Codex). Install one, then run this again.');
      return;
    }
    say(`${remove ? 'Remove Shopherd from' : 'Add Shopherd to'}: ${found.map((t) => t.name).join(', ')}`);
    if (rl && !/^(|y|yes)$/i.test(await ask('Go ahead? [Y/n] '))) { say('Nothing changed.'); return; }

    const entry = serverEntry();
    const changed = [];
    for (const t of found) {
      const r = applyTarget(t, entry, { remove });
      say(`${r.status === 'skipped' ? 'skip' : 'ok  '} ${t.name}: ${r.status} ${r.detail ? `- ${r.detail}` : ''}${r.backup ? `\n     backup: ${r.backup}` : ''}`);
      if (['added', 'updated', 'removed'].includes(r.status)) changed.push(t.name);
    }
    if (remove) { say(changed.length ? `\nRestart ${changed.join(', ')} to finish.` : ''); return; }

    say('');
    if (rl) {
      say('Connect a store now. Shopify opens its approval page in your browser for each one.');
      for (;;) {
        const domain = await ask('Store address (like acme.myshopify.com), or press Enter to finish: ');
        if (!domain) break;
        const suggested = domain.replace(/^https?:\/\//, '').split('.')[0];
        const name = (await ask(`Short name for it [${suggested}]: `)) || suggested;
        const readOnly = /^y/i.test(await ask('Read-only, so the assistant can never change it? [y/N] '));
        try {
          await connect({ store: name, domain, read_only: readOnly || undefined });
        } catch (err) {
          say(`Could not connect ${domain}: ${err.message}`);
        }
      }
    } else {
      say('To connect stores, run: npx -y shopherd-shopify-mcp@latest connect <name> <store>.myshopify.com');
    }
    say('');
    say(changed.length ? `Done. Fully quit and reopen ${changed.join(', ')}, then ask: "How many orders are unfulfilled in each store?"`
      : `Done. Ask your assistant: "How many orders are unfulfilled in each store?" (the "${SERVER_KEY}" server).`);
    say('You can also connect stores from the chat: "Connect acme.myshopify.com as acme".');
  } finally {
    rl?.close();
  }
}
