import type { TranslationNode } from '../types/translation';

export function isLeaf(value: string | TranslationNode): value is string {
  return typeof value === 'string';
}

export function getByPath(
  obj: TranslationNode,
  path: string[]
): string | TranslationNode | undefined {
  if (path.length === 0) return obj;
  let current: string | TranslationNode | undefined = obj;
  for (const key of path) {
    if (current === undefined || isLeaf(current)) return undefined;
    current = current[key];
  }
  return current;
}

export function setByPath(
  obj: TranslationNode,
  path: string[],
  value: string
): TranslationNode {
  if (path.length === 0) return obj;
  if (path.length === 1) {
    const [key] = path;
    return { ...obj, [key]: value };
  }
  const [head, ...rest] = path;
  const child = obj[head];
  const updatedChild =
    child !== undefined && !isLeaf(child)
      ? setByPath(child, rest, value)
      : (rest.length === 1 ? { [rest[0]]: value } : setByPath({}, rest, value));
  return { ...obj, [head]: updatedChild };
}

export function validateTranslationJson(
  value: unknown
): true | { error: string } {
  if (value === null || typeof value !== 'object') {
    return { error: 'Root must be an object.' };
  }
  if (Array.isArray(value)) {
    return { error: 'Arrays are not allowed in translation JSON.' };
  }
  return validateNode(value as Record<string, unknown>, []);
}

function validateNode(
  obj: Record<string, unknown>,
  path: string[]
): true | { error: string } {
  const pathStr = path.length ? path.join('.') : '(root)';
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'string') continue;
    if (val === null || typeof val !== 'object') {
      return { error: `Invalid value at "${pathStr}.${key}": expected string or object.` };
    }
    if (Array.isArray(val)) {
      return { error: `Arrays are not allowed at "${pathStr}.${key}".` };
    }
    const result = validateNode(val as Record<string, unknown>, [...path, key]);
    if (result !== true) return result;
  }
  return true;
}

export function formatForExport(obj: TranslationNode): string {
  return JSON.stringify(obj, null, 2);
}
