import { contextBridge, ipcRenderer } from 'electron';

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

contextBridge.exposeInMainWorld('electronAPI', {
  openFolder: (): Promise<OpenFolderResult> => ipcRenderer.invoke('dialog:openFolder'),
  readFileText: (filePath: string): Promise<string> => ipcRenderer.invoke('fs:readFileText', filePath),
  listRecentFiles: (): Promise<RecentFile[]> => ipcRenderer.invoke('fs:listRecentFiles'),
  listTree: (): Promise<TreeNode[]> => ipcRenderer.invoke('fs:listTree'),
  explainFile: (filePath: string, content: string, tabId: string): Promise<void> =>
    ipcRenderer.invoke('claude:explainFile', filePath, content, tabId),
  onExplanationChunk: (callback: (tabId: string, chunk: string) => void): void => {
    ipcRenderer.on('claude:chunk', (_event, tabId: string, chunk: string) => callback(tabId, chunk));
  },
  onExplanationDone: (callback: (tabId: string) => void): void => {
    ipcRenderer.on('claude:done', (_event, tabId: string) => callback(tabId));
  },
  onExplanationError: (callback: (tabId: string, err: string) => void): void => {
    ipcRenderer.on('claude:error', (_event, tabId: string, err: string) => callback(tabId, err));
  }
});
