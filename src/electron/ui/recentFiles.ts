import { getFileIconGlyph, getFileColor } from '../../fileicons/fileIcons';
import { formatAge } from '../../utils/timeFormat';
import type { RecentFile } from '../../filetree/recentFiles';

export function renderRecentFiles(
  files: RecentFile[],
  container: HTMLElement,
  onFileClick: (path: string) => void,
  theme: 'light' | 'dark'
): void {
  container.innerHTML = '';

  if (files.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'recent-empty';
    empty.textContent = 'No recent files';
    container.appendChild(empty);
    return;
  }

  const list = document.createElement('ul');
  list.className = 'recent-list';

  for (const file of files) {
    const item = document.createElement('li');
    item.className = 'recent-item';

    const row = document.createElement('button');
    row.className = 'recent-button';
    row.type = 'button';
    row.title = file.path;

    const icon = document.createElement('span');
    icon.className = 'seti-file-icon';
    icon.textContent = getFileIconGlyph(file.name);
    row.appendChild(icon);

    const text = document.createElement('span');
    text.className = 'recent-text';
    text.textContent = file.relativePath;
    const color = getFileColor(file.name, theme);
    if (color) text.style.color = color;
    row.appendChild(text);

    const age = document.createElement('span');
    age.className = 'recent-age';
    age.textContent = formatAge(file.mtimeMs);
    age.title = new Date(file.mtimeMs).toLocaleString();
    row.appendChild(age);

    row.addEventListener('click', () => { onFileClick(file.path); });
    item.appendChild(row);
    list.appendChild(item);
  }

  container.appendChild(list);
}
