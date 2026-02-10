import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createTestDb } from '../setup.js';
import { ProjectModel } from '../../src/models/project.js';
import { DocumentModel } from '../../src/models/document.js';

describe('ProjectModel', () => {
  let db: Database.Database;
  let projectModel: ProjectModel;
  let documentModel: DocumentModel;

  beforeEach(() => {
    db = createTestDb();
    projectModel = new ProjectModel(db);
    documentModel = new DocumentModel(db);
  });

  it('should create a project with 8 document slots', () => {
    const project = projectModel.create({
      name: 'test-project',
      path: '/tmp/test-project',
      techStack: ['TypeScript', 'Node.js'],
    });

    expect(project.id).toBeDefined();
    expect(project.name).toBe('test-project');
    expect(project.display_name).toBe('test-project');
    expect(project.tech_stack).toEqual(['TypeScript', 'Node.js']);
    expect(project.status).toBe('active');

    const docs = documentModel.getByProject(project.id);
    expect(docs).toHaveLength(8);

    const docTypes = docs.map(d => d.doc_type).sort();
    expect(docTypes).toEqual(['confirm', 'delays', 'memory', 'notes', 'prd', 'progress', 'qa', 'todo']);
  });

  it('should retrieve project by ID', () => {
    const created = projectModel.create({ name: 'proj-1', path: '/tmp/p1' });
    const found = projectModel.getById(created.id);
    expect(found).not.toBeNull();
    expect(found!.name).toBe('proj-1');
  });

  it('should retrieve project by name', () => {
    projectModel.create({ name: 'my-project', path: '/tmp/mp' });
    const found = projectModel.getByName('my-project');
    expect(found).not.toBeNull();
    expect(found!.name).toBe('my-project');
  });

  it('should enforce unique project names', () => {
    projectModel.create({ name: 'unique-proj', path: '/tmp/up' });
    expect(() => {
      projectModel.create({ name: 'unique-proj', path: '/tmp/up2' });
    }).toThrow();
  });

  it('should list projects', () => {
    projectModel.create({ name: 'p1', path: '/tmp/p1' });
    projectModel.create({ name: 'p2', path: '/tmp/p2' });
    const all = projectModel.list();
    expect(all).toHaveLength(2);
  });

  it('should list projects by status', () => {
    const p = projectModel.create({ name: 'active-p', path: '/tmp/ap' });
    projectModel.create({ name: 'paused-p', path: '/tmp/pp' });
    projectModel.update(p.id, { status: 'paused' });

    const paused = projectModel.list('paused');
    expect(paused).toHaveLength(1);
    expect(paused[0].name).toBe('active-p');
  });

  it('should update project fields', () => {
    const p = projectModel.create({ name: 'updatable', path: '/tmp/u' });
    const updated = projectModel.update(p.id, {
      display_name: 'Updated Name',
      status: 'paused',
      tech_stack: ['Go'],
    });

    expect(updated).not.toBeNull();
    expect(updated!.display_name).toBe('Updated Name');
    expect(updated!.status).toBe('paused');
    expect(updated!.tech_stack).toEqual(['Go']);
  });

  it('should delete a project', () => {
    const p = projectModel.create({ name: 'deletable', path: '/tmp/d' });
    const deleted = projectModel.delete(p.id);
    expect(deleted).toBe(true);

    const found = projectModel.getById(p.id);
    expect(found).toBeNull();
  });

  it('should create parent-child edge when parentId is provided', () => {
    const parent = projectModel.create({ name: 'parent', path: '/tmp/parent' });
    const child = projectModel.create({
      name: 'child',
      path: '/tmp/child',
      parentId: parent.id,
    });

    const edges = db.prepare('SELECT * FROM project_edges WHERE to_id = ?').all(child.id) as any[];
    expect(edges).toHaveLength(1);
    expect(edges[0].from_id).toBe(parent.id);
    expect(edges[0].type).toBe('parent_child');
  });
});
