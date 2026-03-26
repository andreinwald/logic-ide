import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

type TreeNode = {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
};

let mainWindow: BrowserWindow | null = null;
let currentRootPath: string | null = null;

async function buildTree(dirPath: string): Promise<TreeNode[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  const nodes = await Promise.all(
    entries
      .filter((entry) => !entry.name.startsWith('.'))
      .sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) {
          return a.isDirectory() ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      })
      .map(async (entry): Promise<TreeNode> => {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          return {
            name: entry.name,
            path: fullPath,
            type: 'directory',
            children: await buildTree(fullPath)
          };
        }

        return {
          name: entry.name,
          path: fullPath,
          type: 'file'
        };
      })
  );

  return nodes;
}

function isPathInsideRoot(candidatePath: string, rootPath: string): boolean {
  const normalizedRoot = path.resolve(rootPath);
  const normalizedCandidate = path.resolve(candidatePath);
  const relative = path.relative(normalizedRoot, normalizedCandidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  void mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

ipcMain.handle('dialog:openFolder', async () => {
  if (!mainWindow) {
    throw new Error('Window not initialized');
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const selectedPath = result.filePaths[0];
  currentRootPath = selectedPath;

  return {
    rootPath: selectedPath,
    tree: await buildTree(selectedPath)
  };
});

ipcMain.handle('fs:readFileText', async (_event, filePath: string) => {
  if (!currentRootPath) {
    throw new Error('No folder opened yet');
  }

  if (!isPathInsideRoot(filePath, currentRootPath)) {
    throw new Error('Requested file is outside opened folder');
  }

  const stats = await fs.stat(filePath);
  if (!stats.isFile()) {
    throw new Error('Requested path is not a file');
  }

  return fs.readFile(filePath, 'utf8');
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
