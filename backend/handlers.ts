import { dialog, ipcMain, BrowserWindow } from 'electron';
import * as fs from 'node:fs/promises';
import { buildTree, treeToString } from './filetree/tree';
import { collectRecentFiles } from './filetree/recentFiles';
import { explainer } from './explainer/explainer';
import { CHANNELS } from '../bridge/channels';

let currentRootPath: string | null = null;

export function registerHandlers({ getWindow }: {
  getWindow: () => BrowserWindow | null;
}): void {
  ipcMain.handle(CHANNELS.OPEN_FOLDER, async () => {
    const win = getWindow();
    if (!win) throw new Error('Window not initialized');
    const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
    if (result.canceled || result.filePaths.length === 0) return null;
    const rootPath = result.filePaths[0];
    currentRootPath = rootPath;
    return { rootPath, tree: await buildTree(rootPath) };
  });

  ipcMain.handle(CHANNELS.FILE_EXISTS, async (_event, filePath: string) => {
    try { return (await fs.stat(filePath)).isFile(); } catch { return false; }
  });

  ipcMain.handle(CHANNELS.LIST_RECENT_FILES, async () => {
    const rootPath = currentRootPath;
    if (!rootPath) throw new Error('No folder opened yet');
    return collectRecentFiles(rootPath, 50);
  });

  ipcMain.handle(CHANNELS.LIST_TREE, async () => {
    const rootPath = currentRootPath;
    if (!rootPath) throw new Error('No folder opened yet');
    return buildTree(rootPath);
  });

  ipcMain.handle(CHANNELS.EXPLAIN_FILE, async (event, filePath: string, tabId: string) => {
    const rootPath = currentRootPath;
    if (!rootPath) { event.sender.send(CHANNELS.EXPLAIN_ERROR, tabId, 'No folder opened yet'); return; }
    const fileStructure = treeToString(await buildTree(rootPath));
    await explainer(
      filePath,
      fileStructure,
      (chunk) => { event.sender.send(CHANNELS.EXPLAIN_CHUNK, tabId, chunk); },
      () => { event.sender.send(CHANNELS.EXPLAIN_DONE, tabId); },
      (err) => { event.sender.send(CHANNELS.EXPLAIN_ERROR, tabId, err); },
    );
  });
}
