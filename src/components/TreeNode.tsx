import { useCallback, useEffect, useState } from "react";
import type { TranslationNode } from "../types/translation";
import { isLeaf } from "../utils/jsonHelpers";
import { matchesText, nodeMatchesSearch } from "../utils/treeSearch";

interface TreeNodeProps {
  name: string;
  value: string | TranslationNode;
  path: string[];
  onUpdate: (path: string[], value: string) => void;
  searchKey?: string;
  searchContent?: string;
  stickyPaths?: ReadonlySet<string>;
}

export default function TreeNode({
  name,
  value,
  path,
  onUpdate,
  searchKey = "",
  searchContent = "",
  stickyPaths,
}: TreeNodeProps) {
  const hasSearch = Boolean(searchKey.trim() || searchContent.trim());
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    if (hasSearch) {
      setIsOpen(true);
    }
  }, [hasSearch, searchKey, searchContent]);

  const handleValueChange = useCallback(
    (newValue: string) => {
      onUpdate(path, newValue);
    },
    [path, onUpdate],
  );

  if (!nodeMatchesSearch(name, value, searchKey, searchContent, path, stickyPaths)) {
    return null;
  }

  if (isLeaf(value)) {
    const keyHighlighted = Boolean(searchKey.trim()) && matchesText(name, searchKey.trim());
    const contentHighlighted =
      Boolean(searchContent.trim()) && matchesText(value, searchContent.trim());

    return (
      <div
        className={`tree-node tree-node--leaf${keyHighlighted || contentHighlighted ? " tree-node--match" : ""}`}
        data-path={path.join(".")}
      >
        <span
          className={`tree-node__key${keyHighlighted ? " tree-node__key--match" : ""}`}
          aria-hidden="true"
        >
          {name}
        </span>
        <input
          type="text"
          className={`tree-node__value${contentHighlighted ? " tree-node__value--match" : ""}`}
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
        <span
          className={`tree-node__key tree-node__key--branch${
            hasSearch && matchesText(name, searchKey.trim())
              ? " tree-node__key--match"
              : ""
          }`}
        >
          {name}
        </span>
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
              searchKey={searchKey}
              searchContent={searchContent}
              stickyPaths={stickyPaths}
            />
          ))}
        </div>
      )}
    </div>
  );
}
