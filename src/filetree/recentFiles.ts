import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import ignore from 'ignore';

export type RecentFile = {
  name: string;
  path: string;
  relativePath: string;
  mtimeMs: number;
};

async function loadGitignore(rootPath: string) {
  const ig = ignore();
  try {
    const content = await fs.readFile(path.join(rootPath, '.gitignore'), 'utf8');
    ig.add(content);
  } catch {
    // No .gitignore or unreadable — proceed without filtering.
  }
  return ig;
}

export async function collectRecentFiles(rootPath: string, limit: number): Promise<RecentFile[]> {
  const collected: RecentFile[] = [];
  const ig = await loadGitignore(rootPath);

  async function visit(dirPath: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    await Promise.all(
      entries.filter((e) => !e.name.startsWith('.')).map(async (entry) => {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(rootPath, fullPath);

        if (ig.ignores(relativePath)) return;

        if (entry.isDirectory()) {
          await visit(fullPath);
          return;
        }

        if (!entry.isFile()) return;

        try {
          const stats = await fs.stat(fullPath);
          collected.push({ name: entry.name, path: fullPath, relativePath, mtimeMs: stats.mtimeMs });
        } catch {
          // Ignore files we cannot read metadata for.
        }
      })
    );
  }

  await visit(rootPath);
  collected.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return collected.slice(0, limit);
}
