import { contextBridge, ipcRenderer } from 'electron';
import type { TreeNode } from '../filetree/tree';
import type { RecentFile } from '../filetree/recentFiles';

export type OpenFolderResult = {
  rootPath: string;
  tree: TreeNode[];
} | null;

contextBridge.exposeInMainWorld('electronAPI', {
  openFolder: (): Promise<OpenFolderResult> => ipcRenderer.invoke('dialog:openFolder'),
  fileExists: (filePath: string): Promise<boolean> => ipcRenderer.invoke('fs:fileExists', filePath),
  listRecentFiles: (): Promise<RecentFile[]> => ipcRenderer.invoke('fs:listRecentFiles'),
  listTree: (): Promise<TreeNode[]> => ipcRenderer.invoke('fs:listTree'),
  explainFile: (filePath: string, tabId: string): Promise<void> =>
    ipcRenderer.invoke('claude:explainFile', filePath, tabId),
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
