import type Database from 'better-sqlite3';
import type { SearchResult, DocType } from '../types.js';

export class SearchEngine {
  constructor(private db: Database.Database) {}

  search(params: {
    query: string;
    projectId?: string;
    docTypes?: DocType[];
    limit?: number;
  }): SearchResult[] {
    const { query, projectId, docTypes, limit = 10 } = params;

    // Keyword-based search (MVP approach - can be upgraded to vector search later)
    let sql = `
      SELECT d.project_id, d.doc_type, d.content, p.name as project_name
      FROM documents d
      JOIN project_nodes p ON d.project_id = p.id
      WHERE 1=1
    `;
    const sqlParams: any[] = [];

    if (projectId) {
      sql += ' AND d.project_id = ?';
      sqlParams.push(projectId);
    }

    if (docTypes && docTypes.length > 0) {
      sql += ` AND d.doc_type IN (${docTypes.map(() => '?').join(',')})`;
      sqlParams.push(...docTypes);
    }

    sql += ' ORDER BY d.last_modified DESC';

    const rows = this.db.prepare(sql).all(...sqlParams) as any[];

    // Score results by keyword matching
    const keywords = this.tokenize(query);
    const scored: SearchResult[] = [];

    for (const row of rows) {
      const score = this.calculateScore(row.content, keywords);
      if (score > 0) {
        scored.push({
          project_id: row.project_id,
          project_name: row.project_name,
          doc_type: row.doc_type,
          content: this.extractSnippet(row.content, keywords),
          score,
        });
      }
    }

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, limit);
  }

  private tokenize(query: string): string[] {
    return query.toLowerCase().split(/\s+/).filter(t => t.length > 1);
  }

  private calculateScore(content: string, keywords: string[]): number {
    const lower = content.toLowerCase();
    let score = 0;
    for (const keyword of keywords) {
      const matches = lower.split(keyword).length - 1;
      score += matches;
    }
    return score;
  }

  private extractSnippet(content: string, keywords: string[], maxLength: number = 300): string {
    const lower = content.toLowerCase();
    let bestIndex = 0;
    let bestScore = 0;

    // Find the region with highest keyword density
    for (let i = 0; i < lower.length; i += 50) {
      const window = lower.slice(i, i + maxLength);
      let score = 0;
      for (const keyword of keywords) {
        score += (window.split(keyword).length - 1);
      }
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    const start = Math.max(0, bestIndex - 20);
    const end = Math.min(content.length, start + maxLength);
    let snippet = content.slice(start, end).trim();

    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';

    return snippet;
  }
}
