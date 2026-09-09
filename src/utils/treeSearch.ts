import type { TranslationNode } from "../types/translation";
import { isLeaf } from "./jsonHelpers";

export function matchesText(source: string, query: string): boolean {
  if (!query) return true;
  return source.toLowerCase().includes(query.toLowerCase());
}

export function isPathSticky(path: string[], stickyPaths: ReadonlySet<string>): boolean {
  if (stickyPaths.size === 0) return false;
  const joined = path.join(".");
  for (const sticky of stickyPaths) {
    if (sticky === joined) return true;
    // Path is an ancestor of a sticky match (keep branch open/visible)
    if (sticky.startsWith(`${joined}.`)) return true;
    // Path is under a sticky branch (e.g. key-only match on parent)
    if (joined.startsWith(`${sticky}.`)) return true;
  }
  return false;
}

export function nodeMatchesSearch(
  name: string,
  value: string | TranslationNode,
  searchKey: string,
  searchContent: string,
  path: string[] = [name],
  stickyPaths?: ReadonlySet<string>,
): boolean {
  const keyQuery = searchKey.trim();
  const contentQuery = searchContent.trim();

  if (!keyQuery && !contentQuery) return true;

  if (stickyPaths && isPathSticky(path, stickyPaths)) {
    return true;
  }

  const keyMatches = !keyQuery || matchesText(name, keyQuery);

  if (isLeaf(value)) {
    const contentMatches = !contentQuery || matchesText(value, contentQuery);
    return keyMatches && contentMatches;
  }

  // Branch: keep if this key matches (when searching by key only),
  // or if any descendant matches the combined criteria.
  if (keyQuery && !contentQuery && keyMatches) {
    return true;
  }

  return Object.entries(value).some(([childKey, childValue]) =>
    nodeMatchesSearch(
      childKey,
      childValue,
      searchKey,
      searchContent,
      [...path, childKey],
      stickyPaths,
    ),
  );
}

export function collectMatchingPaths(
  data: TranslationNode,
  searchKey: string,
  searchContent: string,
  parentPath: string[] = [],
): string[] {
  const keyQuery = searchKey.trim();
  const contentQuery = searchContent.trim();
  if (!keyQuery && !contentQuery) return [];

  const paths: string[] = [];

  for (const [key, value] of Object.entries(data)) {
    const path = [...parentPath, key];
    const joined = path.join(".");

    if (isLeaf(value)) {
      if (nodeMatchesSearch(key, value, searchKey, searchContent, path)) {
        paths.push(joined);
      }
      continue;
    }

    if (keyQuery && !contentQuery && matchesText(key, keyQuery)) {
      paths.push(joined);
    }

    paths.push(...collectMatchingPaths(value, searchKey, searchContent, path));
  }

  return paths;
}
