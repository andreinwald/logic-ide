import type { RecentFile } from '@bridge';
import { getFileIconGlyph, getFileColor } from '../backend/fileicons/fileIcons';
import { formatAge } from '../backend/utils/timeFormat';

type Props = {
  files: RecentFile[];
  theme: 'light' | 'dark';
  onFileClick: (path: string) => void;
};

export function RecentFiles({ files, theme, onFileClick }: Props) {
  if (files.length === 0) {
    return <div className="recent-empty">No recent files</div>;
  }
  return (
    <ul className="recent-list">
      {files.map(file => {
        const color = getFileColor(file.name, theme);
        return (
          <li key={file.path} className="recent-item">
            <button
              className="recent-button"
              type="button"
              title={file.path}
              onClick={() => onFileClick(file.path)}
            >
              <span className="seti-file-icon">{getFileIconGlyph(file.name)}</span>
              <span className="recent-text" style={color ? { color } : undefined}>{file.relativePath}</span>
              <span className="recent-age" title={new Date(file.mtimeMs).toLocaleString()}>
                {formatAge(file.mtimeMs)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
