import { contextBridge, ipcRenderer } from 'electron';
import { CHANNELS } from './channels';

export type TreeNode = {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
};

export type RecentFile = {
  name: string;
  path: string;
  relativePath: string;
  mtimeMs: number;
};

export type OpenFolderResult = {
  rootPath: string;
  tree: TreeNode[];
} | null;

export type ElectronAPI = {
  openFolder: () => Promise<OpenFolderResult>;
  fileExists: (filePath: string) => Promise<boolean>;
  listRecentFiles: () => Promise<RecentFile[]>;
  listTree: () => Promise<TreeNode[]>;
  explainRepo: (tabId: string) => Promise<void>;
  explainFile: (filePath: string, tabId: string) => Promise<void>;
  onExplanationChunk: (callback: (tabId: string, chunk: string) => void) => void;
  onExplanationDone: (callback: (tabId: string) => void) => void;
  onExplanationError: (callback: (tabId: string, err: string) => void) => void;
  onMenuOpenFolder: (callback: () => void) => void;
};

contextBridge.exposeInMainWorld('electronAPI', {
  openFolder: (): Promise<OpenFolderResult> => ipcRenderer.invoke(CHANNELS.OPEN_FOLDER),
  fileExists: (filePath: string): Promise<boolean> => ipcRenderer.invoke(CHANNELS.FILE_EXISTS, filePath),
  listRecentFiles: (): Promise<RecentFile[]> => ipcRenderer.invoke(CHANNELS.LIST_RECENT_FILES),
  listTree: (): Promise<TreeNode[]> => ipcRenderer.invoke(CHANNELS.LIST_TREE),
  explainRepo: (tabId: string): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.EXPLAIN_REPO, tabId),
  explainFile: (filePath: string, tabId: string): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.EXPLAIN_FILE, filePath, tabId),
  onExplanationChunk: (callback: (tabId: string, chunk: string) => void): void => {
    ipcRenderer.on(CHANNELS.EXPLAIN_CHUNK, (_event, tabId: string, chunk: string) => callback(tabId, chunk));
  },
  onExplanationDone: (callback: (tabId: string) => void): void => {
    ipcRenderer.on(CHANNELS.EXPLAIN_DONE, (_event, tabId: string) => callback(tabId));
  },
  onExplanationError: (callback: (tabId: string, err: string) => void): void => {
    ipcRenderer.on(CHANNELS.EXPLAIN_ERROR, (_event, tabId: string, err: string) => callback(tabId, err));
  },
  onMenuOpenFolder: (callback: () => void): void => {
    ipcRenderer.on('menu:open-folder', () => callback());
  },
});
