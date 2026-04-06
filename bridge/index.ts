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

export type ChatEvent =
  | { type: 'agent_text_chunk'; messageId: string; text: string }
  | { type: 'agent_thought_chunk'; messageId: string; text: string }
  | { type: 'tool_call'; toolCallId: string; title: string; kind?: string; status: string }
  | { type: 'tool_call_update'; toolCallId: string; title?: string; status?: string; kind?: string };

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
  chatSend: (message: string) => Promise<void>;
  chatStop: () => Promise<void>;
  onChatEvent: (callback: (event: ChatEvent) => void) => void;
  onChatDone: (callback: () => void) => void;
  onChatError: (callback: (err: string) => void) => void;
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
  chatSend: (message: string): Promise<void> => ipcRenderer.invoke(CHANNELS.CHAT_SEND, message),
  chatStop: (): Promise<void> => ipcRenderer.invoke(CHANNELS.CHAT_STOP),
  onChatEvent: (callback: (event: ChatEvent) => void): void => {
    ipcRenderer.on(CHANNELS.CHAT_EVENT, (_event, chatEvent: ChatEvent) => callback(chatEvent));
  },
  onChatDone: (callback: () => void): void => {
    ipcRenderer.on(CHANNELS.CHAT_DONE, () => callback());
  },
  onChatError: (callback: (err: string) => void): void => {
    ipcRenderer.on(CHANNELS.CHAT_ERROR, (_event, err: string) => callback(err));
  },
});
