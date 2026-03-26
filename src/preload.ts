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
  listTree: (): Promise<TreeNode[]> => ipcRenderer.invoke('fs:listTree')
});
