#!/usr/bin/env node

/**
 * Project Memory — Interactive Demo
 *
 * Walks through the complete lifecycle using the autoPM project itself as an example.
 * Run: node demo.mjs
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// ─── Helpers ───────────────────────────────────────────────

const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

function header(step, title) {
  console.log(`\n${CYAN}${'='.repeat(60)}${RESET}`);
  console.log(`${CYAN}${BOLD}  Step ${step}: ${title}${RESET}`);
  console.log(`${CYAN}${'='.repeat(60)}${RESET}\n`);
}

function printResult(result) {
  const parsed = JSON.parse(result.content[0].text);
  console.log(JSON.stringify(parsed, null, 2));
  return parsed;
}

function pause(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Main ──────────────────────────────────────────────────

async function main() {
  console.log(`\n${BOLD}${GREEN}╔════════════════════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}${GREEN}║   Project Memory — Step-by-Step Demo               ║${RESET}`);
  console.log(`${BOLD}${GREEN}║   Using "autoPM" project as the example            ║${RESET}`);
  console.log(`${BOLD}${GREEN}╚════════════════════════════════════════════════════╝${RESET}\n`);

  // Connect to the MCP server
  console.log(`${DIM}Connecting to project-memory MCP server...${RESET}`);
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['/Users/junyu/coding/autoPM/dist/index.js'],
    env: { ...process.env, PM_DB_PATH: '/tmp/pm-demo.db' }, // Use temp DB for demo
  });
  const client = new Client({ name: 'demo-client', version: '1.0.0' }, {});
  await client.connect(transport);
  console.log(`${GREEN}Connected!${RESET}`);

  // ========================================================
  // Step 1: Create a project
  // ========================================================
  header(1, 'pm_project_create — Register "autoPM" project');

  console.log(`${DIM}Calling: pm_project_create({
  name: "auto-pm",
  path: "/Users/junyu/coding/autoPM",
  techStack: ["TypeScript", "Node.js", "MCP", "SQLite"],
  displayName: "AutoPM - Project Memory System"
})${RESET}\n`);

  const createResult = printResult(await client.callTool({
    name: 'pm_project_create',
    arguments: {
      name: 'auto-pm',
      path: '/Users/junyu/coding/autoPM',
      techStack: ['TypeScript', 'Node.js', 'MCP', 'SQLite'],
      displayName: 'AutoPM - Project Memory System',
    },
  }));

  console.log(`\n${GREEN}✓ Project created with ${createResult.project.documents.length} document slots${RESET}`);
  console.log(`${DIM}  Each slot is a separate markdown document: todo, confirm, progress, delays, prd, memory, notes, qa${RESET}`);

  // ========================================================
  // Step 2: Create a second project (for dependency demo)
  // ========================================================
  header(2, 'pm_project_create — Register "cursor-plugin" (related project)');

  console.log(`${DIM}Creating a second project to demo cross-project features...${RESET}\n`);

  printResult(await client.callTool({
    name: 'pm_project_create',
    arguments: {
      name: 'cursor-plugin',
      path: '/Users/junyu/coding/cursor-plugin',
      techStack: ['TypeScript', 'Cursor API'],
      displayName: 'Cursor Plugin for AutoPM',
    },
  }));

  console.log(`\n${GREEN}✓ Second project created${RESET}`);

  // ========================================================
  // Step 3: Update documents — TODO
  // ========================================================
  header(3, 'pm_update (append) — Add TODO items');

  console.log(`${DIM}Calling: pm_update({
  projectId: "auto-pm",
  docType: "todo",
  content: "## 2026-02-10\\n- [ ] Add vector search (sqlite-vec)\\n- [ ] Build Web UI\\n- [ ] Add LLM-based classifier",
  mode: "append"
})${RESET}\n`);

  printResult(await client.callTool({
    name: 'pm_update',
    arguments: {
      projectId: 'auto-pm',
      docType: 'todo',
      content: '## 2026-02-10\n- [ ] Add vector search (sqlite-vec)\n- [ ] Build Web UI with D3.js graph\n- [ ] Add LLM-based conversation classifier\n- [ ] Implement file-system .pm/ directory sync',
      mode: 'append',
    },
  }));

  console.log(`\n${GREEN}✓ TODO items appended (version bumped)${RESET}`);

  // ========================================================
  // Step 4: Update documents — Progress (upsert)
  // ========================================================
  header(4, 'pm_update (upsert) — Set current progress');

  console.log(`${DIM}Upsert mode replaces the "## Current Sprint" section in-place${RESET}\n`);

  printResult(await client.callTool({
    name: 'pm_update',
    arguments: {
      projectId: 'auto-pm',
      docType: 'progress',
      content: '## Current Sprint\n**Status:** In progress (Week 1 / 4)\n**Completed:**\n- SQLite schema with 6 tables\n- 4 data models (Project, Document, Edge, Version)\n- Graph engine with BFS traversal\n- Keyword search engine\n- 6 MCP tools implemented\n- 34 tests passing\n\n**Next:**\n- Vector search integration\n- Web UI',
      mode: 'upsert',
    },
  }));

  console.log(`\n${GREEN}✓ Progress updated (upsert replaced "Current Sprint" section)${RESET}`);

  // ========================================================
  // Step 5: Update documents — PRD
  // ========================================================
  header(5, 'pm_update (upsert) — Store PRD');

  printResult(await client.callTool({
    name: 'pm_update',
    arguments: {
      projectId: 'auto-pm',
      docType: 'prd',
      content: '## V1.0\n### Goal\nKnowledge Graph–based Project Memory System\n\n### Core Features\n- 8 document types per project (todo, confirm, progress, delays, prd, memory, notes, qa)\n- Automatic post-conversation updates via LLM classification\n- Cross-project dependency graph with BFS traversal\n- Semantic search via sqlite-vec embeddings\n- MCP server for Cursor/Claude Code integration\n\n### Tech Stack\nTypeScript, Node.js, SQLite, better-sqlite3, MCP SDK',
      mode: 'upsert',
    },
  }));

  console.log(`\n${GREEN}✓ PRD stored${RESET}`);

  // ========================================================
  // Step 6: Update documents — Confirm (upsert lifecycle)
  // ========================================================
  header(6, 'pm_update (upsert) — Confirm lifecycle: Pending → Confirmed');

  console.log(`${YELLOW}6a. Add a pending question:${RESET}\n`);

  printResult(await client.callTool({
    name: 'pm_update',
    arguments: {
      projectId: 'auto-pm',
      docType: 'confirm',
      content: '## Q1: Use sqlite-vec or external vector DB?\n**Status:** Pending\n**Options:**\n- sqlite-vec: lightweight, same DB, good enough for single-user\n- Qdrant/Pinecone: scalable but adds infra complexity',
      mode: 'upsert',
    },
  }));

  console.log(`\n${YELLOW}6b. Now confirm the decision (upsert same key "Q1"):${RESET}\n`);

  printResult(await client.callTool({
    name: 'pm_update',
    arguments: {
      projectId: 'auto-pm',
      docType: 'confirm',
      content: '## Q1: Use sqlite-vec or external vector DB?\n**Status:** Confirmed\n**Decision:** sqlite-vec\n**Reason:** Keeps architecture simple, zero external deps, sufficient for single-user MVP',
      mode: 'upsert',
    },
  }));

  console.log(`\n${GREEN}✓ Question confirmed — upsert replaced "Pending" with "Confirmed" in-place${RESET}`);

  // ========================================================
  // Step 7: Update documents — Memory
  // ========================================================
  header(7, 'pm_update (append) — Record architecture decisions');

  printResult(await client.callTool({
    name: 'pm_update',
    arguments: {
      projectId: 'auto-pm',
      docType: 'memory',
      content: '## 2026-02-10 — Architecture Decisions\n- Chose SQLite + better-sqlite3 for zero-config embedded storage\n- MCP SDK (stdio transport) for Cursor/Claude Code integration\n- Keyword search for MVP, vector search in V2\n- Rule-based classifier for auto-update (LLM upgrade planned)\n- In-memory DB for tests, file-based DB for production',
      mode: 'append',
    },
  }));

  console.log(`\n${GREEN}✓ Memories appended (chronological log)${RESET}`);

  // ========================================================
  // Step 8: Add dependency
  // ========================================================
  header(8, 'pm_dependency_add — Link projects');

  console.log(`${DIM}Creating edge: cursor-plugin --uses--> auto-pm${RESET}\n`);

  printResult(await client.callTool({
    name: 'pm_dependency_add',
    arguments: {
      fromId: 'cursor-plugin',
      toId: 'auto-pm',
      type: 'uses',
      description: 'Cursor plugin consumes AutoPM MCP tools for IDE integration',
    },
  }));

  console.log(`\n${GREEN}✓ Dependency edge created${RESET}`);

  // ========================================================
  // Step 9: Search
  // ========================================================
  header(9, 'pm_search — Search across all projects');

  console.log(`${DIM}Searching for "sqlite" across all projects and doc types...${RESET}\n`);

  const searchResult = printResult(await client.callTool({
    name: 'pm_search',
    arguments: {
      query: 'sqlite vector search',
    },
  }));

  console.log(`\n${GREEN}✓ Found ${searchResult.results.length} matching documents${RESET}`);

  // ========================================================
  // Step 10: Auto-update from conversation
  // ========================================================
  header(10, 'pm_auto_update — Simulate post-conversation auto-update');

  console.log(`${DIM}Simulating: a conversation just ended where we discussed
implementing the vector search feature and hit a blocking issue...${RESET}\n`);

  printResult(await client.callTool({
    name: 'pm_auto_update',
    arguments: {
      conversationSummary: 'Implemented the basic MCP server with 6 tools and 34 passing tests. Decided to use sqlite-vec for vector search in the next sprint. Discovered that sqlite-vec requires a specific compilation step on macOS. Need to investigate cross-platform build setup. Also added architecture documentation.',
      projectId: 'auto-pm',
    },
  }));

  console.log(`\n${GREEN}✓ Auto-classifier detected multiple update types and applied them${RESET}`);
  console.log(`${DIM}  The classifier checks keywords to route content into appropriate doc slots${RESET}`);

  // ========================================================
  // Step 11: Get full project context
  // ========================================================
  header(11, 'pm_project_context — Get full context (with related projects)');

  console.log(`${DIM}This is what gets injected into your AI conversation for context...${RESET}\n`);

  const ctxResult = printResult(await client.callTool({
    name: 'pm_project_context',
    arguments: {
      projectId: 'auto-pm',
      includeRelated: true,
      maxDepth: 1,
    },
  }));

  // ========================================================
  // Summary
  // ========================================================
  console.log(`\n${GREEN}${'='.repeat(60)}${RESET}`);
  console.log(`${GREEN}${BOLD}  DEMO COMPLETE — All 6 tools exercised successfully!${RESET}`);
  console.log(`${GREEN}${'='.repeat(60)}${RESET}`);
  console.log(`
${BOLD}What happened:${RESET}

  1. ${CYAN}pm_project_create${RESET}  → Registered 2 projects (auto-pm + cursor-plugin)
                          Each got 8 document slots auto-created

  2. ${CYAN}pm_update${RESET}          → Updated 5 doc types manually:
                          • todo (append) — added backlog items
                          • progress (upsert) — replaced sprint status
                          • prd (upsert) — stored requirements
                          • confirm (upsert) — Pending → Confirmed lifecycle
                          • memory (append) — recorded arch decisions

  3. ${CYAN}pm_dependency_add${RESET}  → Created edge: cursor-plugin → auto-pm

  4. ${CYAN}pm_search${RESET}          → Keyword search across all docs

  5. ${CYAN}pm_auto_update${RESET}     → Simulated post-conversation auto-classification
                          Rule-based classifier routed to multiple doc slots

  6. ${CYAN}pm_project_context${RESET} → Retrieved full context with BFS traversal
                          Included related project (cursor-plugin) at depth 1

${BOLD}Database:${RESET} /tmp/pm-demo.db (demo only — delete when done)
${BOLD}Production DB:${RESET} ~/.project-memory/graph.db
`);

  await client.close();
  process.exit(0);
}

main().catch(err => {
  console.error('Demo failed:', err);
  process.exit(1);
});
