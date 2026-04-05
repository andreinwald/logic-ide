import { useState } from 'react';
import type { TreeNode } from '@bridge';
import { getFileIconGlyph, getFileColor } from '../backend/fileicons/fileIcons';

type Props = {
  nodes: TreeNode[];
  theme: 'light' | 'dark';
  onFileClick: (path: string) => void;
};

export function FileTree({ nodes, theme, onFileClick }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(path: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function renderNode(node: TreeNode) {
    if (node.type === 'file') {
      const color = getFileColor(node.name, theme);
      return (
        <li key={node.path} className="tree-node">
          <div className="tree-row tree-file" onClick={() => onFileClick(node.path)}>
            <span className="seti-file-icon">{getFileIconGlyph(node.name)}</span>
            <span className="tree-label" style={color ? { color } : undefined}>{node.name}</span>
          </div>
        </li>
      );
    }

    const isExpanded = expanded.has(node.path);
    return (
      <li key={node.path} className="tree-node">
        <div
          className={`tree-row tree-directory ${isExpanded ? 'expanded' : 'collapsed'}`}
          role="button"
          tabIndex={0}
          onClick={() => toggle(node.path)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(node.path); } }}
        >
          {node.name}
        </div>
        {isExpanded && (
          <ul className="tree-list">
            {(node.children ?? []).map(renderNode)}
          </ul>
        )}
      </li>
    );
  }

  return <ul className="tree-list">{nodes.map(renderNode)}</ul>;
}
