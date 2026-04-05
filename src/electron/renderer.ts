import type { TreeNode } from '../filetree/tree';
import type { RecentFile } from '../filetree/recentFiles';
import type { OpenFolderResult } from './preload';
import { initTabs } from './ui/tabs';
import { initFileTree } from './ui/fileTree';
import { renderRecentFiles } from './ui/recentFiles';
import { initColResizer, initRowResizer } from './ui/resizablePanes';

type ElectronAPI = {
  openFolder: () => Promise<OpenFolderResult>;
  fileExists: (filePath: string) => Promise<boolean>;
  listRecentFiles: () => Promise<RecentFile[]>;
  listTree: () => Promise<TreeNode[]>;
  explainFile: (filePath: string, tabId: string) => Promise<void>;
  onExplanationChunk: (callback: (tabId: string, chunk: string) => void) => void;
  onExplanationDone: (callback: (tabId: string) => void) => void;
  onExplanationError: (callback: (tabId: string, err: string) => void) => void;
};

declare global { interface Window { electronAPI: ElectronAPI; } }

// --- DOM refs ---
const openFolderButton = document.getElementById('open-folder-btn') as HTMLButtonElement;
const rootPathElement  = document.getElementById('root-path') as HTMLDivElement;
const recentFilesContainer = document.getElementById('recent-files') as HTMLDivElement;
const treeContainer = document.getElementById('tree') as HTMLDivElement;
const explanationContent = document.getElementById('explanation-content') as HTMLDivElement;
const tabBarEl = document.getElementById('tab-bar') as HTMLDivElement;
const layout  = document.querySelector('.layout') as HTMLElement;
const sidebar = document.querySelector('.sidebar') as HTMLElement;

// --- State ---
let currentTheme: 'light' | 'dark' = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
let currentRootPath: string | null = null;
let currentTreeNodes: TreeNode[] = [];
let currentRecentFiles: RecentFile[] = [];
let refreshIntervalId: number | null = null;

// --- UI modules ---
const tabs = initTabs(tabBarEl, explanationContent);
const fileTree = initFileTree(treeContainer, openFile);

// --- File open ---
function openFile(filePath: string): void {
  const tabId = tabs.openTab(filePath);
  if (tabId !== null) {
    void window.electronAPI.explainFile(filePath, tabId);
  }
}

// --- Link clicks in explanation ---
explanationContent.addEventListener('click', (e) => {
  const anchor = (e.target as HTMLElement).closest('a');
  if (!anchor || !currentRootPath) return;
  e.preventDefault();
  const href = anchor.getAttribute('href');
  if (!href || href.startsWith('http://') || href.startsWith('https://')) return;
  const fullPath = `${currentRootPath}/${href}`.replace(/\/+/g, '/');
  void window.electronAPI.fileExists(fullPath).then((exists) => { if (exists) openFile(fullPath); });
});

// --- IPC streaming ---
window.electronAPI.onExplanationChunk((tabId, chunk) => { tabs.onChunk(tabId, chunk); });
window.electronAPI.onExplanationDone((tabId) => { tabs.onDone(tabId); });
window.electronAPI.onExplanationError((tabId, err) => { tabs.onError(tabId, err); });

// --- Workspace refresh ---
async function refreshWorkspaceView(): Promise<void> {
  if (!currentRootPath) return;
  try {
    const [tree, recentFiles] = await Promise.all([
      window.electronAPI.listTree(),
      window.electronAPI.listRecentFiles()
    ]);
    currentTreeNodes = tree;
    currentRecentFiles = recentFiles;
    fileTree.render(tree, currentTheme);
    renderRecentFiles(recentFiles, recentFilesContainer, openFile, currentTheme);
  } catch {
    // Ignore transient refresh errors.
  }
}

function startAutoRefresh(): void {
  if (refreshIntervalId !== null) window.clearInterval(refreshIntervalId);
  refreshIntervalId = window.setInterval(() => { void refreshWorkspaceView(); }, 5_000);
}

// --- Events ---
openFolderButton.addEventListener('click', async () => {
  const result = await window.electronAPI.openFolder();
  if (!result) return;
  currentRootPath = result.rootPath;
  rootPathElement.textContent = result.rootPath;
  await refreshWorkspaceView();
  startAutoRefresh();
});

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
  currentTheme = event.matches ? 'dark' : 'light';
  if (currentTreeNodes.length > 0) fileTree.render(currentTreeNodes, currentTheme);
  if (currentRecentFiles.length > 0) renderRecentFiles(currentRecentFiles, recentFilesContainer, openFile, currentTheme);
});

setInterval(() => {
  if (currentRecentFiles.length > 0) renderRecentFiles(currentRecentFiles, recentFilesContainer, openFile, currentTheme);
}, 30_000);

// --- Resizable panes ---
initColResizer('resizer-sidebar', layout, '--col-sidebar', 1);
initRowResizer('resizer-panels', sidebar);

export {};
