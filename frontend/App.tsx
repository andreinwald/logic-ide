import { useState, useEffect, useRef } from 'react';
import type { TreeNode, RecentFile } from '@bridge';
import type { OpenFolderResult } from '@bridge';
import { Tabs } from './Tabs';
import type { Tab } from './Tabs';
import { FileTree } from './FileTree';
import { RecentFiles } from './RecentFiles';

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

let nextTabId = 1;

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  );
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([]);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const layoutRef = useRef<HTMLElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  // IPC streaming
  useEffect(() => {
    window.electronAPI.onExplanationChunk((tabId, chunk) => {
      setTabs(prev => prev.map(t => t.id === tabId ? { ...t, rawText: t.rawText + chunk } : t));
    });
    window.electronAPI.onExplanationDone((tabId) => {
      setTabs(prev => prev.map(t => t.id === tabId ? { ...t, status: 'done' } : t));
    });
    window.electronAPI.onExplanationError((tabId, err) => {
      setTabs(prev => prev.map(t => t.id === tabId ? { ...t, status: 'error', rawText: `Error: ${err}` } : t));
    });
  }, []);

  // Theme
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setTheme(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Refresh recent file ages every 30s
  useEffect(() => {
    const id = window.setInterval(() => setRecentFiles(prev => [...prev]), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Auto-refresh workspace every 5s
  useEffect(() => {
    if (!rootPath) return;
    const id = window.setInterval(() => { void refreshWorkspace(); }, 5_000);
    return () => window.clearInterval(id);
  }, [rootPath]);

  // Resizable panes
  useEffect(() => {
    const layout = layoutRef.current;
    const sidebar = sidebarRef.current;
    if (!layout || !sidebar) return;

    const colResizer = document.getElementById('resizer-sidebar')!;
    const onColDown = (e: MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = parseInt(getComputedStyle(layout).gridTemplateColumns.split(' ')[0], 10);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      const onMove = (ev: MouseEvent) => {
        layout.style.setProperty('--col-sidebar', `${Math.max(120, Math.min(startW + ev.clientX - startX, window.innerWidth - 240))}px`);
      };
      const onUp = () => {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    };
    colResizer.addEventListener('mousedown', onColDown);

    const rowResizer = document.getElementById('resizer-panels')!;
    const onRowDown = (e: MouseEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startH = parseInt(getComputedStyle(sidebar).getPropertyValue('--recent-panel-h') || '140', 10);
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
      const onMove = (ev: MouseEvent) => {
        sidebar.style.setProperty('--recent-panel-h', `${Math.max(60, Math.min(startH + ev.clientY - startY, sidebar.clientHeight - 80))}px`);
      };
      const onUp = () => {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    };
    rowResizer.addEventListener('mousedown', onRowDown);

    return () => {
      colResizer.removeEventListener('mousedown', onColDown);
      rowResizer.removeEventListener('mousedown', onRowDown);
    };
  }, []);

  async function refreshWorkspace(): Promise<void> {
    try {
      const [tree, recent] = await Promise.all([
        window.electronAPI.listTree(),
        window.electronAPI.listRecentFiles(),
      ]);
      setTreeNodes(tree);
      setRecentFiles(recent);
    } catch {
      // ignore transient errors
    }
  }

  function openFile(filePath: string): void {
    const existing = tabs.find(t => t.filePath === filePath);
    if (existing) { setActiveTabId(existing.id); return; }
    const tabId = String(nextTabId++);
    setTabs(prev => [...prev, {
      id: tabId,
      filePath,
      fileName: filePath.split('/').pop() ?? filePath,
      rawText: '',
      status: 'loading',
    }]);
    setActiveTabId(tabId);
    void window.electronAPI.explainFile(filePath, tabId);
  }

  function closeTab(tabId: string): void {
    const idx = tabs.findIndex(t => t.id === tabId);
    if (idx === -1) return;
    const next = tabs.filter(t => t.id !== tabId);
    setTabs(next);
    if (activeTabId === tabId) setActiveTabId(next[idx]?.id ?? next[idx - 1]?.id ?? null);
  }

  function handleLinkClick(href: string): void {
    if (!rootPath) return;
    const fullPath = `${rootPath}/${href}`.replace(/\/+/g, '/');
    void window.electronAPI.fileExists(fullPath).then(exists => { if (exists) openFile(fullPath); });
  }

  async function handleOpenFolder(): Promise<void> {
    const result = await window.electronAPI.openFolder();
    if (!result) return;
    setRootPath(result.rootPath);
    const [tree, recent] = await Promise.all([
      window.electronAPI.listTree(),
      window.electronAPI.listRecentFiles(),
    ]);
    setTreeNodes(tree);
    setRecentFiles(recent);
  }

  return (
    <>
      <header className="topbar">
        <button id="open-folder-btn" onClick={() => void handleOpenFolder()}>Open Folder</button>
        <div id="root-path">{rootPath ?? 'No folder opened'}</div>
      </header>
      <main className="layout" ref={layoutRef}>
        <section className="sidebar" ref={sidebarRef}>
          <section className="sidebar-panel recent-panel">
            <h2>Recent Files</h2>
            <RecentFiles files={recentFiles} theme={theme} onFileClick={openFile} />
          </section>
          <div className="resizer resizer-row" id="resizer-panels" />
          <section className="sidebar-panel tree-panel">
            <h2>Explorer</h2>
            <FileTree nodes={treeNodes} theme={theme} onFileClick={openFile} />
          </section>
        </section>
        <div className="resizer resizer-col" id="resizer-sidebar" />
        <section className="explanation-pane">
          <Tabs
            tabs={tabs}
            activeTabId={activeTabId}
            onSwitch={setActiveTabId}
            onClose={closeTab}
            onLinkClick={handleLinkClick}
          />
        </section>
      </main>
    </>
  );
}
