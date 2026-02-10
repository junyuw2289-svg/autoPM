import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import type { Document, DocType, UpdateMode, UpdateTrigger } from '../types.js';
import { DEFAULT_UPDATE_MODES } from '../types.js';

export class DocumentModel {
  constructor(private db: Database.Database) {}

  getByProjectAndType(projectId: string, docType: DocType): Document | null {
    const row = this.db.prepare(
      'SELECT * FROM documents WHERE project_id = ? AND doc_type = ?'
    ).get(projectId, docType) as any;
    return row || null;
  }

  getByProject(projectId: string): Document[] {
    return this.db.prepare(
      'SELECT * FROM documents WHERE project_id = ? ORDER BY doc_type'
    ).all(projectId) as Document[];
  }

  update(
    projectId: string,
    docType: DocType,
    content: string,
    mode?: UpdateMode,
    trigger: UpdateTrigger = 'manual',
    changeSummary?: string,
  ): Document | null {
    const doc = this.getByProjectAndType(projectId, docType);
    if (!doc) return null;

    const effectiveMode = mode || DEFAULT_UPDATE_MODES[docType];
    const now = new Date().toISOString();

    let newContent: string;
    if (effectiveMode === 'append') {
      newContent = this.applyAppend(doc.content, content);
    } else {
      newContent = this.applyUpsert(doc.content, content, docType);
    }

    const newVersion = doc.version + 1;

    // Update document
    this.db.prepare(`
      UPDATE documents SET content = ?, version = ?, last_modified = ? WHERE id = ?
    `).run(newContent, newVersion, now, doc.id);

    // Create version snapshot
    this.db.prepare(`
      INSERT INTO document_versions (id, document_id, content, change_summary, trigger, version_number, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      doc.id,
      newContent,
      changeSummary || `${effectiveMode} update to ${docType}`,
      trigger,
      newVersion,
      now,
    );

    return this.getByProjectAndType(projectId, docType);
  }

  private applyAppend(existing: string, newContent: string): string {
    const trimmedExisting = existing.trimEnd();
    return trimmedExisting + '\n\n' + newContent.trim() + '\n';
  }

  private applyUpsert(existing: string, newContent: string, docType: DocType): string {
    // Extract the key/header from new content to find what to replace
    const newKey = this.extractUpsertKey(newContent, docType);
    if (!newKey) {
      // No key found, append instead
      return this.applyAppend(existing, newContent);
    }

    // Find the section in existing content that matches the key
    const sectionRegex = this.buildSectionRegex(newKey);
    if (sectionRegex && sectionRegex.test(existing)) {
      // Replace the existing section
      return existing.replace(sectionRegex, newContent.trim());
    }

    // Key not found in existing, append it
    return this.applyAppend(existing, newContent);
  }

  private extractUpsertKey(content: string, _docType: DocType): string | null {
    // Look for a markdown header (## ...)
    const headerMatch = content.match(/^##\s+(.+)$/m);
    if (headerMatch) {
      return headerMatch[1].trim();
    }
    return null;
  }

  private buildSectionRegex(key: string): RegExp | null {
    // Escape special regex characters in the key
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match from the header to the next same-level header or end of content
    return new RegExp(`##\\s+${escaped}[\\s\\S]*?(?=\\n##\\s|$)`, 'm');
  }

  getVersions(documentId: string): Array<{
    id: string;
    version_number: number;
    change_summary: string;
    trigger: UpdateTrigger;
    created_at: string;
  }> {
    return this.db.prepare(`
      SELECT id, version_number, change_summary, trigger, created_at
      FROM document_versions
      WHERE document_id = ?
      ORDER BY version_number DESC
    `).all(documentId) as any[];
  }

  getVersionContent(versionId: string): string | null {
    const row = this.db.prepare(
      'SELECT content FROM document_versions WHERE id = ?'
    ).get(versionId) as any;
    return row ? row.content : null;
  }
}
