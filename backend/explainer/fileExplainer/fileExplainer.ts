import * as fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { ask } from '../../llm/llm';
import { getRepoExplanation } from '../repoExplainer/repoExplainer';
import promptTemplate from './prompt.md';

type CacheEntry = {
  hash: string;
  fileContent: string;
  summary: string;
};

const cache = new Map<string, CacheEntry>();

function hashContent(content: string): string {
  return createHash('md5').update(content).digest('hex');
}

function formatOtherFiles(currentFilePath: string): string {
  const entries = [...cache.entries()].filter(([p]) => p !== currentFilePath);
  if (entries.length === 0) return '(none yet)';
  return entries.map(([p, e]) => `### ${p}\n${e.fileContent}`).join('\n\n');
}

export async function fileExplainer(
  filePath: string,
  onChunk: (chunk: string) => void,
  onDone: () => void,
  onError: (err: string) => void
): Promise<void> {
  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      throw new Error('Requested path is not a file');
    }

    const fileContent = await fs.readFile(filePath, 'utf8');
    const hash = hashContent(fileContent);

    const cached = cache.get(filePath);
    if (cached && cached.hash === hash) {
      onChunk(cached.summary);
      onDone();
      return;
    }

    const repoExplanation = getRepoExplanation() ?? '(not available yet)';

    const prompt = promptTemplate
      .replace('{{filePath}}', filePath)
      .replace('{{repoExplanation}}', repoExplanation)
      .replace('{{otherFiles}}', formatOtherFiles(filePath))
      .replace('{{fileContent}}', fileContent);

    let summary = '';
    await ask(prompt, (chunk) => {
      summary += chunk;
      onChunk(chunk);
    });

    cache.set(filePath, { hash, fileContent, summary });
    onDone();
  } catch (err) {
    onError(String(err));
  }
}
