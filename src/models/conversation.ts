import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import type { ConversationLog, UpdateApplied } from '../types.js';

export class ConversationModel {
  constructor(private db: Database.Database) {}

  create(params: {
    projectId: string | null;
    summary: string;
    updatesApplied: UpdateApplied[];
    conversationStart: string;
    conversationEnd: string;
  }): ConversationLog {
    const id = uuidv4();

    this.db.prepare(`
      INSERT INTO conversation_logs (id, project_id, summary, updates_applied, conversation_start, conversation_end)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      params.projectId,
      params.summary,
      JSON.stringify(params.updatesApplied),
      params.conversationStart,
      params.conversationEnd,
    );

    return {
      id,
      project_id: params.projectId,
      summary: params.summary,
      updates_applied: params.updatesApplied,
      conversation_start: params.conversationStart,
      conversation_end: params.conversationEnd,
    };
  }

  getByProject(projectId: string): ConversationLog[] {
    const rows = this.db.prepare(
      'SELECT * FROM conversation_logs WHERE project_id = ? ORDER BY conversation_end DESC'
    ).all(projectId) as any[];
    return rows.map(r => ({
      ...r,
      updates_applied: JSON.parse(r.updates_applied || '[]'),
    }));
  }
}
