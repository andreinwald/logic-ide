import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { buildTree, treeToString } from './filetree/tree';
import { collectRecentFiles } from './filetree/recentFiles';
import { explainer } from './explainer/explainer';

let mainWindow: BrowserWindow | null = null;
let currentRootPath: string | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  const devServerUrl = process.env['VITE_DEV_SERVER_URL'];
  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
  } else {
    void mainWindow.loadFile(path.join(__dirname, 'index.html'));
  }
}

ipcMain.handle('dialog:openFolder', async () => {
  if (!mainWindow) throw new Error('Window not initialized');
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  if (result.canceled || result.filePaths.length === 0) return null;
  currentRootPath = result.filePaths[0];
  return { rootPath: currentRootPath, tree: await buildTree(currentRootPath) };
});

ipcMain.handle('fs:fileExists', async (_event, filePath: string) => {
  try { return (await fs.stat(filePath)).isFile(); } catch { return false; }
});

ipcMain.handle('fs:listRecentFiles', async () => {
  if (!currentRootPath) throw new Error('No folder opened yet');
  return collectRecentFiles(currentRootPath, 50);
});

ipcMain.handle('fs:listTree', async () => {
  if (!currentRootPath) throw new Error('No folder opened yet');
  return buildTree(currentRootPath);
});

ipcMain.handle('claude:explainFile', async (event, filePath: string, tabId: string) => {
  if (!currentRootPath) { event.sender.send('claude:error', tabId, 'No folder opened yet'); return; }
  const fileStructure = treeToString(await buildTree(currentRootPath));
  await explainer(
    filePath,
    fileStructure,
    (chunk) => { event.sender.send('claude:chunk', tabId, chunk); },
    () => { event.sender.send('claude:done', tabId); },
    (err) => { event.sender.send('claude:error', tabId, err); },
  );
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
