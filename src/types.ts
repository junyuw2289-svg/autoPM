export type ProjectType = 'project' | 'module';
export type ProjectStatus = 'active' | 'paused' | 'archived';
export type DocType = 'todo' | 'confirm' | 'progress' | 'delays' | 'prd' | 'memory' | 'notes' | 'qa';
export type UpdateMode = 'upsert' | 'append';
export type EdgeType = 'depends_on' | 'uses' | 'related' | 'parent_child';
export type UpdateTrigger = 'auto' | 'manual';

export const ALL_DOC_TYPES: DocType[] = ['todo', 'confirm', 'progress', 'delays', 'prd', 'memory', 'notes', 'qa'];

export const DEFAULT_UPDATE_MODES: Record<DocType, UpdateMode> = {
  todo: 'append',
  confirm: 'upsert',
  progress: 'upsert',
  delays: 'append',
  prd: 'upsert',
  memory: 'append',
  notes: 'append',
  qa: 'upsert',
};

export interface ProjectNode {
  id: string;
  name: string;
  display_name: string;
  path: string;
  type: ProjectType;
  tech_stack: string[];
  owner: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  project_id: string;
  doc_type: DocType;
  file_path: string;
  update_mode: UpdateMode;
  content: string;
  version: number;
  last_modified: string;
}

export interface ProjectEdge {
  id: string;
  from_id: string;
  to_id: string;
  type: EdgeType;
  description: string;
  strength: number;
  bidirectional: boolean;
  created_at: string;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  content: string;
  change_summary: string;
  trigger: UpdateTrigger;
  version_number: number;
  created_at: string;
}

export interface ConversationLog {
  id: string;
  project_id: string | null;
  summary: string;
  updates_applied: UpdateApplied[];
  conversation_start: string;
  conversation_end: string;
}

export interface UpdateApplied {
  docType: DocType;
  mode: UpdateMode;
  snippet: string;
}

export interface SearchResult {
  project_id: string;
  project_name: string;
  doc_type: DocType;
  content: string;
  score: number;
}

export interface ProjectContext {
  project: ProjectNode;
  documents: Document[];
  edges: ProjectEdge[];
  related: RelatedProjectContext[];
}

export interface RelatedProjectContext {
  project: ProjectNode;
  edge: ProjectEdge;
  documents: Document[];
}

export const DOC_TEMPLATES: Record<DocType, string> = {
  todo: `# To-Do List\n\n## ${new Date().toISOString().slice(0, 10)}\n- [ ] Initial setup\n`,
  confirm: `# Things to Confirm\n\n_No items yet._\n`,
  progress: `# Current Progress\n\n## Current Sprint\n**Status:** Not started\n`,
  delays: `# Delay Logs\n\n_No delays recorded._\n`,
  prd: `# Product Requirements Document\n\n## V1.0\n_To be defined._\n`,
  memory: `# Long-term Memories\n\n## Architecture Decisions\n\n## Technical Learnings\n\n## Key Insights\n`,
  notes: `# Notable Points\n\n_No notes yet._\n`,
  qa: `# Questions & Answers\n\n_No Q&A entries yet._\n`,
};
