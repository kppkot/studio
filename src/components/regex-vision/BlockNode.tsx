
"use client";
import React, { useState } from 'react';
import type { Block, BlockConfig } from './types';
import { BlockType } from './types';
import { BLOCK_CONFIGS } from './constants';
import { ChevronDown, ChevronRight, PlusCircle, Trash2, GripVertical, Copy, Ungroup, PackagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface BlockNodeProps {
  block: Block;
  onUpdate: (id: string, updatedBlock: Block) => void;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onDuplicate: (id: string) => void;
  onUngroup: (id: string) => void;
  onWrapBlock: (id: string) => void;
  onReorder: (draggedId: string, targetId: string, parentId: string | null) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  parentId: string | null;
  level?: number;
  onBlockHover?: (blockId: string | null) => void;
}

const BlockNode: React.FC<BlockNodeProps> = ({
  block,
  onUpdate,
  onDelete,
  onAddChild,
  onDuplicate,
  onUngroup,
  onWrapBlock,
  onReorder,
  selectedId,
  onSelect,
  parentId,
  level = 0,
  onBlockHover,
}) => {
  const [isInternallyHovered, setIsInternallyHovered] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [showAsParentDropTarget, setShowAsParentDropTarget] = useState(false);

  const config: BlockConfig | undefined = BLOCK_CONFIGS[block.type];

  const canHaveChildren = block.type === BlockType.GROUP ||
                          block.type === BlockType.LOOKAROUND ||
                          block.type === BlockType.ALTERNATION ||
                          block.type === BlockType.CONDITIONAL;

  const hasVisibleChildren = block.children && block.children.length > 0;
  const isCurrentlyExpanded = block.isExpanded ?? (canHaveChildren ? true : false);

  const isSelected = selectedId === block.id;

  if (!config) {
    return <div className="text-destructive p-2">Ошибка: Неизвестный тип блока: {block.type}</div>;
  }

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canHaveChildren) {
      onUpdate(block.id, { ...block, isExpanded: !isCurrentlyExpanded });
    }
  };

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(block.id);
  };

  const handleMouseEnter = () => {
    setIsInternallyHovered(true);
    if (onBlockHover) { // Hover for any block type, not just group
      onBlockHover(block.id);
    }
  };

  const handleMouseLeave = () => {
    setIsInternallyHovered(false);
    if (onBlockHover) { // Hover for any block type
      onBlockHover(null);
    }
  };


  const renderBlockContentPreview = (): string => {
    switch (block.type) {
      case BlockType.LITERAL:
        return `"${(block.settings as any).text || '...'}"`;
      case BlockType.CHARACTER_CLASS:
        return `[${(block.settings as any).negated ? '^' : ''}${(block.settings as any).pattern || '...'}]`;
      case BlockType.QUANTIFIER:
        const qMode = (block.settings as any).mode;
        let qSymbol = '';
        if (qMode === 'lazy') qSymbol = '?';
        if (qMode === 'possessive') qSymbol = '+';
        return `${(block.settings as any).type || '*'}${qSymbol}`;
      case BlockType.GROUP:
        return `(${(block.settings as any).type === 'non-capturing' ? '?:' : ''}${(block.settings as any).name ? `?<${(block.settings as any).name}>` : ''}...)`;
      case BlockType.ANCHOR:
        return (block.settings as any).type;
      case BlockType.LOOKAROUND:
        const lookaroundMap: Record<string, string> = {
          'positive-lookahead': '(?=...)',
          'negative-lookahead': '(?!...)',
          'positive-lookbehind': '(?<=...)',
          'negative-lookbehind': '(?<!...)',
        };
        return lookaroundMap[(block.settings as any).type] || '(...)';
      case BlockType.BACKREFERENCE:
        return `\\${(block.settings as any).ref || '1'}`;
      case BlockType.CONDITIONAL:
        return `(?(...)да|нет)`;
      case BlockType.ALTERNATION:
        return `(...|...)`;
      default:
        return config.name;
    }
  };

  const canBeUngrouped = canHaveChildren && hasVisibleChildren;

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', block.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setIsDraggingOver(true);

    const canThisBlockAcceptChildren = [BlockType.GROUP, BlockType.LOOKAROUND, BlockType.ALTERNATION, BlockType.CONDITIONAL].includes(block.type);
    const draggedId = e.dataTransfer.types.includes('text/plain') ? e.dataTransfer.getData('text/plain') : null;

    if (draggedId && draggedId !== block.id && canThisBlockAcceptChildren) {
      setShowAsParentDropTarget(true);
      document.body.setAttribute('data-drag-target-role', 'parent');
    } else {
      setShowAsParentDropTarget(false);
      document.body.setAttribute('data-drag-target-role', 'sibling');
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsDraggingOver(false);
    setShowAsParentDropTarget(false);
    document.body.removeAttribute('data-drag-target-role');
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    setShowAsParentDropTarget(false);
    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId && draggedId !== block.id) {
      const dropTargetRole = document.body.getAttribute('data-drag-target-role');
      const targetParentForReorder = dropTargetRole === 'parent' ? block.id : parentId;
      onReorder(draggedId, block.id, targetParentForReorder);
    }
    document.body.removeAttribute('data-drag-target-role');
  };

  const selectedHighlightClass = "ring-2 ring-primary ring-offset-1 dark:ring-offset-background rounded-sm";
  const hoverHighlightClass = "bg-accent/70 text-accent-foreground rounded-sm";


  return (
    <Card
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "mb-2 transition-all shadow-sm hover:shadow-md relative",
        isSelected && "border-primary ring-2 ring-primary ring-offset-2 bg-primary/5",
        isDraggingOver && !showAsParentDropTarget && "bg-accent/20 border-accent",
        showAsParentDropTarget && "bg-green-100 dark:bg-green-800/30 border-green-500 ring-1 ring-green-500",
      )}
      style={{ marginLeft: `${level * 20}px` }} // Reduced margin for deeper nesting
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleSelect}
    >
      <CardContent className="p-2">
        <div className="flex items-center gap-2">
          <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab flex-shrink-0" />

          {canHaveChildren && (
            <Button variant="ghost" size="icon" onClick={handleToggleExpand} className="h-7 w-7 flex-shrink-0">
              {isCurrentlyExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </Button>
          )}
          {!canHaveChildren && <div className="w-7 h-7 flex-shrink-0" /> /* Placeholder for alignment */}


          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className={cn(
                "text-primary p-1 bg-primary/10 rounded-sm flex items-center justify-center h-7 w-7 flex-shrink-0",
                isSelected && "ring-1 ring-primary"
              )}>
              {typeof config.icon === 'string' ? <span className="font-mono text-xs">{config.icon}</span> : config.icon}
            </span>
            <span className={cn("font-medium text-sm whitespace-nowrap", isSelected && "text-primary font-semibold")}>{config.name}</span>
            <span className="text-xs text-muted-foreground font-mono truncate">
              {renderBlockContentPreview()}
            </span>
          </div>

          <div className={cn("flex items-center gap-0.5 transition-opacity flex-shrink-0", isInternallyHovered || isSelected ? "opacity-100" : "opacity-0 focus-within:opacity-100")}>
            {canHaveChildren && (
                 <Button variant="ghost" size="iconSm" onClick={(e) => { e.stopPropagation(); onAddChild(block.id);}} title="Добавить дочерний элемент">
                    <PlusCircle size={14} className="text-green-600"/>
                 </Button>
            )}
            <Button variant="ghost" size="iconSm" onClick={(e) => { e.stopPropagation(); onWrapBlock(block.id); }} title="Обернуть в группу">
              <PackagePlus size={14} className="text-indigo-600"/>
            </Button>
            {canBeUngrouped && (
              <Button variant="ghost" size="iconSm" onClick={(e) => { e.stopPropagation(); onUngroup(block.id);}} title="Разгруппировать">
                <Ungroup size={14} className="text-purple-600"/>
              </Button>
            )}
            <Button variant="ghost" size="iconSm" onClick={(e) => { e.stopPropagation(); onDuplicate(block.id); }} title="Копировать">
              <Copy size={14} className="text-blue-600"/>
            </Button>
            <Button variant="ghost" size="iconSm" onClick={(e) => { e.stopPropagation(); onDelete(block.id); }} title="Удалить">
              <Trash2 size={14} className="text-destructive"/>
            </Button>
          </div>
        </div>

        {isCurrentlyExpanded && hasVisibleChildren && (
          <div className="mt-2 pt-2 pl-3 border-l-2 border-primary/30 bg-primary/5 rounded-r-md ml-[calc(1.25rem+8px)] mr-px">
             {/* ml is 20px (grip) + 8px (gap after grip) approx. */}
            {block.children.map(child => (
              <BlockNode
                key={child.id}
                block={child}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onAddChild={onAddChild}
                onDuplicate={onDuplicate}
                onUngroup={onUngroup}
                onWrapBlock={onWrapBlock}
                onReorder={onReorder}
                selectedId={selectedId}
                onSelect={onSelect}
                parentId={block.id}
                level={0} // Children are inside a new styled container, so their relative level is 0
                onBlockHover={onBlockHover}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BlockNode;


    