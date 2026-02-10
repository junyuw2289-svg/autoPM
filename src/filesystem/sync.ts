import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const DOCS_ROOT = path.join(os.homedir(), '.project-memory', 'docs');

export class FileSync {
  private docsRoot: string;

  constructor(docsRoot?: string) {
    this.docsRoot = docsRoot || DOCS_ROOT;
  }

  /**
   * Ensure the project directory exists and write all 8 doc files.
   */
  syncProject(projectName: string, docs: Array<{ doc_type: string; content: string }>): string {
    const projectDir = path.join(this.docsRoot, projectName);
    fs.mkdirSync(projectDir, { recursive: true });

    for (const doc of docs) {
      const filePath = path.join(projectDir, `${doc.doc_type}.md`);
      fs.writeFileSync(filePath, doc.content, 'utf-8');
    }

    return projectDir;
  }

  /**
   * Write a single document file to disk.
   */
  syncDocument(projectName: string, docType: string, content: string): string {
    const projectDir = path.join(this.docsRoot, projectName);
    fs.mkdirSync(projectDir, { recursive: true });

    const filePath = path.join(projectDir, `${docType}.md`);
    fs.writeFileSync(filePath, content, 'utf-8');

    return filePath;
  }

  /**
   * Get the absolute path for a project's docs directory.
   */
  getProjectDir(projectName: string): string {
    return path.join(this.docsRoot, projectName);
  }

  /**
   * Get the absolute path for a specific document file.
   */
  getDocPath(projectName: string, docType: string): string {
    return path.join(this.docsRoot, projectName, `${docType}.md`);
  }
}
