import { marked } from 'marked';
import {
  SETI_DEFAULT_FILE_ICON,
  SETI_FILE_EXTENSION_ICON,
  SETI_FILE_NAME_ICON,
  SETI_ICON_GLYPHS,
  SETI_PALETTE
} from './vscodeSetiColors.js';

type TreeNode = {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
};

type OpenFolderResult = {
  rootPath: string;
  tree: TreeNode[];
} | null;

type RecentFile = {
  name: string;
  path: string;
  relativePath: string;
  mtimeMs: number;
};

type ElectronAPI = {
  openFolder: () => Promise<OpenFolderResult>;
  readFileText: (filePath: string) => Promise<string>;
  listRecentFiles: () => Promise<RecentFile[]>;
  listTree: () => Promise<TreeNode[]>;
  explainFile: (filePath: string, content: string) => Promise<void>;
  onExplanationChunk: (callback: (chunk: string) => void) => void;
  onExplanationDone: (callback: () => void) => void;
  onExplanationError: (callback: (err: string) => void) => void;
};

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

const openFolderButton = document.getElementById('open-folder-btn') as HTMLButtonElement;
const rootPathElement = document.getElementById('root-path') as HTMLDivElement;
const recentFilesContainer = document.getElementById('recent-files') as HTMLDivElement;
const treeContainer = document.getElementById('tree') as HTMLDivElement;
const explanationContent = document.getElementById('explanation-content') as HTMLDivElement;
const explanationLoader = document.getElementById('explanation-loader') as HTMLSpanElement;

const extensionKeys = Object.keys(SETI_FILE_EXTENSION_ICON).sort((a, b) => b.length - a.length);
const SETI_EXTENSION_FALLBACK_ICON: Record<string, string> = {
  ts: '_typescript',
  tsx: '_typescript_1',
  html: '_html',
  htm: '_html',
  css: '_css'
};
let currentTheme: 'light' | 'dark' = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
let currentTreeNodes: TreeNode[] = [];
let currentRecentFiles: RecentFile[] = [];
let currentRootPath: string | null = null;
let refreshIntervalId: number | null = null;
let currentExplainId = 0;
let explanationRawText = '';
const expandedDirectoryPaths = new Set<string>();
const relativeTimeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

function findSetiIconId(fileName: string): string | null {
  const lower = fileName.toLowerCase();
  const normalized = lower.replace(/\s*\.\s*/g, '.');
  const exactNameIcon = SETI_FILE_NAME_ICON[lower];
  if (exactNameIcon) {
    return exactNameIcon;
  }
  const exactNormalizedNameIcon = SETI_FILE_NAME_ICON[normalized];
  if (exactNormalizedNameIcon) {
    return exactNormalizedNameIcon;
  }

  for (const ext of extensionKeys) {
    if (
      normalized === ext ||
      normalized.endsWith(`.${ext}`) ||
      (ext.startsWith('.') && normalized.endsWith(ext))
    ) {
      return SETI_FILE_EXTENSION_ICON[ext];
    }
  }

  const dotIndex = normalized.lastIndexOf('.');
  if (dotIndex >= 0 && dotIndex < normalized.length - 1) {
    const lastExt = normalized.slice(dotIndex + 1);
    const fallbackIcon = SETI_EXTENSION_FALLBACK_ICON[lastExt];
    if (fallbackIcon) {
      return fallbackIcon;
    }
  }

  return null;
}

function setiGlyphToChar(glyph: string): string {
  const match = /^\\([a-f0-9]{4,6})$/i.exec(glyph);
  if (!match) {
    return '';
  }
  const codePoint = parseInt(match[1], 16);
  return String.fromCodePoint(codePoint);
}

function getFileIconGlyph(fileName: string): string {
  const iconId = findSetiIconId(fileName) ?? SETI_DEFAULT_FILE_ICON;
  const glyph = SETI_ICON_GLYPHS[iconId] ?? SETI_ICON_GLYPHS[SETI_DEFAULT_FILE_ICON];
  if (!glyph) {
    return '';
  }
  return setiGlyphToChar(glyph);
}

function getFileColor(fileName: string): string | null {
  const iconId = findSetiIconId(fileName);
  if (!iconId) {
    return getUniqueExtensionColor(fileName);
  }

  const pair = SETI_PALETTE[iconId];
  if (!pair) {
    return getUniqueExtensionColor(fileName);
  }

  const setiColor = currentTheme === 'dark' ? pair.dark : pair.light;
  return mixWithUniqueExtensionHue(fileName, setiColor);
}

function extractLastExtension(fileName: string): string {
  const normalized = fileName.toLowerCase().replace(/\s*\.\s*/g, '.');
  const index = normalized.lastIndexOf('.');
  if (index <= 0 || index === normalized.length - 1) {
    return '';
  }
  return normalized.slice(index + 1);
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash +=
      (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0;
}

function getUniqueExtensionColor(fileName: string): string | null {
  const ext = extractLastExtension(fileName);
  if (!ext) {
    return null;
  }
  const hue = hashString(ext) % 360;
  const saturation = currentTheme === 'dark' ? 68 : 72;
  const lightness = currentTheme === 'dark' ? 62 : 40;
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function parseHexColor(hexColor: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hexColor);
  if (!m) {
    return null;
  }
  const n = m[1];
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return [r, g, b];
}

function mixWithUniqueExtensionHue(fileName: string, baseHex: string): string {
  const extColor = getUniqueExtensionColor(fileName);
  const rgb = parseHexColor(baseHex);
  if (!extColor || !rgb) {
    return baseHex;
  }
  const hue = hashString(extractLastExtension(fileName)) % 360;
  const sat = currentTheme === 'dark' ? 65 : 70;
  const light = currentTheme === 'dark' ? 60 : 42;
  const extHslColor = `hsl(${hue} ${sat}% ${light}%)`;

  // Preserve some VS Code-like palette influence while guaranteeing unique extension hue.
  return `color-mix(in srgb, ${extHslColor} 72%, rgb(${rgb[0]} ${rgb[1]} ${rgb[2]}) 28%)`;
}

function createNodeElement(node: TreeNode): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'tree-node';

  const row = document.createElement('div');
  row.className = 'tree-row';
  item.appendChild(row);

  if (node.type === 'file') {
    row.classList.add('tree-file');

    const icon = document.createElement('span');
    icon.className = 'seti-file-icon';
    icon.textContent = getFileIconGlyph(node.name);
    row.appendChild(icon);

    const label = document.createElement('span');
    label.className = 'tree-label';
    label.textContent = node.name;
    row.appendChild(label);

    const fileColor = getFileColor(node.name);
    if (fileColor) {
      label.style.color = fileColor;
    }

    row.addEventListener('click', () => {
      void openFile(node.path);
    });
    return item;
  }

  row.classList.add('tree-directory');
  row.classList.add('collapsed');
  row.setAttribute('role', 'button');
  row.tabIndex = 0;
  row.textContent = node.name;

  const childList = document.createElement('ul');
  childList.className = 'tree-list';
  childList.hidden = true;

  for (const childNode of node.children ?? []) {
    childList.appendChild(createNodeElement(childNode));
  }

  const startExpanded = expandedDirectoryPaths.has(node.path);
  if (startExpanded) {
    row.classList.remove('collapsed');
    row.classList.add('expanded');
    childList.hidden = false;
  }

  const toggle = () => {
    const isCollapsed = row.classList.contains('collapsed');
    row.classList.toggle('collapsed', !isCollapsed);
    row.classList.toggle('expanded', isCollapsed);
    childList.hidden = !isCollapsed;
    if (isCollapsed) {
      expandedDirectoryPaths.add(node.path);
    } else {
      expandedDirectoryPaths.delete(node.path);
    }
  };

  row.addEventListener('click', toggle);
  row.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggle();
    }
  });

  item.appendChild(childList);
  return item;
}

function renderTree(nodes: TreeNode[]): void {
  currentTreeNodes = nodes;
  treeContainer.innerHTML = '';
  const list = document.createElement('ul');
  list.className = 'tree-list';
  for (const node of nodes) {
    list.appendChild(createNodeElement(node));
  }
  treeContainer.appendChild(list);
}

function renderRecentFiles(files: RecentFile[]): void {
  currentRecentFiles = files;
  recentFilesContainer.innerHTML = '';

  if (files.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'recent-empty';
    empty.textContent = 'No recent files';
    recentFilesContainer.appendChild(empty);
    return;
  }

  const list = document.createElement('ul');
  list.className = 'recent-list';

  for (const file of files) {
    const item = document.createElement('li');
    item.className = 'recent-item';

    const row = document.createElement('button');
    row.className = 'recent-button';
    row.type = 'button';
    row.title = file.path;

    const icon = document.createElement('span');
    icon.className = 'seti-file-icon';
    icon.textContent = getFileIconGlyph(file.name);
    row.appendChild(icon);

    const text = document.createElement('span');
    text.className = 'recent-text';
    text.textContent = file.relativePath;
    const fileColor = getFileColor(file.name);
    if (fileColor) {
      text.style.color = fileColor;
    }
    row.appendChild(text);

    const age = document.createElement('span');
    age.className = 'recent-age';
    age.textContent = formatAge(file.mtimeMs);
    age.title = new Date(file.mtimeMs).toLocaleString();
    row.appendChild(age);

    row.addEventListener('click', () => {
      void openFile(file.path);
    });

    item.appendChild(row);
    list.appendChild(item);
  }

  recentFilesContainer.appendChild(list);
}

function formatAge(mtimeMs: number): string {
  const diffSeconds = Math.max(0, Math.floor((Date.now() - mtimeMs) / 1000));
  if (diffSeconds < 60) {
    return `${diffSeconds} ${diffSeconds === 1 ? 'sec' : 'sec'}`;
  }
  if (diffSeconds < 3600) {
    return shortRelative(-Math.floor(diffSeconds / 60), 'minute');
  }
  if (diffSeconds < 86400) {
    return shortRelative(-Math.floor(diffSeconds / 3600), 'hour');
  }
  if (diffSeconds < 604800) {
    return shortRelative(-Math.floor(diffSeconds / 86400), 'day');
  }
  if (diffSeconds < 2629800) {
    return shortRelative(-Math.floor(diffSeconds / 604800), 'week');
  }
  if (diffSeconds < 31557600) {
    return shortRelative(-Math.floor(diffSeconds / 2629800), 'month');
  }
  return shortRelative(-Math.floor(diffSeconds / 31557600), 'year');
}

function shortRelative(
  value: number,
  unit: Intl.RelativeTimeFormatUnit
): string {
  const absValue = Math.abs(value);
  const full = relativeTimeFormatter.format(value, unit);
  const parts = full.split(' ');
  if (parts.length < 2) {
    return full;
  }

  const amount = parts[0];
  const word = parts[1];
  if (word.startsWith('minute')) {
    return `${amount} min`;
  }
  if (word.startsWith('hour')) {
    return `${amount} ${absValue === 1 ? 'hour' : 'hours'}`;
  }
  if (word.startsWith('day')) {
    return `${amount} ${absValue === 1 ? 'day' : 'days'}`;
  }
  if (word.startsWith('week')) {
    return `${amount} ${absValue === 1 ? 'week' : 'weeks'}`;
  }
  if (word.startsWith('month')) {
    return `${amount} ${absValue === 1 ? 'month' : 'months'}`;
  }
  if (word.startsWith('year')) {
    return `${amount} ${absValue === 1 ? 'year' : 'years'}`;
  }
  return full;
}

async function openFile(filePath: string): Promise<void> {
  currentExplainId += 1;
  const explainId = currentExplainId;

  explanationContent.innerHTML = '';
  explanationRawText = '';
  explanationContent.dataset.explainId = String(explainId);
  explanationContent.classList.remove('explanation-error');
  explanationLoader.classList.remove('hidden');
  try {
    const fileText = await window.electronAPI.readFileText(filePath);
    if (explainId !== currentExplainId) return;
    void window.electronAPI.explainFile(filePath, fileText);
  } catch (error) {
    if (explainId !== currentExplainId) return;
    explanationLoader.classList.add('hidden');
    explanationContent.innerHTML = `<p>Cannot read file: ${String(error)}</p>`;
    explanationContent.classList.add('explanation-error');
  }
}

// Set up explanation streaming listeners once
window.electronAPI.onExplanationChunk((chunk) => {
  if (explanationContent.dataset.explainId !== String(currentExplainId)) return;
  explanationRawText += chunk;
  explanationContent.innerHTML = marked.parse(explanationRawText) as string;
});

window.electronAPI.onExplanationDone(() => {
  if (explanationContent.dataset.explainId !== String(currentExplainId)) return;
  explanationLoader.classList.add('hidden');
});

window.electronAPI.onExplanationError((err) => {
  if (explanationContent.dataset.explainId !== String(currentExplainId)) return;
  explanationLoader.classList.add('hidden');
  explanationContent.innerHTML = `<p>Error: ${err}</p>`;
  explanationContent.classList.add('explanation-error');
});

async function refreshWorkspaceView(): Promise<void> {
  if (!currentRootPath) {
    return;
  }
  try {
    const [tree, recentFiles] = await Promise.all([
      window.electronAPI.listTree(),
      window.electronAPI.listRecentFiles()
    ]);
    renderTree(tree);
    renderRecentFiles(recentFiles);
  } catch {
    // Ignore transient refresh errors (for example temporary file permission race).
  }
}

function startAutoRefresh(): void {
  if (refreshIntervalId !== null) {
    window.clearInterval(refreshIntervalId);
  }
  refreshIntervalId = window.setInterval(() => {
    void refreshWorkspaceView();
  }, 5_000);
}

openFolderButton.addEventListener('click', async () => {
  const result = await window.electronAPI.openFolder();

  if (!result) {
    return;
  }

  currentRootPath = result.rootPath;
  expandedDirectoryPaths.clear();
  rootPathElement.textContent = result.rootPath;
  await refreshWorkspaceView();
  startAutoRefresh();
  editorFilePath.textContent = 'Select a file from the tree';
  editorContent.textContent = '';
});

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
  currentTheme = event.matches ? 'dark' : 'light';
  if (currentTreeNodes.length > 0) {
    renderTree(currentTreeNodes);
  }
  if (currentRecentFiles.length > 0) {
    renderRecentFiles(currentRecentFiles);
  }
});

setInterval(() => {
  if (currentRecentFiles.length > 0) {
    renderRecentFiles(currentRecentFiles);
  }
}, 30_000);

// --- Resizable panes ---

const layout = document.querySelector('.layout') as HTMLElement;
const sidebar = document.querySelector('.sidebar') as HTMLElement;

function initColResizer(
  resizerId: string,
  cssVar: string,
  getStartSize: () => number,
  sign: 1 | -1
): void {
  const resizer = document.getElementById(resizerId)!;
  resizer.addEventListener('mousedown', (e: MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startSize = getStartSize();
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    resizer.classList.add('dragging');

    const onMove = (ev: MouseEvent) => {
      const delta = (ev.clientX - startX) * sign;
      const newSize = Math.max(120, Math.min(startSize + delta, window.innerWidth - 240));
      layout.style.setProperty(cssVar, `${newSize}px`);
    };

    const onUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      resizer.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

function initRowResizer(resizerId: string): void {
  const resizer = document.getElementById(resizerId)!;
  resizer.addEventListener('mousedown', (e: MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = parseInt(getComputedStyle(sidebar).getPropertyValue('--recent-panel-h') || '140', 10);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    resizer.classList.add('dragging');

    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientY - startY;
      const newH = Math.max(60, Math.min(startH + delta, sidebar.clientHeight - 80));
      sidebar.style.setProperty('--recent-panel-h', `${newH}px`);
    };

    const onUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      resizer.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

initColResizer(
  'resizer-sidebar',
  '--col-sidebar',
  () => parseInt(getComputedStyle(layout).gridTemplateColumns.split(' ')[0], 10),
  1
);

initRowResizer('resizer-panels');

export {};
