import { marked } from 'marked';

export type Tab = {
  id: string;
  filePath: string;
  fileName: string;
  rawText: string;
  status: 'loading' | 'done' | 'error';
};

export function initTabs(tabBar: HTMLElement, content: HTMLElement) {
  let tabs: Tab[] = [];
  let activeTabId: string | null = null;
  let nextId = 1;

  function renderTabs(): void {
    tabBar.innerHTML = '';
    for (const tab of tabs) {
      const el = document.createElement('div');
      el.className = 'tab' + (tab.id === activeTabId ? ' tab-active' : '');

      const title = document.createElement('span');
      title.className = 'tab-title';
      title.textContent = tab.fileName;
      el.appendChild(title);

      if (tab.status === 'loading') {
        const spinner = document.createElement('span');
        spinner.className = 'tab-spinner';
        el.appendChild(spinner);
      }

      const closeBtn = document.createElement('button');
      closeBtn.className = 'tab-close';
      closeBtn.textContent = '×';
      closeBtn.title = 'Close';
      closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closeTab(tab.id); });
      el.appendChild(closeBtn);

      el.addEventListener('click', () => { switchTab(tab.id); });
      tabBar.appendChild(el);
    }
  }

  function renderActiveTab(): void {
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) { content.innerHTML = ''; return; }
    if (tab.status === 'error') {
      content.innerHTML = `<p class="explanation-error-text">${tab.rawText}</p>`;
    } else {
      content.innerHTML = marked.parse(tab.rawText) as string;
    }
  }

  function switchTab(tabId: string): void {
    activeTabId = tabId;
    renderTabs();
    renderActiveTab();
  }

  function closeTab(tabId: string): void {
    const idx = tabs.findIndex((t) => t.id === tabId);
    if (idx === -1) return;
    tabs.splice(idx, 1);
    if (activeTabId === tabId) {
      activeTabId = tabs[idx]?.id ?? tabs[idx - 1]?.id ?? null;
    }
    renderTabs();
    renderActiveTab();
  }

  return {
    // Opens or switches to a tab; returns the new tabId if created, null if switched to existing.
    openTab(filePath: string): string | null {
      const existing = tabs.find((t) => t.filePath === filePath);
      if (existing) { switchTab(existing.id); return null; }
      const tabId = String(nextId++);
      tabs.push({ id: tabId, filePath, fileName: filePath.split('/').pop() ?? filePath, rawText: '', status: 'loading' });
      switchTab(tabId);
      return tabId;
    },
    onChunk(tabId: string, chunk: string): void {
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) return;
      tab.rawText += chunk;
      if (activeTabId === tabId) content.innerHTML = marked.parse(tab.rawText) as string;
    },
    onDone(tabId: string): void {
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) return;
      tab.status = 'done';
      renderTabs();
    },
    onError(tabId: string, err: string): void {
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) return;
      tab.status = 'error';
      tab.rawText = `Error: ${err}`;
      renderTabs();
      if (activeTabId === tabId) renderActiveTab();
    },
  };
}
