import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createTestDb } from '../setup.js';
import { ToolHandlers } from '../../src/tools/handlers.js';

describe('Happy Path - End-to-End', () => {
  let db: Database.Database;
  let tools: ToolHandlers;

  beforeEach(() => {
    db = createTestDb();
    tools = new ToolHandlers(db);
  });

  it('should complete full project lifecycle', async () => {
    // =============================================
    // Step 1: Create two projects
    // =============================================
    const apiResult = await tools.pmProjectCreate({
      name: 'api-service',
      path: '/workspace/api-service',
      techStack: ['Go', 'Eino'],
      displayName: 'API Service',
    });

    expect(apiResult.success).toBe(true);
    expect(apiResult.project!.name).toBe('api-service');
    expect(apiResult.project!.documents).toHaveLength(8);

    const rpcResult = await tools.pmProjectCreate({
      name: 'rpc-service',
      path: '/workspace/rpc-service',
      techStack: ['Go', 'gRPC'],
      displayName: 'RPC Service',
    });

    expect(rpcResult.success).toBe(true);

    // Duplicate name should fail
    const dupResult = await tools.pmProjectCreate({
      name: 'api-service',
      path: '/workspace/api-service-2',
    });
    expect(dupResult.success).toBe(false);
    expect(dupResult.error).toContain('already exists');

    // =============================================
    // Step 2: Manually update documents
    // =============================================

    // Add a TODO
    const todoResult = await tools.pmUpdate({
      projectId: 'api-service',
      docType: 'todo',
      content: '## 2025-02-10\n- [ ] Implement caching layer\n- [ ] Add rate limiting',
      mode: 'append',
    });
    expect(todoResult.success).toBe(true);
    expect(todoResult.document!.version).toBe(2);

    // Update progress
    const progressResult = await tools.pmUpdate({
      projectId: 'api-service',
      docType: 'progress',
      content: '## Current Sprint\n**Status:** In progress\n**Completed:** Auth middleware, DB schema\n**Next:** Caching layer',
      mode: 'upsert',
    });
    expect(progressResult.success).toBe(true);

    // Add a confirmation question
    const confirmResult = await tools.pmUpdate({
      projectId: 'api-service',
      docType: 'confirm',
      content: '## Q1: Use Redis or Memcached for caching?\n**Status:** Pending',
      mode: 'upsert',
    });
    expect(confirmResult.success).toBe(true);

    // Now confirm it (upsert same key)
    const confirmUpdate = await tools.pmUpdate({
      projectId: 'api-service',
      docType: 'confirm',
      content: '## Q1: Use Redis or Memcached for caching?\n**Status:** Confirmed\n**Decision:** Redis\n**Reason:** Better data structure support',
      mode: 'upsert',
    });
    expect(confirmUpdate.success).toBe(true);

    // Add PRD
    const prdResult = await tools.pmUpdate({
      projectId: 'api-service',
      docType: 'prd',
      content: '## V1.0\n### Requirements\n- RESTful API for user management\n- JWT authentication\n- Rate limiting (100 req/min)\n- Redis caching layer',
      mode: 'upsert',
    });
    expect(prdResult.success).toBe(true);

    // Add memory
    const memoryResult = await tools.pmUpdate({
      projectId: 'api-service',
      docType: 'memory',
      content: '## Architecture Decisions\n- Chose Go + Eino for high performance\n- Using layered architecture: handler → service → repository',
      mode: 'append',
    });
    expect(memoryResult.success).toBe(true);

    // =============================================
    // Step 3: Add dependency between projects
    // =============================================
    const depResult = await tools.pmDependencyAdd({
      fromId: 'api-service',
      toId: 'rpc-service',
      type: 'depends_on',
      description: 'API service calls RPC service for internal operations',
    });
    expect(depResult.success).toBe(true);
    expect(depResult.edge!.from).toBe('api-service');
    expect(depResult.edge!.to).toBe('rpc-service');

    // =============================================
    // Step 4: Get project context
    // =============================================
    const contextResult = await tools.pmProjectContext({
      projectId: 'api-service',
      includeRelated: false,
    });
    expect(contextResult.success).toBe(true);
    expect(contextResult.context).toContain('API Service');
    expect(contextResult.context).toContain('Go, Eino');
    expect(contextResult.context).toContain('Implement caching');

    // With related projects
    const relatedContext = await tools.pmProjectContext({
      projectId: 'api-service',
      includeRelated: true,
      maxDepth: 1,
    });
    expect(relatedContext.success).toBe(true);
    expect(relatedContext.context).toContain('RPC Service');
    expect(relatedContext.context).toContain('depends_on');

    // =============================================
    // Step 5: Search across projects
    // =============================================
    const searchResult = await tools.pmSearch({
      query: 'caching Redis',
    });
    expect(searchResult.success).toBe(true);
    expect(searchResult.results!.length).toBeGreaterThan(0);

    // At least one result should mention caching
    const hasCaching = searchResult.results!.some(r => r.content.toLowerCase().includes('caching'));
    expect(hasCaching).toBe(true);

    // Search within specific project
    const scopedSearch = await tools.pmSearch({
      query: 'caching',
      projectId: 'rpc-service',
    });
    expect(scopedSearch.success).toBe(true);
    // RPC service docs shouldn't have caching content
    expect(scopedSearch.results!.length).toBe(0);

    // =============================================
    // Step 6: Auto-update from conversation
    // =============================================
    const autoResult = await tools.pmAutoUpdate({
      conversationSummary: 'Implemented the Redis caching layer. Decided to use a 5-minute TTL. Need to add cache invalidation logic next. Found a bug with nil pointer in the cache key generator.',
      projectId: 'api-service',
    });
    expect(autoResult.success).toBe(true);
    expect(autoResult.updates!.length).toBeGreaterThan(0);

    // Should have created updates for multiple doc types
    const updatedTypes = autoResult.updates!.map((u: any) => u.docType);
    // The classifier should pick up: progress (implemented), todo (need to), delays (bug)
    expect(updatedTypes.length).toBeGreaterThanOrEqual(2);

    // =============================================
    // Step 7: Verify final state
    // =============================================
    const finalContext = await tools.pmProjectContext({
      projectId: 'api-service',
      includeRelated: true,
      maxDepth: 1,
    });
    expect(finalContext.success).toBe(true);

    // Should contain all the updates we made
    const ctx = finalContext.context!;
    expect(ctx).toContain('Implement caching');
    expect(ctx).toContain('Redis');
    expect(ctx).toContain('RPC Service');

    console.log('\n=== HAPPY PATH COMPLETED SUCCESSFULLY ===\n');
    console.log('Final context preview (first 1000 chars):');
    console.log(ctx.slice(0, 1000));
  });

  it('should handle errors gracefully', async () => {
    // Non-existent project
    const result = await tools.pmUpdate({
      projectId: 'nonexistent',
      docType: 'todo',
      content: 'test',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');

    // Non-existent project for context
    const ctxResult = await tools.pmProjectContext({
      projectId: 'nonexistent',
    });
    expect(ctxResult.success).toBe(false);

    // Non-existent source for dependency
    const depResult = await tools.pmDependencyAdd({
      fromId: 'nonexistent',
      toId: 'also-nonexistent',
      type: 'depends_on',
    });
    expect(depResult.success).toBe(false);
  });

  it('should support document version history', async () => {
    await tools.pmProjectCreate({
      name: 'versioned',
      path: '/tmp/versioned',
    });

    // Make several updates
    await tools.pmUpdate({
      projectId: 'versioned',
      docType: 'notes',
      content: '## V1\nFirst note',
    });

    await tools.pmUpdate({
      projectId: 'versioned',
      docType: 'notes',
      content: '## V2\nSecond note',
    });

    await tools.pmUpdate({
      projectId: 'versioned',
      docType: 'notes',
      content: '## V3\nThird note',
    });

    // Check that versions were created
    const doc = db.prepare(
      "SELECT id FROM documents WHERE project_id = (SELECT id FROM project_nodes WHERE name = 'versioned') AND doc_type = 'notes'"
    ).get() as any;

    const versions = db.prepare(
      'SELECT * FROM document_versions WHERE document_id = ? ORDER BY version_number DESC'
    ).all(doc.id) as any[];

    expect(versions.length).toBe(3);
    expect(versions[0].version_number).toBe(4); // initial is 1, then 3 updates
  });
});
