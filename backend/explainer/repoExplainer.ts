import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { ask } from '../llm/llm';
import promptTemplate from './repoPrompt.md';

const INFO_FILES = ['readme.md', 'package.json', 'composer.json', 'pyproject.toml', 'cargo.toml', 'go.mod', 'dockerfile'];

let repoExplanation: string | null = null;

export function getRepoExplanation(): string | null {
  return repoExplanation;
}

async function readInfoFiles(rootPath: string): Promise<string> {
  const sections: string[] = [];
  for (const name of INFO_FILES) {
    const filePath = path.join(rootPath, name);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      sections.push(`${name}:\n---------------\n${content.trim()}\n---------------`);
    } catch {
      // file doesn't exist, skip
    }
  }
  return sections.join('\n\n');
}

export async function repoExplainer(
  rootPath: string,
  fileStructure: string,
  onChunk: (chunk: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
): Promise<void> {
  try {
    repoExplanation = null;
    const infoFiles = await readInfoFiles(rootPath);
    let prompt = promptTemplate.replace('{{fileStructure}}', fileStructure);
    if (infoFiles) {
      prompt += `\n\nAdditional project files:\n${infoFiles}`;
    }
    let summary = '';
    await ask(prompt, (chunk) => {
      summary += chunk;
      onChunk(chunk);
    });
    repoExplanation = summary;
    onDone();
  } catch (err) {
    onError(String(err));
  }
}
