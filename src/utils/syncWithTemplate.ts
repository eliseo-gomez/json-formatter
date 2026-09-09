import type { TranslationNode } from "../types/translation";
import { isLeaf } from "./jsonHelpers";

export type SyncWithTemplateResult = {
  data: TranslationNode;
  newPaths: Set<string>;
  addedCount: number;
  removedCount: number;
};

function deepCloneNode(value: string | TranslationNode): string | TranslationNode {
  if (isLeaf(value)) return value;
  const clone: TranslationNode = {};
  for (const [key, child] of Object.entries(value)) {
    clone[key] = deepCloneNode(child);
  }
  return clone;
}

function collectAllPaths(
  value: string | TranslationNode,
  path: string[],
  paths: Set<string>,
): void {
  if (path.length > 0) {
    paths.add(path.join("."));
  }
  if (isLeaf(value)) return;
  for (const [key, child] of Object.entries(value)) {
    collectAllPaths(child, [...path, key], paths);
  }
}

function countRemovedKeys(
  current: TranslationNode,
  template: TranslationNode,
): number {
  let removed = 0;
  for (const key of Object.keys(current)) {
    if (!(key in template)) {
      removed += 1;
      continue;
    }
    const currentValue = current[key];
    const templateValue = template[key];
    if (!isLeaf(currentValue) && !isLeaf(templateValue)) {
      removed += countRemovedKeys(currentValue, templateValue);
    }
  }
  return removed;
}

function syncNode(
  current: TranslationNode | undefined,
  template: TranslationNode,
  path: string[],
  newPaths: Set<string>,
): TranslationNode {
  const result: TranslationNode = {};

  for (const [key, templateValue] of Object.entries(template)) {
    const nextPath = [...path, key];
    const currentValue = current?.[key];

    if (currentValue === undefined) {
      result[key] = deepCloneNode(templateValue);
      collectAllPaths(templateValue, nextPath, newPaths);
      continue;
    }

    if (!isLeaf(templateValue) && !isLeaf(currentValue)) {
      result[key] = syncNode(currentValue, templateValue, nextPath, newPaths);
      continue;
    }

    if (isLeaf(templateValue) && isLeaf(currentValue)) {
      // Preserve existing translated value
      result[key] = currentValue;
      continue;
    }

    // Structure mismatch: follow template shape, mark as new
    result[key] = deepCloneNode(templateValue);
    collectAllPaths(templateValue, nextPath, newPaths);
  }

  return result;
}

/**
 * Count nodes present in the template that are missing from current data
 * (or have a structure mismatch that sync would replace).
 */
export function countMissingTemplateNodes(
  current: TranslationNode,
  template: TranslationNode,
  path: string[] = [],
): number {
  let missing = 0;

  for (const [key, templateValue] of Object.entries(template)) {
    const nextPath = [...path, key];
    const currentValue = current[key];

    if (currentValue === undefined) {
      const paths = new Set<string>();
      collectAllPaths(templateValue, nextPath, paths);
      missing += paths.size;
      continue;
    }

    if (!isLeaf(templateValue) && !isLeaf(currentValue)) {
      missing += countMissingTemplateNodes(currentValue, templateValue, nextPath);
      continue;
    }

    if (isLeaf(templateValue) && isLeaf(currentValue)) {
      continue;
    }

    // Structure mismatch counts as needing sync
    const paths = new Set<string>();
    collectAllPaths(templateValue, nextPath, paths);
    missing += paths.size;
  }

  return missing;
}

/**
 * Sync current translation data with a template:
 * - Keep existing values for keys that exist in both
 * - Add missing keys/children from the template
 * - Remove keys/children that are not in the template
 */
export function syncWithTemplate(
  current: TranslationNode,
  template: TranslationNode,
): SyncWithTemplateResult {
  const newPaths = new Set<string>();
  const removedCount = countRemovedKeys(current, template);
  const data = syncNode(current, template, [], newPaths);

  return {
    data,
    newPaths,
    addedCount: newPaths.size,
    removedCount,
  };
}
