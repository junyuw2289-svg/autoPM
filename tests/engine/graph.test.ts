import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createTestDb } from '../setup.js';
import { ProjectModel } from '../../src/models/project.js';
import { EdgeModel } from '../../src/models/edge.js';
import { GraphEngine } from '../../src/engine/graph.js';

describe('GraphEngine', () => {
  let db: Database.Database;
  let projectModel: ProjectModel;
  let edgeModel: EdgeModel;
  let graphEngine: GraphEngine;

  beforeEach(() => {
    db = createTestDb();
    projectModel = new ProjectModel(db);
    edgeModel = new EdgeModel(db);
    graphEngine = new GraphEngine(db);
  });

  it('should get project context without related', () => {
    const project = projectModel.create({ name: 'solo-proj', path: '/tmp/solo' });

    const ctx = graphEngine.getProjectContext(project.id);
    expect(ctx).not.toBeNull();
    expect(ctx!.project.name).toBe('solo-proj');
    expect(ctx!.documents).toHaveLength(8);
    expect(ctx!.edges).toHaveLength(0);
    expect(ctx!.related).toHaveLength(0);
  });

  it('should get project context with related projects (depth=1)', () => {
    const api = projectModel.create({ name: 'api', path: '/tmp/api' });
    const rpc = projectModel.create({ name: 'rpc', path: '/tmp/rpc' });
    const fe = projectModel.create({ name: 'frontend', path: '/tmp/fe' });

    edgeModel.create({ fromId: api.id, toId: rpc.id, type: 'depends_on', description: 'API calls RPC' });
    edgeModel.create({ fromId: fe.id, toId: api.id, type: 'uses', description: 'Frontend uses API' });

    const ctx = graphEngine.getProjectContext(api.id, true, 1);
    expect(ctx).not.toBeNull();
    expect(ctx!.project.name).toBe('api');
    expect(ctx!.edges).toHaveLength(2);
    expect(ctx!.related).toHaveLength(2);

    const relatedNames = ctx!.related.map(r => r.project.name).sort();
    expect(relatedNames).toEqual(['frontend', 'rpc']);
  });

  it('should limit traversal depth', () => {
    const a = projectModel.create({ name: 'a', path: '/tmp/a' });
    const b = projectModel.create({ name: 'b', path: '/tmp/b' });
    const c = projectModel.create({ name: 'c', path: '/tmp/c' });

    edgeModel.create({ fromId: a.id, toId: b.id, type: 'depends_on' });
    edgeModel.create({ fromId: b.id, toId: c.id, type: 'depends_on' });

    // Depth 1: should only get b, not c
    const ctx1 = graphEngine.getProjectContext(a.id, true, 1);
    expect(ctx1!.related).toHaveLength(1);
    expect(ctx1!.related[0].project.name).toBe('b');

    // Depth 2: should get both b and c
    const ctx2 = graphEngine.getProjectContext(a.id, true, 2);
    expect(ctx2!.related).toHaveLength(2);
  });

  it('should format context as markdown', () => {
    const project = projectModel.create({
      name: 'md-test',
      path: '/tmp/md',
      techStack: ['TypeScript'],
    });

    const ctx = graphEngine.getProjectContext(project.id);
    const md = graphEngine.formatContextAsMarkdown(ctx!);

    expect(md).toContain('# Project: md-test');
    expect(md).toContain('**Tech Stack:** TypeScript');
    expect(md).toContain('[TODO]');
    expect(md).toContain('[PROGRESS]');
  });

  it('should not visit nodes twice (cycle prevention)', () => {
    const a = projectModel.create({ name: 'cycle-a', path: '/tmp/ca' });
    const b = projectModel.create({ name: 'cycle-b', path: '/tmp/cb' });

    // Create a cycle
    edgeModel.create({ fromId: a.id, toId: b.id, type: 'related' });
    edgeModel.create({ fromId: b.id, toId: a.id, type: 'related' });

    const ctx = graphEngine.getProjectContext(a.id, true, 3);
    // Should only have b once, not infinite
    expect(ctx!.related).toHaveLength(1);
    expect(ctx!.related[0].project.name).toBe('cycle-b');
  });
});
