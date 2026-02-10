#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { getDb } from './db/connection.js';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

function getDefaultDbPath(): string {
  const configDir = path.join(os.homedir(), '.project-memory');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  return path.join(configDir, 'graph.db');
}

async function main() {
  const dbPath = process.env.PM_DB_PATH || getDefaultDbPath();

  console.error(`[project-memory] Starting MCP server...`);
  console.error(`[project-memory] Database: ${dbPath}`);

  const db = getDb(dbPath);
  const server = createServer(db);
  const transport = new StdioServerTransport();

  await server.connect(transport);
  console.error(`[project-memory] Server running on stdio`);
}

main().catch((err) => {
  console.error('[project-memory] Fatal error:', err);
  process.exit(1);
});
