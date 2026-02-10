import type Database from 'better-sqlite3';
import { ProjectModel } from '../models/project.js';
import { DocumentModel } from '../models/document.js';
import { EdgeModel } from '../models/edge.js';
import type { ProjectContext, RelatedProjectContext, ProjectNode, Document, ProjectEdge } from '../types.js';

export class GraphEngine {
  private projectModel: ProjectModel;
  private documentModel: DocumentModel;
  private edgeModel: EdgeModel;

  constructor(db: Database.Database) {
    this.projectModel = new ProjectModel(db);
    this.documentModel = new DocumentModel(db);
    this.edgeModel = new EdgeModel(db);
  }

  getProjectContext(
    projectId: string,
    includeRelated: boolean = false,
    maxDepth: number = 1,
  ): ProjectContext | null {
    const project = this.projectModel.getById(projectId);
    if (!project) return null;

    const documents = this.documentModel.getByProject(projectId);
    const edges = this.edgeModel.getAllForProject(projectId);

    const related: RelatedProjectContext[] = [];
    if (includeRelated && maxDepth > 0) {
      const visited = new Set<string>([projectId]);
      this.bfsCollectRelated(projectId, maxDepth, visited, edges, related);
    }

    return { project, documents, edges, related };
  }

  private bfsCollectRelated(
    projectId: string,
    depth: number,
    visited: Set<string>,
    rootEdges: ProjectEdge[],
    result: RelatedProjectContext[],
  ): void {
    if (depth <= 0) return;

    const neighborIds = this.edgeModel.getNeighborIds(projectId);

    for (const neighborId of neighborIds) {
      if (visited.has(neighborId)) continue;
      visited.add(neighborId);

      const neighborProject = this.projectModel.getById(neighborId);
      if (!neighborProject) continue;

      const neighborDocs = this.documentModel.getByProject(neighborId);

      // Find the edge connecting to this neighbor
      const connectingEdge = rootEdges.find(
        e => e.from_id === neighborId || e.to_id === neighborId,
      ) || this.edgeModel.getAllForProject(neighborId).find(
        e => e.from_id === projectId || e.to_id === projectId,
      );

      if (connectingEdge) {
        result.push({
          project: neighborProject,
          edge: connectingEdge,
          documents: neighborDocs,
        });
      }

      // Recurse deeper
      if (depth > 1) {
        const deeperEdges = this.edgeModel.getAllForProject(neighborId);
        this.bfsCollectRelated(neighborId, depth - 1, visited, deeperEdges, result);
      }
    }
  }

  formatContextAsMarkdown(context: ProjectContext): string {
    const lines: string[] = [];

    lines.push(`# Project: ${context.project.display_name}`);
    lines.push(`**Name:** ${context.project.name}`);
    lines.push(`**Path:** ${context.project.path}`);
    lines.push(`**Tech Stack:** ${context.project.tech_stack.join(', ') || 'N/A'}`);
    lines.push(`**Status:** ${context.project.status}`);
    lines.push('');

    // Documents
    for (const doc of context.documents) {
      if (doc.content.trim()) {
        lines.push(`---`);
        lines.push(`## [${doc.doc_type.toUpperCase()}]`);
        lines.push(doc.content);
        lines.push('');
      }
    }

    // Edges
    if (context.edges.length > 0) {
      lines.push(`---`);
      lines.push(`## Dependencies & Relations`);
      for (const edge of context.edges) {
        const direction = edge.from_id === context.project.id ? '→' : '←';
        const otherId = edge.from_id === context.project.id ? edge.to_id : edge.from_id;
        const otherProject = this.projectModel.getById(otherId);
        const otherName = otherProject?.name || otherId;
        lines.push(`- ${direction} **${otherName}** (${edge.type}): ${edge.description || 'N/A'}`);
      }
      lines.push('');
    }

    // Related projects
    if (context.related.length > 0) {
      lines.push(`---`);
      lines.push(`## Related Projects`);
      for (const rel of context.related) {
        lines.push(`### ${rel.project.display_name} (${rel.edge.type})`);
        // Show summary of key docs
        const progressDoc = rel.documents.find(d => d.doc_type === 'progress');
        const prdDoc = rel.documents.find(d => d.doc_type === 'prd');
        if (progressDoc) {
          lines.push(`**Progress:** ${progressDoc.content.slice(0, 300)}...`);
        }
        if (prdDoc) {
          lines.push(`**PRD:** ${prdDoc.content.slice(0, 300)}...`);
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }
}
