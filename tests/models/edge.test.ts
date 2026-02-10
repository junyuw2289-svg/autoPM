import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createTestDb } from '../setup.js';
import { ProjectModel } from '../../src/models/project.js';
import { EdgeModel } from '../../src/models/edge.js';

describe('EdgeModel', () => {
  let db: Database.Database;
  let projectModel: ProjectModel;
  let edgeModel: EdgeModel;
  let projectA: string;
  let projectB: string;
  let projectC: string;

  beforeEach(() => {
    db = createTestDb();
    projectModel = new ProjectModel(db);
    edgeModel = new EdgeModel(db);

    const a = projectModel.create({ name: 'api-service', path: '/tmp/api' });
    const b = projectModel.create({ name: 'rpc-service', path: '/tmp/rpc' });
    const c = projectModel.create({ name: 'frontend', path: '/tmp/fe' });
    projectA = a.id;
    projectB = b.id;
    projectC = c.id;
  });

  it('should create an edge between projects', () => {
    const edge = edgeModel.create({
      fromId: projectA,
      toId: projectB,
      type: 'depends_on',
      description: 'API depends on RPC service',
    });

    expect(edge.id).toBeDefined();
    expect(edge.from_id).toBe(projectA);
    expect(edge.to_id).toBe(projectB);
    expect(edge.type).toBe('depends_on');
  });

  it('should get outgoing edges', () => {
    edgeModel.create({ fromId: projectA, toId: projectB, type: 'depends_on' });
    edgeModel.create({ fromId: projectA, toId: projectC, type: 'uses' });

    const outgoing = edgeModel.getOutgoing(projectA);
    expect(outgoing).toHaveLength(2);
  });

  it('should get incoming edges', () => {
    edgeModel.create({ fromId: projectA, toId: projectB, type: 'depends_on' });
    edgeModel.create({ fromId: projectC, toId: projectB, type: 'uses' });

    const incoming = edgeModel.getIncoming(projectB);
    expect(incoming).toHaveLength(2);
  });

  it('should get neighbor IDs', () => {
    edgeModel.create({ fromId: projectA, toId: projectB, type: 'depends_on' });
    edgeModel.create({ fromId: projectC, toId: projectA, type: 'uses' });

    const neighbors = edgeModel.getNeighborIds(projectA);
    expect(neighbors).toHaveLength(2);
    expect(neighbors).toContain(projectB);
    expect(neighbors).toContain(projectC);
  });

  it('should delete an edge', () => {
    const edge = edgeModel.create({ fromId: projectA, toId: projectB, type: 'related' });
    const deleted = edgeModel.delete(edge.id);
    expect(deleted).toBe(true);

    const outgoing = edgeModel.getOutgoing(projectA);
    expect(outgoing).toHaveLength(0);
  });
});
