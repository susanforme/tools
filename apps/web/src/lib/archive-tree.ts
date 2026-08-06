import type { DroppedFile } from '@/components/file-dropzone';
import type { ExtractedArchiveFile } from './archive';

export const ARCHIVE_TREE_ROOT = 'archive-root';

export type ArchiveTreeNode = {
  children: string[];
  data?: ArrayBuffer;
  file?: File;
  id: string;
  kind: 'file' | 'folder';
  name: string;
  size: number;
};

export type ArchiveTreeNodes = Record<string, ArchiveTreeNode>;

export type ArchiveTreeEntry = {
  data?: ArrayBuffer;
  directory: boolean;
  file?: File;
  path: string;
  size: number;
};

export function createArchiveTree(): ArchiveTreeNodes {
  return {
    [ARCHIVE_TREE_ROOT]: {
      children: [],
      id: ARCHIVE_TREE_ROOT,
      kind: 'folder',
      name: 'root',
      size: 0,
    },
  };
}

function pathParts(path: string): string[] {
  return path
    .replaceAll('\\', '/')
    .split('/')
    .map((part) => part.trim())
    .filter((part) => part && part !== '.' && part !== '..');
}

function childWithName(
  nodes: ArchiveTreeNodes,
  parentId: string,
  name: string,
  kind?: ArchiveTreeNode['kind'],
): ArchiveTreeNode | null {
  const childId = nodes[parentId]?.children.find((id) => {
    const child = nodes[id];
    return child?.name === name && (!kind || child.kind === kind);
  });
  return childId ? nodes[childId]! : null;
}

function uniqueName(
  nodes: ArchiveTreeNodes,
  parentId: string,
  requested: string,
): string {
  if (!childWithName(nodes, parentId, requested)) return requested;
  const dot = requested.lastIndexOf('.');
  const base = dot > 0 ? requested.slice(0, dot) : requested;
  const extension = dot > 0 ? requested.slice(dot) : '';
  let index = 2;
  while (childWithName(nodes, parentId, `${base} (${index})${extension}`)) {
    index += 1;
  }
  return `${base} (${index})${extension}`;
}

function appendChild(
  nodes: ArchiveTreeNodes,
  parentId: string,
  child: ArchiveTreeNode,
): void {
  const parent = nodes[parentId];
  if (!parent || parent.kind !== 'folder') return;
  nodes[child.id] = child;
  nodes[parentId] = { ...parent, children: [...parent.children, child.id] };
}

function ensureFolder(
  nodes: ArchiveTreeNodes,
  parentId: string,
  name: string,
): string {
  const existing = childWithName(nodes, parentId, name, 'folder');
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  appendChild(nodes, parentId, {
    children: [],
    id,
    kind: 'folder',
    name: uniqueName(nodes, parentId, name),
    size: 0,
  });
  return id;
}

export function addArchiveFiles(
  current: ArchiveTreeNodes,
  dropped: DroppedFile[],
): ArchiveTreeNodes {
  const nodes = { ...current };
  for (const item of dropped) {
    const parts = pathParts(item.path);
    if (parts.length === 0) continue;
    let parentId = ARCHIVE_TREE_ROOT;
    for (const folder of parts.slice(0, -1)) {
      parentId = ensureFolder(nodes, parentId, folder);
    }
    const name = uniqueName(nodes, parentId, parts.at(-1)!);
    appendChild(nodes, parentId, {
      children: [],
      file: item.file,
      id: crypto.randomUUID(),
      kind: 'file',
      name,
      size: item.file.size,
    });
  }
  return nodes;
}

export function addArchiveFolder(
  current: ArchiveTreeNodes,
  parentId: string,
  requestedName: string,
): ArchiveTreeNodes {
  const nodes = { ...current };
  const parent = nodes[parentId];
  const name = requestedName.trim();
  if (!name || !parent || parent.kind !== 'folder') return current;
  ensureFolder(nodes, parentId, name);
  return nodes;
}

export function removeArchiveNodes(
  current: ArchiveTreeNodes,
  selectedIds: string[],
): ArchiveTreeNodes {
  const selected = new Set(
    selectedIds.filter((id) => id !== ARCHIVE_TREE_ROOT),
  );
  if (selected.size === 0) return current;
  const nodes = { ...current };
  const removeRecursively = (id: string) => {
    nodes[id]?.children.forEach(removeRecursively);
    delete nodes[id];
  };
  selected.forEach(removeRecursively);
  Object.entries(nodes).forEach(([id, node]) => {
    const children = node.children.filter((childId) => !selected.has(childId));
    if (children.length !== node.children.length) {
      nodes[id] = { ...node, children };
    }
  });
  return nodes;
}

export function archiveTreeEntries(
  nodes: ArchiveTreeNodes,
): ArchiveTreeEntry[] {
  const entries: ArchiveTreeEntry[] = [];
  const visit = (id: string, parentPath: string) => {
    const node = nodes[id];
    if (!node) return;
    const path = parentPath ? `${parentPath}/${node.name}` : node.name;
    entries.push({
      data: node.data,
      directory: node.kind === 'folder',
      file: node.file,
      path,
      size: node.size,
    });
    node.children.forEach((childId) => visit(childId, path));
  };
  nodes[ARCHIVE_TREE_ROOT]?.children.forEach((id) => visit(id, ''));
  return entries;
}

export function extractedFilesToTree(
  files: ExtractedArchiveFile[],
): ArchiveTreeNodes {
  const nodes = createArchiveTree();
  for (const file of files) {
    const parts = pathParts(file.name);
    if (parts.length === 0) continue;
    let parentId = ARCHIVE_TREE_ROOT;
    for (const folder of parts.slice(0, -1)) {
      parentId = ensureFolder(nodes, parentId, folder);
    }
    if (file.directory) {
      ensureFolder(nodes, parentId, parts.at(-1)!);
      continue;
    }
    appendChild(nodes, parentId, {
      children: [],
      data: file.data,
      id: crypto.randomUUID(),
      kind: 'file',
      name: uniqueName(nodes, parentId, parts.at(-1)!),
      size: file.size,
    });
  }
  return nodes;
}
