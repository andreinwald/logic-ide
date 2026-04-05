import { getFileIconGlyph, getFileColor } from '../../fileicons/fileIcons';
import type { TreeNode } from '../../filetree/tree';

export function initFileTree(container: HTMLElement, onFileClick: (path: string) => void) {
  const expandedPaths = new Set<string>();

  function createNodeElement(node: TreeNode, theme: 'light' | 'dark'): HTMLLIElement {
    const item = document.createElement('li');
    item.className = 'tree-node';
    const row = document.createElement('div');
    row.className = 'tree-row';
    item.appendChild(row);

    if (node.type === 'file') {
      row.classList.add('tree-file');
      const icon = document.createElement('span');
      icon.className = 'seti-file-icon';
      icon.textContent = getFileIconGlyph(node.name);
      row.appendChild(icon);
      const label = document.createElement('span');
      label.className = 'tree-label';
      label.textContent = node.name;
      const color = getFileColor(node.name, theme);
      if (color) label.style.color = color;
      row.appendChild(label);
      row.addEventListener('click', () => { onFileClick(node.path); });
      return item;
    }

    row.classList.add('tree-directory');
    row.setAttribute('role', 'button');
    row.tabIndex = 0;
    row.textContent = node.name;

    const childList = document.createElement('ul');
    childList.className = 'tree-list';
    childList.hidden = true;
    for (const child of node.children ?? []) childList.appendChild(createNodeElement(child, theme));

    if (expandedPaths.has(node.path)) {
      row.classList.add('expanded');
      childList.hidden = false;
    } else {
      row.classList.add('collapsed');
    }

    const toggle = () => {
      const isCollapsed = row.classList.contains('collapsed');
      row.classList.toggle('collapsed', !isCollapsed);
      row.classList.toggle('expanded', isCollapsed);
      childList.hidden = !isCollapsed;
      if (isCollapsed) expandedPaths.add(node.path);
      else expandedPaths.delete(node.path);
    };

    row.addEventListener('click', toggle);
    row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    item.appendChild(childList);
    return item;
  }

  return {
    render(nodes: TreeNode[], theme: 'light' | 'dark'): void {
      container.innerHTML = '';
      const list = document.createElement('ul');
      list.className = 'tree-list';
      for (const node of nodes) list.appendChild(createNodeElement(node, theme));
      container.appendChild(list);
    },
  };
}
