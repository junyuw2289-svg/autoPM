import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createTestDb } from '../setup.js';
import { ProjectModel } from '../../src/models/project.js';
import { DocumentModel } from '../../src/models/document.js';
import { SearchEngine } from '../../src/engine/search.js';

describe('SearchEngine', () => {
  let db: Database.Database;
  let projectModel: ProjectModel;
  let documentModel: DocumentModel;
  let searchEngine: SearchEngine;

  beforeEach(() => {
    db = createTestDb();
    projectModel = new ProjectModel(db);
    documentModel = new DocumentModel(db);
    searchEngine = new SearchEngine(db);
  });

  it('should find documents by keyword', () => {
    const project = projectModel.create({ name: 'search-test', path: '/tmp/st' });
    documentModel.update(project.id, 'notes', '## 2025-02-10\nImplemented caching layer for Redis', 'append');
    documentModel.update(project.id, 'todo', '- [ ] Fix nil pointer handling in parser', 'append');

    const results = searchEngine.search({ query: 'caching Redis' });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content).toContain('caching');
  });

  it('should scope search to a specific project', () => {
    const p1 = projectModel.create({ name: 'proj-1', path: '/tmp/p1' });
    const p2 = projectModel.create({ name: 'proj-2', path: '/tmp/p2' });

    documentModel.update(p1.id, 'notes', '## Note\nSpecial keyword alpha', 'append');
    documentModel.update(p2.id, 'notes', '## Note\nSpecial keyword alpha', 'append');

    const results = searchEngine.search({
      query: 'alpha',
      projectId: p1.id,
    });

    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.project_id).toBe(p1.id);
    }
  });

  it('should filter by doc types', () => {
    const project = projectModel.create({ name: 'filter-test', path: '/tmp/ft' });
    documentModel.update(project.id, 'todo', '- [ ] Unique keyword bravo', 'append');
    documentModel.update(project.id, 'notes', '## Unique keyword bravo in notes', 'append');

    const results = searchEngine.search({
      query: 'bravo',
      docTypes: ['todo'],
    });

    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.doc_type).toBe('todo');
    }
  });

  it('should return empty results for no match', () => {
    projectModel.create({ name: 'empty-test', path: '/tmp/et' });
    const results = searchEngine.search({ query: 'xyznonexistent123' });
    expect(results).toHaveLength(0);
  });

  it('should rank results by score', () => {
    const project = projectModel.create({ name: 'rank-test', path: '/tmp/rt' });
    documentModel.update(project.id, 'notes', '## Note\nperformance performance performance', 'append');
    documentModel.update(project.id, 'todo', '- [ ] Check performance', 'append');

    const results = searchEngine.search({ query: 'performance' });
    expect(results.length).toBeGreaterThanOrEqual(2);
    // The notes doc should rank higher (more matches)
    expect(results[0].doc_type).toBe('notes');
  });
});
