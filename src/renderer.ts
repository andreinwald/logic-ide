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

type ElectronAPI = {
  openFolder: () => Promise<OpenFolderResult>;
  readFileText: (filePath: string) => Promise<string>;
};

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

const openFolderButton = document.getElementById('open-folder-btn') as HTMLButtonElement;
const rootPathElement = document.getElementById('root-path') as HTMLDivElement;
const treeContainer = document.getElementById('tree') as HTMLDivElement;
const editorFilePath = document.getElementById('editor-file-path') as HTMLDivElement;
const editorContent = document.getElementById('editor-content') as HTMLPreElement;

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

    row.addEventListener('click', async () => {
      editorFilePath.textContent = node.path;
      editorContent.textContent = 'Loading...';
      try {
        const fileText = await window.electronAPI.readFileText(node.path);
        editorContent.textContent = fileText;
      } catch (error) {
        editorContent.textContent = `Cannot read file: ${String(error)}`;
      }
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

  const toggle = () => {
    const isCollapsed = row.classList.contains('collapsed');
    row.classList.toggle('collapsed', !isCollapsed);
    row.classList.toggle('expanded', isCollapsed);
    childList.hidden = !isCollapsed;
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

openFolderButton.addEventListener('click', async () => {
  const result = await window.electronAPI.openFolder();

  if (!result) {
    return;
  }

  rootPathElement.textContent = result.rootPath;
  renderTree(result.tree);
  editorFilePath.textContent = 'Select a file from the tree';
  editorContent.textContent = '';
});

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
  currentTheme = event.matches ? 'dark' : 'light';
  if (currentTreeNodes.length > 0) {
    renderTree(currentTreeNodes);
  }
});

export {};
