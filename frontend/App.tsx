import { useState, useEffect, useRef } from 'react';
import type { TreeNode, RecentFile } from '@bridge';
import { Tabs } from './Tabs';
import type { Tab } from './Tabs';
import { FileTree } from './FileTree';
import { RecentFiles } from './RecentFiles';
import { Chat, applyEvent } from './Chat';
import type { ChatMessage } from './Chat';
import { ElectronAPI } from './ElectronAPI';

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
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatRunning, setChatRunning] = useState(false);

  const layoutRef = useRef<HTMLElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  // Menu: Open Folder
  useEffect(() => {
    ElectronAPI.onMenuOpenFolder(() => { void handleOpenFolder(); });
  }, []);

  // Chat IPC
  useEffect(() => {
    ElectronAPI.onChatEvent((event) => {
      setChatMessages(prev => applyEvent(prev, event));
    });
    ElectronAPI.onChatDone(() => setChatRunning(false));
    ElectronAPI.onChatError((err) => {
      setChatRunning(false);
      setChatMessages(prev => [...prev, { id: String(Date.now()), role: 'agent', blocks: [{ type: 'text', messageId: String(Date.now()), text: `Error: ${err}` }] }]);
    });
  }, []);

  // IPC streaming
  useEffect(() => {
    ElectronAPI.onExplanationChunk((tabId, chunk) => {
      setTabs(prev => prev.map(t => t.id === tabId ? { ...t, rawText: t.rawText + chunk } : t));
    });
    ElectronAPI.onExplanationDone((tabId) => {
      setTabs(prev => prev.map(t => t.id === tabId ? { ...t, status: 'done' } : t));
    });
    ElectronAPI.onExplanationError((tabId, err) => {
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

    const chatResizer = document.getElementById('resizer-chat')!;
    const onChatColDown = (e: MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = parseInt(getComputedStyle(layout).getPropertyValue('--col-chat') || '320', 10);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      const onMove = (ev: MouseEvent) => {
        layout.style.setProperty('--col-chat', `${Math.max(200, Math.min(startW - (ev.clientX - startX), window.innerWidth - 400))}px`);
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
    chatResizer.addEventListener('mousedown', onChatColDown);

    return () => {
      colResizer.removeEventListener('mousedown', onColDown);
      rowResizer.removeEventListener('mousedown', onRowDown);
      chatResizer.removeEventListener('mousedown', onChatColDown);
    };
  }, []);

  async function refreshWorkspace(): Promise<void> {
    try {
      const [tree, recent] = await Promise.all([
        ElectronAPI.listTree(),
        ElectronAPI.listRecentFiles(),
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
    void ElectronAPI.explainFile(filePath, tabId);
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
    void ElectronAPI.fileExists(fullPath).then(exists => { if (exists) openFile(fullPath); });
  }

  function openRepoTab(repoName: string): string {
    const tabId = String(nextTabId++);
    setTabs(prev => [...prev, {
      id: tabId,
      filePath: '',
      fileName: repoName,
      rawText: '',
      status: 'loading',
    }]);
    setActiveTabId(tabId);
    return tabId;
  }

  function handleChatSend(message: string): void {
    const userMsg: ChatMessage = { id: String(Date.now()), role: 'user', blocks: [{ type: 'text', messageId: String(Date.now()), text: message }] };
    setChatMessages(prev => [...prev, userMsg]);
    setChatRunning(true);
    void ElectronAPI.chatSend(message);
  }

  function handleChatStop(): void {
    void ElectronAPI.chatStop();
    setChatRunning(false);
  }

  async function handleOpenFolder(): Promise<void> {
    const result = await ElectronAPI.openFolder();
    if (!result) return;
    setRootPath(result.rootPath);
    const repoName = result.rootPath.split('/').pop() ?? result.rootPath;
    document.title = `Logic IDE — ${repoName}`;
    const tabId = openRepoTab(repoName);
    const [tree, recent] = await Promise.all([
      ElectronAPI.listTree(),
      ElectronAPI.listRecentFiles(),
    ]);
    setTreeNodes(tree);
    setRecentFiles(recent);
    void ElectronAPI.explainRepo(tabId);
  }

  return (
    <main className="layout" ref={layoutRef}>
        <section className="sidebar" ref={sidebarRef}>
          {!rootPath && (
            <button id="open-folder-btn" onClick={() => void handleOpenFolder()}>Open Folder</button>
          )}
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
        <div className="resizer resizer-col" id="resizer-chat" />
        <Chat
          messages={chatMessages}
          isRunning={chatRunning}
          onSend={handleChatSend}
          onStop={handleChatStop}
        />
    </main>
  );
}
