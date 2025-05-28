"use client";
import React, { useState } from 'react';
import type { Block, BlockConfig } from './types';
import { BlockType } from './types';
import { BLOCK_CONFIGS } from './constants';
import { ChevronDown, ChevronRight, PlusCircle, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface BlockNodeProps {
  block: Block;
  onUpdate: (id: string, updatedBlock: Block) => void;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  level?: number;
  isDraggable?: boolean; // Placeholder for future drag and drop
}

const BlockNode: React.FC<BlockNodeProps> = ({
  block,
  onDelete,
  onAddChild,
  selectedId,
  onSelect,
  level = 0,
  isDraggable = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  
  const config: BlockConfig | undefined = BLOCK_CONFIGS[block.type];
  const hasChildren = block.children && block.children.length > 0;
  const isSelected = selectedId === block.id;

  if (!config) {
    return <div className="text-destructive p-2">Error: Unknown block type: {block.type}</div>;
  }

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
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
        return `(?(...)yes|no)`;
      default:
        return config.name;
    }
  };

  return (
    <Card 
      className={cn(
        "mb-2 transition-all shadow-sm hover:shadow-md",
        isSelected && "border-primary ring-2 ring-primary ring-offset-2",
      )}
      style={{ marginLeft: `${level * 24}px` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleSelect}
    >
      <CardContent className="p-2">
        <div className="flex items-center gap-2">
          {isDraggable && <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />}
          
          {(hasChildren || block.type === BlockType.GROUP || block.type === BlockType.LOOKAROUND || block.type === BlockType.ALTERNATION || block.type === BlockType.CONDITIONAL) && (
            <Button variant="ghost" size="icon" onClick={handleToggleExpand} className="h-7 w-7">
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </Button>
          )}
          
          <div className="flex items-center gap-2 flex-1">
            <span className="text-primary p-1 bg-primary/10 rounded-sm flex items-center justify-center h-7 w-7">
              {typeof config.icon === 'string' ? <span className="font-mono text-xs">{config.icon}</span> : config.icon}
            </span>
            <span className="font-medium text-sm">{config.name}</span>
            <span className="text-xs text-muted-foreground font-mono truncate">
              {renderBlockContentPreview()}
            </span>
          </div>

          <div className={cn("flex items-center gap-1 transition-opacity", isHovered || isSelected ? "opacity-100" : "opacity-0")}>
            {(block.type === BlockType.GROUP || block.type === BlockType.LOOKAROUND || block.type === BlockType.ALTERNATION || block.type === BlockType.CONDITIONAL) && (
                 <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onAddChild(block.id);}} title="Add Child Element" className="h-7 w-7">
                    <PlusCircle size={14} className="text-green-600"/>
                 </Button>
            )}
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onDelete(block.id); }} title="Delete" className="h-7 w-7">
              <Trash2 size={14} className="text-destructive"/>
            </Button>
          </div>
        </div>
        
        {isExpanded && hasChildren && (
          <div className="mt-2 pl-4 border-l-2 border-dashed ml-3">
            {block.children.map(child => (
              <BlockNode
                key={child.id}
                block={child}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onAddChild={onAddChild}
                selectedId={selectedId}
                onSelect={onSelect}
                level={0} // Children are visually indented by the parent's styling and this container
                isDraggable={isDraggable}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BlockNode;
