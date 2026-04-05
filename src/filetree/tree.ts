import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export type TreeNode = {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
};

export async function buildTree(dirPath: string): Promise<TreeNode[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  const nodes = await Promise.all(
    entries
      .filter((entry) => !entry.name.startsWith('.'))
      .sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) {
          return a.isDirectory() ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      })
      .map(async (entry): Promise<TreeNode> => {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          return { name: entry.name, path: fullPath, type: 'directory', children: await buildTree(fullPath) };
        }
        return { name: entry.name, path: fullPath, type: 'file' };
      })
  );

  return nodes;
}

export function treeToString(nodes: TreeNode[], indent = ''): string {
  return nodes.map((node) => {
    if (node.type === 'directory') {
      return `${indent}${node.name}/\n${treeToString(node.children ?? [], indent + '  ')}`;
    }
    return `${indent}${node.name}`;
  }).join('\n');
}
