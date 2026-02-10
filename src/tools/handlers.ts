import type Database from 'better-sqlite3';
import { ProjectModel } from '../models/project.js';
import { DocumentModel } from '../models/document.js';
import { EdgeModel } from '../models/edge.js';
import { ConversationModel } from '../models/conversation.js';
import { GraphEngine } from '../engine/graph.js';
import { SearchEngine } from '../engine/search.js';
import { FileSync } from '../filesystem/sync.js';
import type { DocType, UpdateMode, EdgeType, UpdateApplied } from '../types.js';
import { ALL_DOC_TYPES, DEFAULT_UPDATE_MODES } from '../types.js';

export class ToolHandlers {
  private projectModel: ProjectModel;
  private documentModel: DocumentModel;
  private edgeModel: EdgeModel;
  private conversationModel: ConversationModel;
  private graphEngine: GraphEngine;
  private searchEngine: SearchEngine;
  private fileSync: FileSync;

  constructor(db: Database.Database, fileSync?: FileSync) {
    this.projectModel = new ProjectModel(db);
    this.documentModel = new DocumentModel(db);
    this.edgeModel = new EdgeModel(db);
    this.conversationModel = new ConversationModel(db);
    this.graphEngine = new GraphEngine(db);
    this.searchEngine = new SearchEngine(db);
    this.fileSync = fileSync || new FileSync();
  }

  async pmProjectCreate(args: {
    name: string;
    path: string;
    techStack?: string[];
    parentId?: string;
    displayName?: string;
  }): Promise<{ success: boolean; project?: any; error?: string }> {
    try {
      // Check uniqueness
      const existing = this.projectModel.getByName(args.name);
      if (existing) {
        return { success: false, error: `Project "${args.name}" already exists` };
      }

      const project = this.projectModel.create({
        name: args.name,
        path: args.path,
        techStack: args.techStack,
        parentId: args.parentId,
        displayName: args.displayName,
      });

      const docs = this.documentModel.getByProject(project.id);

      // Sync all 8 document files to disk
      const docsDir = this.fileSync.syncProject(
        project.name,
        docs.map(d => ({ doc_type: d.doc_type, content: d.content })),
      );

      return {
        success: true,
        project: {
          ...project,
          docs_directory: docsDir,
          documents: docs.map(d => ({
            doc_type: d.doc_type,
            update_mode: d.update_mode,
            file_path: this.fileSync.getDocPath(project.name, d.doc_type),
          })),
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async pmUpdate(args: {
    projectId: string;
    docType: DocType;
    content: string;
    mode?: UpdateMode;
    metadata?: Record<string, string>;
  }): Promise<{ success: boolean; document?: any; error?: string }> {
    try {
      // Resolve project by name or ID
      let project = this.projectModel.getById(args.projectId);
      if (!project) {
        project = this.projectModel.getByName(args.projectId);
      }
      if (!project) {
        return { success: false, error: `Project "${args.projectId}" not found` };
      }

      if (!ALL_DOC_TYPES.includes(args.docType)) {
        return { success: false, error: `Invalid doc type: ${args.docType}` };
      }

      const doc = this.documentModel.update(
        project.id,
        args.docType,
        args.content,
        args.mode,
        'manual',
        args.metadata?.changeSummary,
      );

      if (!doc) {
        return { success: false, error: `Document slot "${args.docType}" not found for project` };
      }

      // Sync updated file to disk
      const filePath = this.fileSync.syncDocument(project.name, doc.doc_type, doc.content);

      return {
        success: true,
        document: {
          doc_type: doc.doc_type,
          version: doc.version,
          update_mode: doc.update_mode,
          last_modified: doc.last_modified,
          file_path: filePath,
          content_preview: doc.content.slice(0, 200),
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async pmAutoUpdate(args: {
    conversationSummary: string;
    projectId?: string;
  }): Promise<{ success: boolean; updates?: any[]; error?: string }> {
    try {
      let project;
      if (args.projectId) {
        project = this.projectModel.getById(args.projectId) || this.projectModel.getByName(args.projectId);
      }

      if (!project) {
        return { success: false, error: 'Could not detect project. Please provide projectId.' };
      }

      // Simple rule-based classifier (MVP - can be upgraded to LLM later)
      const updates = this.classifyUpdates(args.conversationSummary);

      const applied: UpdateApplied[] = [];
      for (const update of updates) {
        const doc = this.documentModel.update(
          project.id,
          update.docType,
          update.content,
          update.mode,
          'auto',
          `Auto-update from conversation`,
        );
        if (doc) {
          // Sync to disk
          this.fileSync.syncDocument(project.name, doc.doc_type, doc.content);
          applied.push({
            docType: update.docType,
            mode: update.mode,
            snippet: update.content.slice(0, 100),
          });
        }
      }

      // Log conversation
      const now = new Date().toISOString();
      this.conversationModel.create({
        projectId: project.id,
        summary: args.conversationSummary,
        updatesApplied: applied,
        conversationStart: now,
        conversationEnd: now,
      });

      return { success: true, updates: applied };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async pmProjectContext(args: {
    projectId: string;
    includeRelated?: boolean;
    maxDepth?: number;
  }): Promise<{ success: boolean; context?: string; error?: string }> {
    try {
      let project = this.projectModel.getById(args.projectId);
      if (!project) {
        project = this.projectModel.getByName(args.projectId);
      }
      if (!project) {
        return { success: false, error: `Project "${args.projectId}" not found` };
      }

      const context = this.graphEngine.getProjectContext(
        project.id,
        args.includeRelated ?? false,
        args.maxDepth ?? 1,
      );

      if (!context) {
        return { success: false, error: 'Failed to build project context' };
      }

      const markdown = this.graphEngine.formatContextAsMarkdown(context);
      return { success: true, context: markdown };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async pmSearch(args: {
    query: string;
    projectId?: string;
    docTypes?: DocType[];
    includeRelated?: boolean;
  }): Promise<{ success: boolean; results?: any[]; error?: string }> {
    try {
      let resolvedProjectId: string | undefined;
      if (args.projectId) {
        const project = this.projectModel.getById(args.projectId) || this.projectModel.getByName(args.projectId);
        resolvedProjectId = project?.id;
      }

      const results = this.searchEngine.search({
        query: args.query,
        projectId: resolvedProjectId,
        docTypes: args.docTypes,
      });

      return { success: true, results };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async pmDependencyAdd(args: {
    fromId: string;
    toId: string;
    type: EdgeType;
    description?: string;
  }): Promise<{ success: boolean; edge?: any; error?: string }> {
    try {
      // Resolve by name or ID
      let fromProject = this.projectModel.getById(args.fromId) || this.projectModel.getByName(args.fromId);
      let toProject = this.projectModel.getById(args.toId) || this.projectModel.getByName(args.toId);

      if (!fromProject) {
        return { success: false, error: `Source project "${args.fromId}" not found` };
      }
      if (!toProject) {
        return { success: false, error: `Target project "${args.toId}" not found` };
      }

      const edge = this.edgeModel.create({
        fromId: fromProject.id,
        toId: toProject.id,
        type: args.type,
        description: args.description,
      });

      return {
        success: true,
        edge: {
          id: edge.id,
          from: fromProject.name,
          to: toProject.name,
          type: edge.type,
          description: edge.description,
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async pmSync(args: {
    projectId?: string;
  }): Promise<{ success: boolean; synced?: any[]; error?: string }> {
    try {
      let projects;
      if (args.projectId) {
        const p = this.projectModel.getById(args.projectId) || this.projectModel.getByName(args.projectId);
        projects = p ? [p] : [];
      } else {
        projects = this.projectModel.list();
      }

      if (projects.length === 0) {
        return { success: false, error: args.projectId ? `Project "${args.projectId}" not found` : 'No projects found' };
      }

      const synced: any[] = [];
      for (const project of projects) {
        const docs = this.documentModel.getByProject(project.id);
        const docsDir = this.fileSync.syncProject(
          project.name,
          docs.map(d => ({ doc_type: d.doc_type, content: d.content })),
        );
        synced.push({
          project: project.name,
          docs_directory: docsDir,
          files: docs.map(d => `${d.doc_type}.md`),
        });
      }

      return { success: true, synced };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // Simple rule-based classifier for auto-update (MVP)
  private classifyUpdates(summary: string): Array<{ docType: DocType; mode: UpdateMode; content: string }> {
    const updates: Array<{ docType: DocType; mode: UpdateMode; content: string }> = [];
    const lower = summary.toLowerCase();
    const date = new Date().toISOString().slice(0, 10);

    // Check for TODO-like content
    if (lower.includes('todo') || lower.includes('task') || lower.includes('need to') || lower.includes('should')) {
      updates.push({
        docType: 'todo',
        mode: 'append',
        content: `## ${date}\n- [ ] ${summary.slice(0, 200)}`,
      });
    }

    // Check for progress updates
    if (lower.includes('implemented') || lower.includes('completed') || lower.includes('fixed') || lower.includes('added')) {
      updates.push({
        docType: 'progress',
        mode: 'upsert',
        content: `## Current Sprint\n**Status:** In progress\n**Last update:** ${date}\n\n${summary.slice(0, 300)}`,
      });
    }

    // Check for decisions or learnings
    if (lower.includes('decided') || lower.includes('learned') || lower.includes('discovered') || lower.includes('architecture')) {
      updates.push({
        docType: 'memory',
        mode: 'append',
        content: `## ${date} - Session Notes\n${summary.slice(0, 300)}`,
      });
    }

    // Check for delays
    if (lower.includes('delay') || lower.includes('blocked') || lower.includes('issue') || lower.includes('problem')) {
      updates.push({
        docType: 'delays',
        mode: 'append',
        content: `## ${date}\n**Reason:** ${summary.slice(0, 200)}\n**Impact:** TBD\n**Mitigation:** TBD`,
      });
    }

    // Check for questions
    if (lower.includes('question') || lower.includes('how to') || lower.includes('?')) {
      updates.push({
        docType: 'notes',
        mode: 'append',
        content: `## ${date}\n${summary.slice(0, 300)}`,
      });
    }

    // If nothing matched, add a general note
    if (updates.length === 0) {
      updates.push({
        docType: 'notes',
        mode: 'append',
        content: `## ${date}\n${summary.slice(0, 300)}`,
      });
    }

    return updates;
  }
}
