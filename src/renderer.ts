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

type ElectronAPI = {
  openFolder: () => Promise<OpenFolderResult>;
  readFileText: (filePath: string) => Promise<string>;
};

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

const openFolderButton = document.getElementById('open-folder-btn') as HTMLButtonElement;
const rootPathElement = document.getElementById('root-path') as HTMLDivElement;
const treeContainer = document.getElementById('tree') as HTMLDivElement;
const editorFilePath = document.getElementById('editor-file-path') as HTMLDivElement;
const editorContent = document.getElementById('editor-content') as HTMLPreElement;

function createNodeElement(node: TreeNode): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'tree-node';

  const row = document.createElement('div');
  row.className = 'tree-row';
  row.textContent = node.name;
  item.appendChild(row);

  if (node.type === 'file') {
    row.classList.add('tree-file');
    row.addEventListener('click', async () => {
      editorFilePath.textContent = node.path;
      editorContent.textContent = 'Loading...';
      try {
        const fileText = await window.electronAPI.readFileText(node.path);
        editorContent.textContent = fileText;
      } catch (error) {
        editorContent.textContent = `Cannot read file: ${String(error)}`;
      }
    });
    return item;
  }

  row.classList.add('tree-directory');
  row.classList.add('collapsed');
  row.setAttribute('role', 'button');
  row.tabIndex = 0;

  const childList = document.createElement('ul');
  childList.className = 'tree-list';
  childList.hidden = true;

  for (const childNode of node.children ?? []) {
    childList.appendChild(createNodeElement(childNode));
  }

  const toggle = () => {
    const isCollapsed = row.classList.contains('collapsed');
    row.classList.toggle('collapsed', !isCollapsed);
    row.classList.toggle('expanded', isCollapsed);
    childList.hidden = !isCollapsed;
  };

  row.addEventListener('click', toggle);
  row.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggle();
    }
  });

  item.appendChild(childList);
  return item;
}

function renderTree(nodes: TreeNode[]): void {
  treeContainer.innerHTML = '';
  const list = document.createElement('ul');
  list.className = 'tree-list';
  for (const node of nodes) {
    list.appendChild(createNodeElement(node));
  }
  treeContainer.appendChild(list);
}

openFolderButton.addEventListener('click', async () => {
  const result = await window.electronAPI.openFolder();

  if (!result) {
    return;
  }

  rootPathElement.textContent = result.rootPath;
  renderTree(result.tree);
  editorFilePath.textContent = 'Select a file from the tree';
  editorContent.textContent = '';
});

export {};
