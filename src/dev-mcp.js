import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export const DEV_MCP_PACKAGE = '@shopify/dev-mcp';

// Shopify's Dev MCP (docs search, API learning, GraphQL/Liquid/component validation) has no
// store, so one child serves every store. It always runs the newest verified release and is
// swapped between calls when a new one is promoted.
export class DevMcp {
  constructor({ toolchain, log = () => {}, clientInfo = { name: 'storerow', version: '0' } }) {
    this.toolchain = toolchain;
    this.log = log;
    this.clientInfo = clientInfo;
    this.active = null; // { version, client, tools, instructions }
    this.starting = null;
    this.error = null;
    toolchain.setSmokeTest(DEV_MCP_PACKAGE, async (entry, version) => {
      const probe = await this.spawn(entry, version);
      await probe.client.close();
      if (!probe.tools.length) throw new Error('smoke test failed: Dev MCP listed no tools');
    });
  }

  async spawn(entry, version) {
    const transport = new StdioClientTransport({ command: process.execPath, args: [entry], env: process.env, stderr: 'pipe' });
    transport.stderr?.on('data', () => {});
    const client = new Client(this.clientInfo, { capabilities: {} });
    await client.connect(transport, { timeout: 60_000 });
    const tools = [];
    let cursor;
    do {
      const page = await client.listTools(cursor ? { cursor } : {}, { timeout: 60_000 });
      tools.push(...page.tools);
      cursor = page.nextCursor;
    } while (cursor);
    return { version, client, tools, instructions: client.getInstructions?.() || '' };
  }

  // The instance to use now, starting or swapping it when the toolchain has a newer version.
  async current() {
    const { version, entry } = await this.toolchain.ensure(DEV_MCP_PACKAGE, { binName: 'shopify-dev-mcp' });
    if (this.active?.version === version) return this.active;
    if (!this.starting) {
      this.starting = this.spawn(entry, version)
        .then((next) => {
          const old = this.active;
          this.active = next;
          this.error = null;
          if (old) {
            this.log(`Dev MCP swapped ${old.version} -> ${next.version}`);
            setTimeout(() => old.client.close().catch(() => {}), 30_000).unref();
          }
          return next;
        })
        .catch((err) => {
          this.error = err.message;
          if (this.active) return this.active;
          throw err;
        })
        .finally(() => { this.starting = null; });
    }
    return this.starting;
  }

  async listTools() {
    try {
      return (await this.current()).tools;
    } catch (err) {
      this.error = err.message;
      this.log(`Dev MCP unavailable: ${err.message}`);
      return [];
    }
  }

  async callTool(name, args) {
    const inst = await this.current();
    return inst.client.callTool({ name, arguments: args }, undefined, { timeout: 120_000 });
  }

  status() {
    return { ...this.toolchain.status(DEV_MCP_PACKAGE), running: this.active?.version || null, error: this.error || this.toolchain.status(DEV_MCP_PACKAGE).error };
  }

  async close() {
    await this.active?.client.close().catch(() => {});
  }
}
