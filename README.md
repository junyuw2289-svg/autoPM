# AutoPM — Knowledge Graph Project Memory

> A persistent memory layer for AI-assisted development. Never lose project context across chat sessions again.

**AutoPM** is an [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that gives your AI coding assistant — Cursor, Claude Code, or any MCP-compatible IDE — a structured, queryable, cross-session memory for every project you work on.

---

[English](#why-autopm) | [中文](#为什么需要-autopm)

---

## Why AutoPM?

If you use AI-assisted IDEs to manage multiple projects, you've hit these walls:

| Problem | What happens | How AutoPM fixes it |
|---|---|---|
| **Context amnesia** | Every new chat starts from zero. The AI forgets yesterday's decisions. | 8 persistent document slots per project, automatically updated after each session. |
| **Manual tracking** | You maintain TODOs, decisions, and progress docs by hand — or not at all. | A rule-based classifier extracts TODOs, progress, blockers, and decisions from conversation summaries and files them automatically. |
| **Isolated projects** | Working on a frontend that depends on an API? The AI has no idea. | A knowledge graph with directed edges (`depends_on`, `uses`, `related`) and BFS traversal to pull in cross-project context. |

### What role does it play?

Think of AutoPM as a **project-aware second brain** that sits between you and your AI assistant:

```
You ↔ IDE (Cursor / Claude Code) ↔ AutoPM (MCP Server) ↔ SQLite + Markdown
```

- Before a session, the AI calls `pm_project_context` to load your project's full state.
- During a session, you (or the AI) call `pm_update` to record decisions.
- After a session, `pm_auto_update` classifies the conversation and files updates into the right slots.
- Across projects, `pm_dependency_add` + `pm_search` let you query the entire graph.

---

## Core Concepts

### 8 Document Slots

Every project gets exactly **8 structured documents**, each with a default update mode:

| Slot | Purpose | Mode | Example |
|:-----|:--------|:----:|:--------|
| `todo` | Task backlog | append | `- [ ] Add caching layer` |
| `confirm` | Pending decisions | upsert | `## Q1: Redis or Memcached?` → Pending → Confirmed |
| `progress` | Sprint/milestone status | upsert | `## Current Sprint` — replaced in-place each update |
| `delays` | Blockers & delay logs | append | Date-stamped: reason, impact, mitigation |
| `prd` | Product requirements | upsert | Versioned specs (`## V1.0`, `## V2.0`) |
| `memory` | Architecture decisions & learnings | append | Chronological decision log |
| `notes` | Quick observations | append | Date-stamped free-form notes |
| `qa` | Questions & answers | upsert | Keyed by question, includes code snippets |

**Append** = new content is added at the end. **Upsert** = finds a section by header key and replaces it; if not found, appends.

### Knowledge Graph

Projects are **nodes**. Relationships are **directed edges** with types:

```
mobile-app ──depends_on──▶ api-service ──uses──▶ auth-library
                               │
                          depends_on
                               ▼
                          rpc-service
```

When you request context for `api-service` with `includeRelated: true`, AutoPM does a BFS traversal and pulls in summaries of connected projects — so the AI knows the full picture.

---

## 7 MCP Tools

| Tool | Description |
|:-----|:------------|
| `pm_project_create` | Register a project → auto-creates 8 document slots + syncs to `~/.project-memory/docs/` |
| `pm_update` | Manually update a document slot (append or upsert) |
| `pm_auto_update` | Pass a conversation summary → classifier routes content to the right slots automatically |
| `pm_project_context` | Get full Markdown context (all docs + related projects) for injection into AI conversations |
| `pm_search` | Keyword search across all projects and document types |
| `pm_dependency_add` | Create a directed edge between two projects |
| `pm_sync` | Force-sync all documents from DB to `.md` files on disk |

---

## Usage Scenarios

### Scenario: Managing 3 Projects Simultaneously

You're building a **mobile app**, an **API service**, and a **shared auth library** at the same time. Here's how AutoPM keeps everything organized.

#### Step 1 — Register all projects

```jsonc
// pm_project_create
{ "name": "mobile-app",    "path": "/code/mobile-app",    "techStack": ["React Native", "TypeScript"] }
{ "name": "api-service",   "path": "/code/api-service",   "techStack": ["Go", "Gin", "PostgreSQL"] }
{ "name": "auth-library",  "path": "/code/auth-library",  "techStack": ["Go", "JWT"] }
```

Each project now has 8 empty document templates on disk:

```
~/.project-memory/docs/
├── mobile-app/
│   ├── todo.md
│   ├── confirm.md
│   ├── progress.md
│   ├── delays.md
│   ├── prd.md
│   ├── memory.md
│   ├── notes.md
│   └── qa.md
├── api-service/
│   └── ... (same 8 files)
└── auth-library/
    └── ... (same 8 files)
```

#### Step 2 — Wire up dependencies

```jsonc
// pm_dependency_add
{ "fromId": "mobile-app",  "toId": "api-service",  "type": "depends_on", "description": "Calls REST API" }
{ "fromId": "api-service",  "toId": "auth-library", "type": "uses",       "description": "JWT validation middleware" }
{ "fromId": "mobile-app",  "toId": "auth-library",  "type": "uses",       "description": "Token refresh logic" }
```

Now the graph knows: `mobile-app → api-service → auth-library`.

#### Step 3 — Daily workflow

**Morning** — switching to the API project, AI loads context automatically:

```jsonc
// pm_project_context
{ "projectId": "api-service", "includeRelated": true, "maxDepth": 1 }
```

Returns a Markdown document containing:
- All 8 docs for `api-service` (current TODO, progress, decisions...)
- Summary of `auth-library` (because it `uses` it)
- Summary of `mobile-app` (because it `depends_on` api-service)

The AI now knows: *"The mobile team is waiting on the `/users` endpoint, and auth-library just shipped JWT refresh support."*

**During work** — you decide to switch from REST to gRPC. Record the decision:

```jsonc
// pm_update
{
  "projectId": "api-service",
  "docType": "confirm",
  "content": "## Q1: REST or gRPC for internal services?\n**Status:** Confirmed\n**Decision:** gRPC\n**Reason:** Need bidirectional streaming for real-time notifications",
  "mode": "upsert"
}
```

**After a session** — the AI summarizes the conversation and auto-updates:

```jsonc
// pm_auto_update
{
  "projectId": "api-service",
  "conversationSummary": "Implemented gRPC service definitions for user and notification services. Discovered that the Go gRPC gateway needs a specific protobuf version. Need to update auth-library to support gRPC metadata. Added pagination to the user list endpoint."
}
```

The classifier automatically routes this to:
- `progress` (upsert) — "Implemented gRPC service definitions..."
- `todo` (append) — "Need to update auth-library..."
- `delays` (append) — "protobuf version issue..."
- `memory` (append) — architecture decision recorded

#### Step 4 — Cross-project search

A week later, you can't remember where you discussed protobuf versioning:

```jsonc
// pm_search
{ "query": "protobuf version gRPC" }
```

Returns ranked results across all 3 projects, with relevant snippets highlighted.

---

### Scenario: Decision Lifecycle (Pending → Confirmed)

Track technical decisions from question to resolution:

```jsonc
// Day 1: Raise the question
// pm_update
{
  "projectId": "mobile-app",
  "docType": "confirm",
  "content": "## Q1: State management — Redux vs Zustand?\n**Status:** Pending\n**Options:**\n- Redux: mature, large ecosystem, more boilerplate\n- Zustand: lightweight, less boilerplate, smaller community",
  "mode": "upsert"
}

// Day 3: Decision made — upsert replaces the same Q1 section
// pm_update
{
  "projectId": "mobile-app",
  "docType": "confirm",
  "content": "## Q1: State management — Redux vs Zustand?\n**Status:** Confirmed\n**Decision:** Zustand\n**Reason:** Simpler API, sufficient for our use case, 3x less boilerplate",
  "mode": "upsert"
}
```

The `confirm` doc now has the resolved decision — no duplicates, clean history.

---

## Quick Start

### 1. Build

```bash
git clone <repo-url> && cd autoPM
npm install
npm run build
```

### 2. Configure MCP

Add to your MCP client config (e.g. `~/.cursor/mcp.json` or Claude Code settings):

```json
{
  "mcpServers": {
    "project-memory": {
      "command": "node",
      "args": ["/path/to/autoPM/dist/index.js"]
    }
  }
}
```

### 3. Run the demo

```bash
npm run build && node demo.mjs
```

Walks through all 7 tools step-by-step with a real SQLite database.

### 4. Run tests

```bash
npm test
```

---

## Tech Stack

| Component | Technology |
|:----------|:-----------|
| Runtime | Node.js + TypeScript |
| Protocol | MCP SDK (stdio transport) |
| Database | SQLite via better-sqlite3 (WAL mode) |
| Storage | `~/.project-memory/docs/` (human-readable Markdown) |
| Testing | Vitest |

### Project Structure

```
src/
├── index.ts              # Entry point
├── server.ts             # MCP server + tool definitions
├── types.ts              # TypeScript interfaces & constants
├── db/
│   ├── connection.ts     # SQLite connection + schema init
│   └── schema.ts         # 6 tables (projects, documents, edges, versions, logs)
├── models/
│   ├── project.ts        # Project CRUD + 8-slot creation
│   ├── document.ts       # Append / upsert logic
│   ├── edge.ts           # Graph edge management
│   └── conversation.ts   # Session logging
├── engine/
│   ├── graph.ts          # BFS traversal + context builder
│   └── search.ts         # Keyword search + TF scoring
├── filesystem/
│   └── sync.ts           # DB → Markdown file sync
└── tools/
    └── handlers.ts       # All 7 tool implementations
```

---

## Roadmap

- [x] SQLite schema + 4 data models
- [x] 7 MCP tools (create, update, auto-update, context, search, dependency, sync)
- [x] Graph engine with BFS traversal
- [x] Keyword search engine
- [x] Filesystem sync to Markdown
- [ ] Vector search via sqlite-vec
- [ ] LLM-based conversation classifier (upgrade from rule-based)
- [ ] Web UI with D3.js force-directed graph
- [ ] Cross-project breaking change alerts
- [ ] Multi-user shared graphs

---

# 中文文档

## 为什么需要 AutoPM？

如果你在用 Cursor、Claude Code 或其他 AI 编程助手同时管理多个项目，一定遇到过这些问题：

| 痛点 | 具体表现 | AutoPM 怎么解决 |
|:-----|:---------|:----------------|
| **上下文失忆** | 每次新对话从零开始，AI 不记得昨天做的决定 | 每个项目 8 个持久化文档槽位，会话结束后自动更新 |
| **手动管理负担** | TODO、技术决策、进度全靠自己维护——或者根本不维护 | 规则分类器从对话摘要中自动提取 TODO、进度、阻塞和决策 |
| **项目之间互相隔离** | 前端依赖后端 API，但 AI 完全不知道另一个项目的状态 | 知识图谱 + 有向边（`depends_on`、`uses`、`related`）+ BFS 遍历拉取跨项目上下文 |

### 它扮演什么角色？

AutoPM 是一个**项目感知的第二大脑**，架设在你和 AI 助手之间：

```
你 ↔ IDE（Cursor / Claude Code）↔ AutoPM（MCP 服务器）↔ SQLite + Markdown 文件
```

- **会话前**：AI 调用 `pm_project_context` 加载项目完整状态
- **会话中**：你或 AI 调用 `pm_update` 记录决策
- **会话后**：`pm_auto_update` 对对话内容自动分类归档
- **跨项目**：`pm_dependency_add` + `pm_search` 在整个知识图谱中查询

---

## 核心概念

### 8 个文档槽位

每个项目自动创建 **8 个结构化文档**，各有默认更新模式：

| 槽位 | 用途 | 模式 | 示例 |
|:-----|:-----|:----:|:-----|
| `todo` | 任务清单 | 追加 | `- [ ] 添加缓存层` |
| `confirm` | 待确认决策 | 更新插入 | `## Q1: 用 Redis 还是 Memcached？` → 待定 → 已确认 |
| `progress` | 迭代/里程碑进度 | 更新插入 | `## 当前迭代` — 每次更新原地替换 |
| `delays` | 阻塞与延迟日志 | 追加 | 按日期记录：原因、影响、应对措施 |
| `prd` | 产品需求文档 | 更新插入 | 按版本管理（`## V1.0`、`## V2.0`） |
| `memory` | 架构决策与技术经验 | 追加 | 按时间线记录的决策日志 |
| `notes` | 随手记录 | 追加 | 按日期的自由格式笔记 |
| `qa` | 问答记录 | 更新插入 | 以问题为键，包含代码片段和标签 |

**追加 (append)** = 新内容添加到末尾。**更新插入 (upsert)** = 按标题匹配已有段落并替换，不存在则追加。

### 知识图谱

项目是**节点**，关系是**有向边**：

```
移动端 App ──depends_on──▶ API 服务 ──uses──▶ 认证库
                              │
                         depends_on
                              ▼
                          RPC 服务
```

查询 `API 服务` 上下文时设置 `includeRelated: true`，AutoPM 会进行 BFS 遍历，拉取关联项目的摘要——让 AI 了解全局。

---

## 使用场景

### 场景：同时管理 3 个项目

你正在同时开发一个**移动端 App**、一个**API 服务**和一个**共享认证库**。

#### 第一步 — 注册所有项目

```jsonc
// pm_project_create
{ "name": "mobile-app",    "path": "/code/mobile-app",    "techStack": ["React Native", "TypeScript"] }
{ "name": "api-service",   "path": "/code/api-service",   "techStack": ["Go", "Gin", "PostgreSQL"] }
{ "name": "auth-library",  "path": "/code/auth-library",  "techStack": ["Go", "JWT"] }
```

每个项目在磁盘上生成 8 个 Markdown 文件：

```
~/.project-memory/docs/
├── mobile-app/
│   ├── todo.md        # 任务清单
│   ├── confirm.md     # 待确认决策
│   ├── progress.md    # 当前进度
│   ├── delays.md      # 延迟日志
│   ├── prd.md         # 产品需求
│   ├── memory.md      # 架构决策
│   ├── notes.md       # 随手记录
│   └── qa.md          # 问答记录
├── api-service/
│   └── ...（同样 8 个文件）
└── auth-library/
    └── ...（同样 8 个文件）
```

#### 第二步 — 建立依赖关系

```jsonc
// pm_dependency_add
{ "fromId": "mobile-app",  "toId": "api-service",  "type": "depends_on", "description": "调用 REST API" }
{ "fromId": "api-service", "toId": "auth-library",  "type": "uses",       "description": "JWT 验证中间件" }
{ "fromId": "mobile-app",  "toId": "auth-library",  "type": "uses",       "description": "Token 刷新逻辑" }
```

#### 第三步 — 日常工作流

**早上** — 切换到 API 项目，AI 自动加载上下文：

```jsonc
// pm_project_context
{ "projectId": "api-service", "includeRelated": true, "maxDepth": 1 }
```

返回一份 Markdown 文档，包含：
- `api-service` 的全部 8 个文档（当前 TODO、进度、决策...）
- `auth-library` 的摘要（因为 `uses` 关系）
- `mobile-app` 的摘要（因为它 `depends_on` api-service）

AI 现在知道：*"移动端团队在等 `/users` 接口，认证库刚上线了 JWT 刷新功能。"*

**工作中** — 决定从 REST 切换到 gRPC，记录决策：

```jsonc
// pm_update
{
  "projectId": "api-service",
  "docType": "confirm",
  "content": "## Q1: 内部服务用 REST 还是 gRPC？\n**状态：** 已确认\n**决定：** gRPC\n**原因：** 需要双向流式传输来支持实时通知",
  "mode": "upsert"
}
```

**会话结束后** — AI 总结对话并自动归档：

```jsonc
// pm_auto_update
{
  "projectId": "api-service",
  "conversationSummary": "实现了 user 和 notification 的 gRPC 服务定义。发现 Go gRPC gateway 需要特定版本的 protobuf。需要更新 auth-library 以支持 gRPC metadata。给用户列表接口加了分页。"
}
```

分类器自动路由到：
- `progress`（更新插入）— "实现了 gRPC 服务定义..."
- `todo`（追加）— "需要更新 auth-library..."
- `delays`（追加）— "protobuf 版本问题..."
- `memory`（追加）— 架构决策已记录

#### 第四步 — 跨项目搜索

一周后，想不起在哪里讨论过 protobuf 版本问题：

```jsonc
// pm_search
{ "query": "protobuf version gRPC" }
```

返回跨 3 个项目的排序结果，附带相关片段。

---

### 场景：决策生命周期（待定 → 已确认）

```jsonc
// 第 1 天：提出问题
// pm_update
{
  "projectId": "mobile-app",
  "docType": "confirm",
  "content": "## Q1: 状态管理用 Redux 还是 Zustand？\n**状态：** 待定\n**选项：**\n- Redux：成熟、生态大、模板代码多\n- Zustand：轻量、模板少、社区小",
  "mode": "upsert"
}

// 第 3 天：做出决定 — upsert 替换同一个 Q1 段落
// pm_update
{
  "projectId": "mobile-app",
  "docType": "confirm",
  "content": "## Q1: 状态管理用 Redux 还是 Zustand？\n**状态：** 已确认\n**决定：** Zustand\n**原因：** API 更简洁，满足需求，模板代码减少 3 倍",
  "mode": "upsert"
}
```

`confirm` 文档中 Q1 被原地替换——没有重复，历史清晰。

---

## 快速开始

### 1. 构建

```bash
git clone <repo-url> && cd autoPM
npm install
npm run build
```

### 2. 配置 MCP

添加到你的 MCP 客户端配置（如 `~/.cursor/mcp.json` 或 Claude Code 设置）：

```json
{
  "mcpServers": {
    "project-memory": {
      "command": "node",
      "args": ["/path/to/autoPM/dist/index.js"]
    }
  }
}
```

### 3. 运行演示

```bash
npm run build && node demo.mjs
```

### 4. 运行测试

```bash
npm test
```

---

## 技术栈

| 组件 | 技术 |
|:-----|:-----|
| 运行时 | Node.js + TypeScript |
| 协议 | MCP SDK（stdio 传输） |
| 数据库 | SQLite via better-sqlite3（WAL 模式） |
| 存储 | `~/.project-memory/docs/`（人类可读 Markdown） |
| 测试 | Vitest |

---

## License

MIT
