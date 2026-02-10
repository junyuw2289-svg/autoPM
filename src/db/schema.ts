import type Database from 'better-sqlite3';

export function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_nodes (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      path TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('project', 'module')),
      tech_stack TEXT NOT NULL DEFAULT '[]',
      owner TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused', 'archived')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      doc_type TEXT NOT NULL CHECK(doc_type IN ('todo', 'confirm', 'progress', 'delays', 'prd', 'memory', 'notes', 'qa')),
      file_path TEXT NOT NULL,
      update_mode TEXT NOT NULL CHECK(update_mode IN ('upsert', 'append')),
      content TEXT NOT NULL DEFAULT '',
      version INTEGER NOT NULL DEFAULT 1,
      last_modified TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES project_nodes(id) ON DELETE CASCADE,
      UNIQUE(project_id, doc_type)
    );

    CREATE TABLE IF NOT EXISTS project_edges (
      id TEXT PRIMARY KEY,
      from_id TEXT NOT NULL,
      to_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('depends_on', 'uses', 'related', 'parent_child')),
      description TEXT NOT NULL DEFAULT '',
      strength REAL NOT NULL DEFAULT 0.5 CHECK(strength >= 0.0 AND strength <= 1.0),
      bidirectional INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (from_id) REFERENCES project_nodes(id) ON DELETE CASCADE,
      FOREIGN KEY (to_id) REFERENCES project_nodes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS document_versions (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      content TEXT NOT NULL,
      change_summary TEXT NOT NULL DEFAULT '',
      trigger TEXT NOT NULL CHECK(trigger IN ('auto', 'manual')),
      version_number INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS conversation_logs (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      summary TEXT NOT NULL DEFAULT '',
      updates_applied TEXT NOT NULL DEFAULT '[]',
      conversation_start TEXT NOT NULL,
      conversation_end TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES project_nodes(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
    CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(doc_type);
    CREATE INDEX IF NOT EXISTS idx_edges_from ON project_edges(from_id);
    CREATE INDEX IF NOT EXISTS idx_edges_to ON project_edges(to_id);
    CREATE INDEX IF NOT EXISTS idx_versions_doc ON document_versions(document_id);
    CREATE INDEX IF NOT EXISTS idx_conv_project ON conversation_logs(project_id);
  `);
}
