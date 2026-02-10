import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import type { ProjectNode, ProjectType, ProjectStatus, DocType } from '../types.js';
import { ALL_DOC_TYPES, DEFAULT_UPDATE_MODES, DOC_TEMPLATES } from '../types.js';

export class ProjectModel {
  constructor(private db: Database.Database) {}

  create(params: {
    name: string;
    displayName?: string;
    path: string;
    type?: ProjectType;
    techStack?: string[];
    owner?: string;
    parentId?: string;
  }): ProjectNode {
    const now = new Date().toISOString();
    const id = uuidv4();

    const project: ProjectNode = {
      id,
      name: params.name,
      display_name: params.displayName || params.name,
      path: params.path,
      type: params.type || 'project',
      tech_stack: params.techStack || [],
      owner: params.owner || '',
      status: 'active',
      created_at: now,
      updated_at: now,
    };

    this.db.prepare(`
      INSERT INTO project_nodes (id, name, display_name, path, type, tech_stack, owner, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      project.id,
      project.name,
      project.display_name,
      project.path,
      project.type,
      JSON.stringify(project.tech_stack),
      project.owner,
      project.status,
      project.created_at,
      project.updated_at,
    );

    // Create 8 document slots
    const insertDoc = this.db.prepare(`
      INSERT INTO documents (id, project_id, doc_type, file_path, update_mode, content, version, last_modified)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `);

    const createDocs = this.db.transaction(() => {
      for (const docType of ALL_DOC_TYPES) {
        const filePath = `${params.name}/${docType}.md`;
        insertDoc.run(
          uuidv4(),
          id,
          docType,
          filePath,
          DEFAULT_UPDATE_MODES[docType],
          DOC_TEMPLATES[docType],
          now,
        );
      }
    });
    createDocs();

    // If parentId provided, create parent_child edge
    if (params.parentId) {
      const edgeId = uuidv4();
      this.db.prepare(`
        INSERT INTO project_edges (id, from_id, to_id, type, description, strength, bidirectional, created_at)
        VALUES (?, ?, ?, 'parent_child', 'Auto-created parent-child relationship', 0.8, 0, ?)
      `).run(edgeId, params.parentId, id, now);
    }

    return project;
  }

  getById(id: string): ProjectNode | null {
    const row = this.db.prepare('SELECT * FROM project_nodes WHERE id = ?').get(id) as any;
    return row ? this.rowToProject(row) : null;
  }

  getByName(name: string): ProjectNode | null {
    const row = this.db.prepare('SELECT * FROM project_nodes WHERE name = ?').get(name) as any;
    return row ? this.rowToProject(row) : null;
  }

  getByPath(path: string): ProjectNode | null {
    const row = this.db.prepare('SELECT * FROM project_nodes WHERE path = ?').get(path) as any;
    return row ? this.rowToProject(row) : null;
  }

  list(status?: ProjectStatus): ProjectNode[] {
    let query = 'SELECT * FROM project_nodes';
    const params: any[] = [];
    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }
    query += ' ORDER BY updated_at DESC';
    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map(r => this.rowToProject(r));
  }

  update(id: string, updates: Partial<Pick<ProjectNode, 'display_name' | 'status' | 'tech_stack' | 'owner'>>): ProjectNode | null {
    const project = this.getById(id);
    if (!project) return null;

    const now = new Date().toISOString();
    const sets: string[] = ['updated_at = ?'];
    const values: any[] = [now];

    if (updates.display_name !== undefined) {
      sets.push('display_name = ?');
      values.push(updates.display_name);
    }
    if (updates.status !== undefined) {
      sets.push('status = ?');
      values.push(updates.status);
    }
    if (updates.tech_stack !== undefined) {
      sets.push('tech_stack = ?');
      values.push(JSON.stringify(updates.tech_stack));
    }
    if (updates.owner !== undefined) {
      sets.push('owner = ?');
      values.push(updates.owner);
    }

    values.push(id);
    this.db.prepare(`UPDATE project_nodes SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return this.getById(id);
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM project_nodes WHERE id = ?').run(id);
    return result.changes > 0;
  }

  private rowToProject(row: any): ProjectNode {
    return {
      ...row,
      tech_stack: JSON.parse(row.tech_stack || '[]'),
    };
  }
}
