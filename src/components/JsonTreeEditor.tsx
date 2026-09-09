import { useEffect, useMemo, useState } from "react";
import type { TranslationNode } from "../types/translation";
import { collectMatchingPaths, nodeMatchesSearch } from "../utils/treeSearch";
import TreeNode from "./TreeNode";

interface JsonTreeEditorProps {
  data: TranslationNode;
  onUpdate: (path: string[], value: string) => void;
  newPaths?: ReadonlySet<string>;
}

export default function JsonTreeEditor({
  data,
  onUpdate,
  newPaths,
}: JsonTreeEditorProps) {
  const [searchKey, setSearchKey] = useState("");
  const [searchContent, setSearchContent] = useState("");
  const [stickyPaths, setStickyPaths] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const hasSearch = Boolean(searchKey.trim() || searchContent.trim());

  // Recompute sticky matches only when the search query changes,
  // so editing a value won't remove it from the current result set.
  useEffect(() => {
    if (!hasSearch) {
      setStickyPaths(new Set());
      return;
    }

    setStickyPaths(
      new Set(collectMatchingPaths(data, searchKey, searchContent)),
    );
    // Intentionally omit `data` so edits don't recalculate sticky paths.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKey, searchContent, hasSearch]);

  const visibleEntries = useMemo(() => {
    return Object.entries(data).filter(([key, value]) =>
      nodeMatchesSearch(key, value, searchKey, searchContent, [key], stickyPaths),
    );
  }, [data, searchKey, searchContent, stickyPaths]);

  return (
    <div className="json-tree-editor">
      <div className="tree-search" aria-label="Search translation tree">
        <label className="field">
          <span>Search by key</span>
          <input
            type="search"
            value={searchKey}
            onChange={(e) => setSearchKey(e.target.value)}
            placeholder="e.g. welcome, title..."
          />
        </label>
        <label className="field">
          <span>Search by content</span>
          <input
            type="search"
            value={searchContent}
            onChange={(e) => setSearchContent(e.target.value)}
            placeholder="e.g. Hello, Continue..."
          />
        </label>
      </div>

      {hasSearch && (
        <p className="tree-search__info">
          {visibleEntries.length === 0
            ? "No matching keys or content."
            : `Showing matches for key/content filters.`}
        </p>
      )}

      {newPaths && newPaths.size > 0 && (
        <p className="tree-search__info tree-search__info--synced">
          {newPaths.size} new node{newPaths.size === 1 ? "" : "s"} added from template
          (highlighted in green).
        </p>
      )}

      <div className="json-tree-editor__tree" role="tree">
        {visibleEntries.map(([key, value]) => (
          <TreeNode
            key={key}
            name={key}
            value={value}
            path={[key]}
            onUpdate={onUpdate}
            searchKey={searchKey}
            searchContent={searchContent}
            stickyPaths={stickyPaths}
            newPaths={newPaths}
          />
        ))}
      </div>
    </div>
  );
}
