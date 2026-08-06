import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Tree,
  TreeDragLine,
  TreeItem,
  TreeItemLabel,
} from '@/components/reui/tree';
import {
  createOnDropHandler,
  dragAndDropFeature,
  hotkeysCoreFeature,
  selectionFeature,
  syncDataLoaderFeature,
} from '@headless-tree/core';
import { useTree } from '@headless-tree/react';
import {
  Download,
  File,
  Folder,
  FolderInput,
  FolderPlus,
  LoaderCircle,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDropzone, type DroppedFile } from './file-dropzone';
import {
  addArchiveFolder,
  ARCHIVE_TREE_ROOT,
  archiveTreeEntries,
  removeArchiveNodes,
  type ArchiveTreeNode,
  type ArchiveTreeNodes,
} from '@/lib/archive-tree';

type ArchiveFileBrowserProps = {
  busy?: boolean;
  editable?: boolean;
  nodes: ArchiveTreeNodes;
  onDownloadAll?: () => void;
  onFiles?: (files: DroppedFile[]) => void;
  setNodes?: Dispatch<SetStateAction<ArchiveTreeNodes>>;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ArchiveFileBrowser({
  busy = false,
  editable = false,
  nodes,
  onDownloadAll,
  onFiles,
  setNodes,
}: ArchiveFileBrowserProps) {
  const { t } = useTranslation();
  const [folderName, setFolderName] = useState('');
  const tree = useTree<ArchiveTreeNode>({
    rootItemId: ARCHIVE_TREE_ROOT,
    getItemName: (item) => item.getItemData().name,
    isItemFolder: (item) => item.getItemData().kind === 'folder',
    dataLoader: {
      getItem: (id) => nodes[id]!,
      getChildren: (id) => nodes[id]?.children ?? [],
    },
    indent: 20,
    initialState: { expandedItems: [ARCHIVE_TREE_ROOT] },
    canReorder: editable,
    canDrag: () => editable,
    canDrop: (items, target) =>
      editable &&
      !items.some(
        (item) =>
          target.item.getId() === item.getId() ||
          target.item.isDescendentOf(item.getId()),
      ),
    onDrop: createOnDropHandler((item, children) => {
      setNodes?.((current) => {
        const node = current[item.getId()];
        return node
          ? { ...current, [node.id]: { ...node, children } }
          : current;
      });
    }),
    features: [
      syncDataLoaderFeature,
      selectionFeature,
      hotkeysCoreFeature,
      dragAndDropFeature,
    ],
  });

  useEffect(() => tree.rebuildTree(), [nodes, tree]);

  const entries = archiveTreeEntries(nodes);
  const selectedIds = tree.getState().selectedItems ?? [];
  const addFolder = () => {
    if (!setNodes || !folderName.trim()) return;
    const selected = selectedIds
      .map((id) => nodes[id])
      .find((node) => node?.kind === 'folder');
    setNodes((current) =>
      addArchiveFolder(current, selected?.id ?? ARCHIVE_TREE_ROOT, folderName),
    );
    setFolderName('');
  };

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex flex-wrap items-center gap-2">
          {editable && onFiles && (
            <>
              <FileDropzone
                multiple
                dropDirectories
                onFiles={onFiles}
                className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium"
              >
                <UploadCloud className="size-4" />
                {t('archive.addFiles')}
              </FileDropzone>
              <FileDropzone
                directory
                onFiles={onFiles}
                className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium"
              >
                <FolderInput className="size-4" />
                {t('archive.addDirectory')}
              </FileDropzone>
              <div className="flex min-w-56 flex-1 gap-2 sm:max-w-sm">
                <Input
                  value={folderName}
                  placeholder={t('archive.folderName')}
                  onChange={(event) => setFolderName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') addFolder();
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addFolder}
                  disabled={!folderName.trim()}
                >
                  <FolderPlus className="size-4" />
                  {t('archive.newFolder')}
                </Button>
              </div>
              <Button
                type="button"
                variant="ghost"
                disabled={selectedIds.length === 0}
                onClick={() => {
                  setNodes?.((current) =>
                    removeArchiveNodes(current, selectedIds),
                  );
                  tree.setSelectedItems([]);
                }}
              >
                <Trash2 className="size-4" />
                {t('archive.remove')}
              </Button>
            </>
          )}
          {onDownloadAll && entries.some((entry) => !entry.directory) && (
            <Button onClick={onDownloadAll} disabled={busy} className="ml-auto">
              {busy ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {t('archive.downloadAll')}
            </Button>
          )}
        </div>

        {entries.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            {t('archive.emptyTree')}
          </div>
        ) : (
          <div className="relative max-h-96 overflow-auto rounded-lg border p-2">
            <Tree tree={tree} label={t('archive.fileBrowser')}>
              {tree.getItems().map((item) => {
                const node = item.getItemData();
                return (
                  <TreeItem key={item.getId()} item={item}>
                    <TreeItemLabel item={item} className="min-w-0">
                      {node.kind === 'folder' ? (
                        <Folder className="size-4 fill-amber-400/30 text-amber-500" />
                      ) : (
                        <File className="size-4 text-muted-foreground" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-left">
                        {node.name}
                      </span>
                      {node.kind === 'file' && (
                        <span className="text-xs text-muted-foreground">
                          {formatBytes(node.size)}
                        </span>
                      )}
                    </TreeItemLabel>
                  </TreeItem>
                );
              })}
              {editable && <TreeDragLine />}
            </Tree>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
