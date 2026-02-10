import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createTestDb } from '../setup.js';
import { ProjectModel } from '../../src/models/project.js';
import { DocumentModel } from '../../src/models/document.js';

describe('DocumentModel', () => {
  let db: Database.Database;
  let projectModel: ProjectModel;
  let documentModel: DocumentModel;
  let projectId: string;

  beforeEach(() => {
    db = createTestDb();
    projectModel = new ProjectModel(db);
    documentModel = new DocumentModel(db);
    const project = projectModel.create({ name: 'doc-test', path: '/tmp/dt' });
    projectId = project.id;
  });

  it('should get all 8 documents for a project', () => {
    const docs = documentModel.getByProject(projectId);
    expect(docs).toHaveLength(8);
  });

  it('should get a specific document by type', () => {
    const doc = documentModel.getByProjectAndType(projectId, 'todo');
    expect(doc).not.toBeNull();
    expect(doc!.doc_type).toBe('todo');
    expect(doc!.content).toContain('To-Do List');
  });

  it('should append content in append mode', () => {
    const original = documentModel.getByProjectAndType(projectId, 'todo')!;
    const originalContent = original.content;

    const updated = documentModel.update(
      projectId,
      'todo',
      '## 2025-02-10\n- [ ] New task',
      'append',
    );

    expect(updated).not.toBeNull();
    expect(updated!.content).toContain(originalContent.trim());
    expect(updated!.content).toContain('New task');
    expect(updated!.version).toBe(2);
  });

  it('should upsert content in upsert mode', () => {
    // First set some content
    documentModel.update(
      projectId,
      'confirm',
      '## Q1: Use subgraph or parallel?\n**Status:** Pending',
      'upsert',
    );

    // Now upsert with same key
    const updated = documentModel.update(
      projectId,
      'confirm',
      '## Q1: Use subgraph or parallel?\n**Status:** Confirmed\n**Decision:** Subgraph',
      'upsert',
    );

    expect(updated).not.toBeNull();
    expect(updated!.content).toContain('Confirmed');
    expect(updated!.content).toContain('Subgraph');
    // Should not have duplicate Q1 sections
    const q1Matches = updated!.content.match(/## Q1/g);
    expect(q1Matches).toHaveLength(1);
  });

  it('should create version snapshots on update', () => {
    documentModel.update(projectId, 'notes', '## 2025-02-10\nSome note', 'append');
    documentModel.update(projectId, 'notes', '## 2025-02-11\nAnother note', 'append');

    const doc = documentModel.getByProjectAndType(projectId, 'notes')!;
    const versions = documentModel.getVersions(doc.id);
    expect(versions).toHaveLength(2);
    expect(versions[0].version_number).toBe(3); // most recent first
    expect(versions[1].version_number).toBe(2);
  });

  it('should use default update mode for doc type when mode not specified', () => {
    // todo defaults to append
    const updated = documentModel.update(projectId, 'todo', '- [ ] Auto mode task');
    expect(updated).not.toBeNull();
    expect(updated!.content).toContain('Auto mode task');
    expect(updated!.content).toContain('To-Do List'); // original content preserved
  });

  it('should handle upsert with new key (append fallback)', () => {
    const updated = documentModel.update(
      projectId,
      'progress',
      '## Sprint 2\n**Status:** Planning',
      'upsert',
    );

    expect(updated).not.toBeNull();
    expect(updated!.content).toContain('Current Sprint'); // original
    expect(updated!.content).toContain('Sprint 2'); // new section added
  });
});
