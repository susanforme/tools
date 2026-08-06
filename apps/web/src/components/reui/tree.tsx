import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import type { ItemInstance, TreeInstance } from '@headless-tree/core';
import { ChevronDown, Minus, Plus } from 'lucide-react';
import {
  createContext,
  useContext,
  type CSSProperties,
  type HTMLAttributes,
} from 'react';

import { cn } from '@/lib/utils';

type ToggleIconType = 'chevron' | 'plus-minus';

type TreeContextValue = {
  currentItem?: ItemInstance<unknown>;
  indent: number;
  toggleIconType: ToggleIconType;
  tree?: TreeInstance<unknown>;
};

const TreeContext = createContext<TreeContextValue>({
  indent: 20,
  toggleIconType: 'plus-minus',
});

type TreeProps<T> = HTMLAttributes<HTMLDivElement> & {
  indent?: number;
  label?: string;
  tree: TreeInstance<T>;
  toggleIconType?: ToggleIconType;
};

function Tree<T>({
  indent = 20,
  label,
  tree,
  className,
  toggleIconType = 'chevron',
  ...props
}: TreeProps<T>) {
  const { style: treeStyle, ...treeProps } = tree.getContainerProps(label);
  const style = {
    ...treeStyle,
    '--tree-indent': `${indent}px`,
  } as CSSProperties;

  return (
    <TreeContext.Provider
      value={{
        indent,
        toggleIconType,
        tree: tree as TreeInstance<unknown>,
      }}
    >
      <div
        data-slot="tree"
        className={cn('flex flex-col', className)}
        style={style}
        {...props}
        {...treeProps}
      />
    </TreeContext.Provider>
  );
}

type TreeItemProps<T> = Omit<useRender.ComponentProps<'button'>, 'indent'> & {
  item: ItemInstance<T>;
};

function TreeItem<T>({
  item,
  className,
  render,
  children,
  ...props
}: TreeItemProps<T>) {
  const context = useContext(TreeContext);
  const { style: itemStyle, ...itemProps } = item.getProps();
  const style = {
    ...itemStyle,
    '--tree-padding': `${item.getItemMeta().level * context.indent}px`,
  } as CSSProperties;
  const defaultProps = {
    'aria-expanded': item.isFolder() ? item.isExpanded() : undefined,
    'data-drag-target': item.isDragTarget() || undefined,
    'data-focus': item.isFocused() || undefined,
    'data-folder': item.isFolder() || undefined,
    'data-selected': item.isSelected() || undefined,
    'data-slot': 'tree-item',
    className: cn(
      'z-10 ps-(--tree-padding) outline-hidden select-none not-last:pb-0.5 focus:z-20',
      className,
    ),
    style,
  };

  return (
    <TreeContext.Provider
      value={{
        ...context,
        currentItem: item as ItemInstance<unknown>,
      }}
    >
      {useRender({
        defaultTagName: 'button',
        render,
        props: mergeProps<'button'>(defaultProps, {
          ...props,
          ...itemProps,
          children,
        }),
      })}
    </TreeContext.Provider>
  );
}

type TreeItemLabelProps<T> = HTMLAttributes<HTMLSpanElement> & {
  item?: ItemInstance<T>;
};

function TreeItemLabel<T>({
  item: suppliedItem,
  children,
  className,
  ...props
}: TreeItemLabelProps<T>) {
  const context = useContext(TreeContext);
  const item = suppliedItem ?? (context.currentItem as ItemInstance<T>);
  if (!item) return null;

  return (
    <span
      data-slot="tree-item-label"
      className={cn(
        'flex items-center gap-1 rounded-md bg-background px-2 py-1.5 text-sm transition-colors',
        'hover:bg-accent in-data-[selected=true]:bg-accent in-data-[selected=true]:text-accent-foreground',
        'in-data-[drag-target=true]:bg-accent not-in-data-[folder=true]:ps-7 [&_svg]:shrink-0',
        className,
      )}
      {...props}
    >
      {item.isFolder() &&
        (context.toggleIconType === 'plus-minus' ? (
          item.isExpanded() ? (
            <Minus className="size-3.5 text-muted-foreground" />
          ) : (
            <Plus className="size-3.5 text-muted-foreground" />
          )
        ) : (
          <ChevronDown className="size-4 text-muted-foreground in-aria-[expanded=false]:-rotate-90" />
        ))}
      {children ?? item.getItemName()}
    </span>
  );
}

function TreeDragLine({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const { tree } = useContext(TreeContext);
  if (!tree) return null;
  return (
    <div
      className={cn(
        'absolute z-30 -mt-px h-0.5 w-[unset] bg-primary before:absolute before:-top-[3px] before:left-0 before:size-2 before:rounded-full before:border-2 before:border-primary before:bg-background',
        className,
      )}
      style={tree.getDragLineStyle()}
      {...props}
    />
  );
}

export { Tree, TreeDragLine, TreeItem, TreeItemLabel };
