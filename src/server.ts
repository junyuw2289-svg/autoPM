import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type Database from 'better-sqlite3';
import { ToolHandlers } from './tools/handlers.js';
import type { DocType, UpdateMode, EdgeType } from './types.js';

export function createServer(db: Database.Database): Server {
  const server = new Server(
    { name: 'project-memory', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  const handlers = new ToolHandlers(db);

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'pm_project_create',
        description: 'Initialize a new project with 8 document templates',
        inputSchema: {
          type: 'object' as const,
          properties: {
            name: { type: 'string', description: 'Unique project slug (e.g., eino-tracer)' },
            path: { type: 'string', description: 'Filesystem path to the project' },
            techStack: {
              type: 'array',
              items: { type: 'string' },
              description: 'Technology stack (e.g., ["Go", "Eino"])',
            },
            parentId: { type: 'string', description: 'Parent project ID for parent-child relationships' },
            displayName: { type: 'string', description: 'Human-readable project name' },
          },
          required: ['name', 'path'],
        },
      },
      {
        name: 'pm_update',
        description: 'Manually update a specific document (upsert or append)',
        inputSchema: {
          type: 'object' as const,
          properties: {
            projectId: { type: 'string', description: 'Project ID or name' },
            docType: {
              type: 'string',
              enum: ['todo', 'confirm', 'progress', 'delays', 'prd', 'memory', 'notes', 'qa'],
              description: 'Document type to update',
            },
            content: { type: 'string', description: 'Content to add/update' },
            mode: {
              type: 'string',
              enum: ['upsert', 'append'],
              description: 'Update mode (defaults to doc type default)',
            },
            metadata: {
              type: 'object',
              description: 'Optional metadata (e.g., changeSummary)',
            },
          },
          required: ['projectId', 'docType', 'content'],
        },
      },
      {
        name: 'pm_auto_update',
        description: 'Auto-classify and batch-update documents from a conversation summary',
        inputSchema: {
          type: 'object' as const,
          properties: {
            conversationSummary: { type: 'string', description: 'Summary of the conversation' },
            projectId: { type: 'string', description: 'Project ID or name (optional, for auto-detection)' },
          },
          required: ['conversationSummary'],
        },
      },
      {
        name: 'pm_project_context',
        description: 'Get full project context including related projects for conversation injection',
        inputSchema: {
          type: 'object' as const,
          properties: {
            projectId: { type: 'string', description: 'Project ID or name' },
            includeRelated: { type: 'boolean', description: 'Include related projects', default: false },
            maxDepth: { type: 'number', description: 'Max traversal depth for related projects', default: 1 },
          },
          required: ['projectId'],
        },
      },
      {
        name: 'pm_search',
        description: 'Search across documents and projects using keyword matching',
        inputSchema: {
          type: 'object' as const,
          properties: {
            query: { type: 'string', description: 'Search query text' },
            projectId: { type: 'string', description: 'Limit search to specific project' },
            docTypes: {
              type: 'array',
              items: { type: 'string', enum: ['todo', 'confirm', 'progress', 'delays', 'prd', 'memory', 'notes', 'qa'] },
              description: 'Filter by document types',
            },
            includeRelated: { type: 'boolean', description: 'Include related projects in search' },
          },
          required: ['query'],
        },
      },
      {
        name: 'pm_dependency_add',
        description: 'Create a directed dependency between two projects',
        inputSchema: {
          type: 'object' as const,
          properties: {
            fromId: { type: 'string', description: 'Source project ID or name' },
            toId: { type: 'string', description: 'Target project ID or name' },
            type: {
              type: 'string',
              enum: ['depends_on', 'uses', 'related', 'parent_child'],
              description: 'Relationship type',
            },
            description: { type: 'string', description: 'Description of the relationship' },
          },
          required: ['fromId', 'toId', 'type'],
        },
      },
      {
        name: 'pm_sync',
        description: 'Sync all documents from database to .md files on disk (~/.project-memory/docs/)',
        inputSchema: {
          type: 'object' as const,
          properties: {
            projectId: { type: 'string', description: 'Project ID or name (omit to sync all projects)' },
          },
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    let result: any;

    switch (name) {
      case 'pm_project_create':
        result = await handlers.pmProjectCreate(args as any);
        break;
      case 'pm_update':
        result = await handlers.pmUpdate(args as any);
        break;
      case 'pm_auto_update':
        result = await handlers.pmAutoUpdate(args as any);
        break;
      case 'pm_project_context':
        result = await handlers.pmProjectContext(args as any);
        break;
      case 'pm_search':
        result = await handlers.pmSearch(args as any);
        break;
      case 'pm_dependency_add':
        result = await handlers.pmDependencyAdd(args as any);
        break;
      case 'pm_sync':
        result = await handlers.pmSync(args as any);
        break;
      default:
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: `Unknown tool: ${name}` }) }],
          isError: true,
        };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      isError: !result.success,
    };
  });

  return server;
}
