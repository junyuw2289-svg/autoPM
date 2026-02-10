import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import type { ProjectEdge, EdgeType } from '../types.js';

export class EdgeModel {
  constructor(private db: Database.Database) {}

  create(params: {
    fromId: string;
    toId: string;
    type: EdgeType;
    description?: string;
    strength?: number;
    bidirectional?: boolean;
  }): ProjectEdge {
    const now = new Date().toISOString();
    const id = uuidv4();

    const edge: ProjectEdge = {
      id,
      from_id: params.fromId,
      to_id: params.toId,
      type: params.type,
      description: params.description || '',
      strength: params.strength ?? 0.5,
      bidirectional: params.bidirectional ?? false,
      created_at: now,
    };

    this.db.prepare(`
      INSERT INTO project_edges (id, from_id, to_id, type, description, strength, bidirectional, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      edge.id,
      edge.from_id,
      edge.to_id,
      edge.type,
      edge.description,
      edge.strength,
      edge.bidirectional ? 1 : 0,
      edge.created_at,
    );

    return edge;
  }

  getOutgoing(projectId: string): ProjectEdge[] {
    const rows = this.db.prepare(
      'SELECT * FROM project_edges WHERE from_id = ?'
    ).all(projectId) as any[];
    return rows.map(r => this.rowToEdge(r));
  }

  getIncoming(projectId: string): ProjectEdge[] {
    const rows = this.db.prepare(
      'SELECT * FROM project_edges WHERE to_id = ?'
    ).all(projectId) as any[];
    return rows.map(r => this.rowToEdge(r));
  }

  getAllForProject(projectId: string): ProjectEdge[] {
    const rows = this.db.prepare(
      'SELECT * FROM project_edges WHERE from_id = ? OR to_id = ?'
    ).all(projectId, projectId) as any[];
    return rows.map(r => this.rowToEdge(r));
  }

  getNeighborIds(projectId: string): string[] {
    const edges = this.getAllForProject(projectId);
    const neighbors = new Set<string>();
    for (const edge of edges) {
      if (edge.from_id === projectId) {
        neighbors.add(edge.to_id);
      }
      if (edge.to_id === projectId) {
        neighbors.add(edge.from_id);
      }
      // For bidirectional edges, add both directions
      if (edge.bidirectional) {
        neighbors.add(edge.from_id);
        neighbors.add(edge.to_id);
      }
    }
    neighbors.delete(projectId);
    return Array.from(neighbors);
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM project_edges WHERE id = ?').run(id);
    return result.changes > 0;
  }

  private rowToEdge(row: any): ProjectEdge {
    return {
      ...row,
      bidirectional: Boolean(row.bidirectional),
    };
  }
}
