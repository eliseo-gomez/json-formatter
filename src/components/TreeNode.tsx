import { useState, useCallback } from "react";
import type { TranslationNode } from "../types/translation";
import { isLeaf } from "../utils/jsonHelpers";

interface TreeNodeProps {
  name: string;
  value: string | TranslationNode;
  path: string[];
  onUpdate: (path: string[], value: string) => void;
}

export default function TreeNode({
  name,
  value,
  path,
  onUpdate,
}: TreeNodeProps) {
  const [isOpen, setIsOpen] = useState(true);

  const handleValueChange = useCallback(
    (newValue: string) => {
      onUpdate(path, newValue);
    },
    [path, onUpdate],
  );

  if (isLeaf(value)) {
    return (
      <div className="tree-node tree-node--leaf" data-path={path.join(".")}>
        <span className="tree-node__key" aria-hidden="true">
          {name}
        </span>
        <input
          type="text"
          className="tree-node__value"
          value={value}
          onChange={(e) => handleValueChange(e.target.value)}
          aria-label={`Edit value for ${name}`}
        />
      </div>
    );
  }

  const entries = Object.entries(value);
  return (
    <div
      className="tree-node tree-node--branch"
      role="treeitem"
      aria-expanded={isOpen}
    >
      <button
        type="button"
        className="tree-node__toggle"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label={isOpen ? `Collapse ${name}` : `Expand ${name}`}
      >
        <span className="tree-node__chevron" data-open={isOpen}>
          ▶
        </span>
        <span className="tree-node__key tree-node__key--branch">{name}</span>
      </button>
      {isOpen && (
        <div className="tree-node__children" role="group">
          {entries.map(([k, v]) => (
            <TreeNode
              key={k}
              name={k}
              value={v}
              path={[...path, k]}
              onUpdate={onUpdate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
