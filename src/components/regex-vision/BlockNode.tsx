
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
  onWrapBlock: (id: string) => void; // New prop for wrapping
  onReorder: (draggedId: string, targetId: string, parentId: string | null) => void; // New prop for reordering
  selectedId: string | null;
  onSelect: (id: string) => void;
  parentId: string | null; // Pass parentId for reordering context
  level?: number;
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
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  
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

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', block.id);
    e.dataTransfer.effectAllowed = 'move';
    // Optionally set a class for dragging state
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // Necessary to allow dropping
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId && draggedId !== block.id) {
      onReorder(draggedId, block.id, parentId);
    }
  };

  return (
    <Card 
      draggable // Make the card draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "mb-2 transition-all shadow-sm hover:shadow-md relative", // Added relative for potential D&D indicators
        isSelected && "border-primary ring-2 ring-primary ring-offset-2 bg-primary/5", // Enhanced selected state
        isDraggingOver && "bg-accent/20 border-accent", // Visual feedback for drag over
      )}
      style={{ marginLeft: `${level * 24}px` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleSelect}
    >
      <CardContent className="p-2">
        <div className="flex items-center gap-2">
          <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
          
          {canHaveChildren && ( 
            <Button variant="ghost" size="icon" onClick={handleToggleExpand} className="h-7 w-7">
              {isCurrentlyExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </Button>
          )}
          
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-primary p-1 bg-primary/10 rounded-sm flex items-center justify-center h-7 w-7 flex-shrink-0">
              {typeof config.icon === 'string' ? <span className="font-mono text-xs">{config.icon}</span> : config.icon}
            </span>
            <span className="font-medium text-sm whitespace-nowrap">{config.name}</span>
            <span className="text-xs text-muted-foreground font-mono truncate">
              {renderBlockContentPreview()}
            </span>
          </div>

          <div className={cn("flex items-center gap-1 transition-opacity", isHovered || isSelected ? "opacity-100" : "opacity-0")}>
            {canHaveChildren && (
                 <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onAddChild(block.id);}} title="Добавить дочерний элемент" className="h-7 w-7">
                    <PlusCircle size={14} className="text-green-600"/>
                 </Button>
            )}
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onWrapBlock(block.id); }} title="Обернуть в группу" className="h-7 w-7">
              <PackagePlus size={14} className="text-indigo-600"/>
            </Button>
            {canBeUngrouped && (
              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onUngroup(block.id);}} title="Разгруппировать" className="h-7 w-7">
                <Ungroup size={14} className="text-purple-600"/>
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onDuplicate(block.id); }} title="Копировать" className="h-7 w-7">
              <Copy size={14} className="text-blue-600"/>
            </Button>
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onDelete(block.id); }} title="Удалить" className="h-7 w-7">
              <Trash2 size={14} className="text-destructive"/>
            </Button>
          </div>
        </div>
        
        {isCurrentlyExpanded && hasVisibleChildren && (
          <div className="mt-2 pl-4 border-l-2 border-dashed ml-[14px]">
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
                parentId={block.id} // Pass current block's ID as parentId for children
                level={0} 
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BlockNode;

