
"use client";
import React, { useState } from 'react';
import type { Block, BlockConfig, LiteralSettings, CharacterClassSettings, QuantifierSettings, GroupSettings, AnchorSettings, LookaroundSettings, BackreferenceSettings, ConditionalSettings } from './types';
import { BlockType } from './types';
import { BLOCK_CONFIGS } from './constants';
import { ChevronDown, ChevronRight, PlusCircle, Trash2, GripVertical, Copy, Ungroup, PackagePlus, Asterisk } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface BlockNodeProps {
  block: Block;
  quantifierToRender?: Block | null; 
  onUpdate: (id: string, updatedBlock: Block) => void;
  onDelete: (id: string, deleteAttachedQuantifier?: boolean) => void; 
  onAddChild: (parentId: string) => void;
  onDuplicate: (id: string) => void;
  onUngroup: (id: string) => void;
  onWrapBlock: (id: string) => void;
  onReorder: (draggedId: string, targetId: string, parentId: string | null) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  parentId: string | null;
  depth?: number;
  onBlockHover?: (blockId: string | null) => void;
  renderChildNodes: (nodes: Block[], parentId: string, depth: number) => React.ReactNode[];
}

const getDescriptiveBlockTitle = (block: Block, config: BlockConfig): { title: string, details: string } => {
  const settings = block.settings;
  let title = config.name;
  let details = "";

  switch (block.type) {
    case BlockType.LITERAL:
      const ls = settings as LiteralSettings;
      title = `Текст: "${ls.text || '...'}"`;
      if ((ls.text || '').length > 15) details = `"${ls.text.substring(0, 15)}..."`;
      else details = `"${ls.text || '...'}"`;
      break;
    case BlockType.CHARACTER_CLASS:
      const cs = settings as CharacterClassSettings;
      let patternDesc = cs.pattern || '...';
      if (cs.pattern === '\\d') patternDesc = 'любая цифра';
      else if (cs.pattern === '\\w') patternDesc = 'любая буква/цифра';
      else if (cs.pattern === '\\s') patternDesc = 'любой пробел';
      else if (cs.pattern === '.') patternDesc = 'любой символ';
      else if (cs.pattern?.length > 10) patternDesc = `[${cs.pattern.substring(0,10)}...]`;
      else patternDesc = `[${cs.pattern || '...'}]`;
      
      title = cs.negated ? `Символы: НЕ ${patternDesc}` : `Символы: ${patternDesc}`;
      details = `${cs.negated ? '[^' : '['}${cs.pattern || ''}${cs.negated ? ']' : ']'}`;
      break;
    case BlockType.QUANTIFIER:
      const qs = settings as QuantifierSettings;
      let quantType = qs.type;
      if (quantType === '{n}') quantType = `ровно ${qs.min} раз`;
      else if (quantType === '{n,}') quantType = `от ${qs.min} раз`;
      else if (quantType === '{n,m}') quantType = `от ${qs.min} до ${qs.max ?? '∞'} раз`;
      else if (quantType === '*') quantType = '0 или более раз';
      else if (quantType === '+') quantType = '1 или более раз';
      else if (quantType === '?') quantType = '0 или 1 раз';
      
      let modeDesc = '';
      if (qs.mode === 'lazy') modeDesc = ', лениво';
      else if (qs.mode === 'possessive') modeDesc = ', ревниво';
      
      title = `Повтор: ${quantType}${modeDesc}`;
      details = `${qs.type}${qs.mode === 'lazy' ? '?' : qs.mode === 'possessive' ? '+' : ''}`;
      if (qs.type?.includes('{')) {
        details = `{${qs.min ?? 0}${qs.type === '{n,m}' ? ',' + (qs.max ?? '') : qs.type === '{n,}' ? ',' : ''}}`;
        details += `${qs.mode === 'lazy' ? '?' : qs.mode === 'possessive' ? '+' : ''}`;
      }
      break;
    case BlockType.GROUP:
      const gs = settings as GroupSettings;
      let groupTypeDesc = 'Группа';
      if (gs.type === 'non-capturing') groupTypeDesc = 'Группа (без захвата)';
      else if (gs.type === 'named') groupTypeDesc = `Группа (захват как "${gs.name || '...'}_")`;
      else groupTypeDesc = 'Группа (захват)';
      title = groupTypeDesc;
      details = `(${gs.type === 'non-capturing' ? '?:' : ''}${gs.type === 'named' ? `?<${gs.name || ''}>` : ''}... )`;
      break;
    case BlockType.ANCHOR:
      const as = settings as AnchorSettings;
      let anchorDesc = '';
      if (as.type === '^') anchorDesc = 'Начало строки/текста';
      else if (as.type === '$') anchorDesc = 'Конец строки/текста';
      else if (as.type === '\\b') anchorDesc = 'Граница слова';
      else if (as.type === '\\B') anchorDesc = 'НЕ граница слова';
      title = `Условие: ${anchorDesc}`;
      details = as.type;
      break;
    case BlockType.LOOKAROUND:
      const los = settings as LookaroundSettings;
      let lookDesc = '';
      let lookSymbol = '';
      if (los.type === 'positive-lookahead') { lookDesc = 'Просмотр вперед (позитивный)'; lookSymbol = '(?=...)'; }
      else if (los.type === 'negative-lookahead') { lookDesc = 'Просмотр вперед (негативный)'; lookSymbol = '(?!...)'; }
      else if (los.type === 'positive-lookbehind') { lookDesc = 'Просмотр назад (позитивный)'; lookSymbol = '(?<=...)'; }
      else if (los.type === 'negative-lookbehind') { lookDesc = 'Просмотр назад (негативный)'; lookSymbol = '(?<!...)'; }
      title = lookDesc;
      details = lookSymbol;
      break;
    case BlockType.ALTERNATION:
      title = 'Чередование (ИЛИ)';
      details = '(...|...)';
      break;
    case BlockType.BACKREFERENCE:
      const brs = settings as BackreferenceSettings;
      title = `Ссылка: На группу №${brs.ref}`;
      details = `\\${brs.ref}`;
      break;
    case BlockType.CONDITIONAL:
      const conds = settings as ConditionalSettings;
      title = `Условие: Если "${conds.condition || '...'}"`;
      details = `(?(...)...|...)`;
      break;
    default:
      details = config.name; 
      break;
  }
  return { title, details: details || title };
};


const BlockNode: React.FC<BlockNodeProps> = ({
  block,
  quantifierToRender,
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
  depth = 0, 
  onBlockHover,
  renderChildNodes,
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

  const isSelected = selectedId === block.id || (quantifierToRender && selectedId === quantifierToRender.id);

  if (!config) {
    return <div className="text-destructive p-2">Ошибка: Неизвестный тип блока: {block.type}</div>;
  }
  
  const { title: descriptiveTitle, details: descriptiveDetails } = getDescriptiveBlockTitle(block, config);
  let quantifierTitle = "";
  let quantifierDetails = "";
  let quantifierIcon: React.ReactNode = <Asterisk size={14}/>; // Default icon for quantifier

  if (quantifierToRender) {
    const qConfig = BLOCK_CONFIGS[quantifierToRender.type];
    const qDesc = getDescriptiveBlockTitle(quantifierToRender, qConfig);
    quantifierTitle = qDesc.title;
    quantifierDetails = qDesc.details;
    quantifierIcon = qConfig.icon;
  }


  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canHaveChildren) {
      onUpdate(block.id, { ...block, isExpanded: !isCurrentlyExpanded });
    }
  };

  const handleSelectBlock = (e: React.MouseEvent, idToSelect: string) => {
    e.stopPropagation();
    onSelect(idToSelect);
  };
  
  const handleHoverBlock = (e: React.MouseEvent, idToHover: string | null) => {
     e.stopPropagation();
     if(onBlockHover) onBlockHover(idToHover);
  }


  const handleMouseEnter = () => {
    setIsInternallyHovered(true);
    if (onBlockHover) { 
      onBlockHover(block.id);
      if (quantifierToRender) { // Hover main block also hovers its attached quantifier for combined effect
        onBlockHover(quantifierToRender.id);
      }
    }
  };

  const handleMouseLeave = () => {
    setIsInternallyHovered(false);
    if (onBlockHover) { 
      onBlockHover(null);
    }
  };

  const canBeUngrouped = canHaveChildren && hasVisibleChildren;

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.stopPropagation();
    // For now, drag-and-drop of combined block+quantifier is complex.
    // We'll just drag the main block. The parent will need to handle moving the quantifier too.
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

  const cardMarginLeft = '0px'; // Wrapper div in RegexVisionWorkspace handles depth indentation

  return (
    <div
      draggable // Draggable is on the outer div that might contain block + quantifier
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "mb-0.5 transition-all relative group/blocknode", // Use group for opacity on hover for action buttons
        // Apply selection outline to the whole visual unit (block + its quantifier)
        isSelected && "outline-primary outline-2 outline-dashed outline-offset-2 rounded-md",
        isDraggingOver && !showAsParentDropTarget && "bg-accent/20 border-accent", // Visual feedback for dragging over
        showAsParentDropTarget && "bg-green-100 dark:bg-green-800/30 border-green-500 ring-1 ring-green-500", // For parent drop target
      )}
      style={{ marginLeft: cardMarginLeft }}
      onMouseEnter={handleMouseEnter} // Hovering the whole unit
      onMouseLeave={handleMouseLeave}
    >
      {/* Main Block Card */}
      <Card 
        className={cn("shadow-sm hover:shadow-md", selectedId === block.id && "border-primary ring-2 ring-primary bg-primary/5")}
        onClick={(e) => handleSelectBlock(e, block.id)}
        onMouseEnter={(e) => handleHoverBlock(e, block.id)} // Hover specific part
        onMouseLeave={(e) => handleHoverBlock(e, null)}  // Clear hover when leaving specific part
      >
        <CardContent className="p-2">
          <div className="flex items-center gap-2">
            <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab flex-shrink-0" />

            {canHaveChildren && (
              <Button variant="ghost" size="iconSm" onClick={handleToggleExpand} className="flex-shrink-0">
                {isCurrentlyExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </Button>
            )}
            {!canHaveChildren && <div className="w-7 h-7 flex-shrink-0" /> /* Placeholder for alignment */}


            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <span className={cn(
                  "text-primary p-1 bg-primary/10 rounded-sm flex items-center justify-center h-7 w-7 flex-shrink-0",
                  selectedId === block.id && "ring-1 ring-primary" // Highlight icon if main block selected
                )}>
                {typeof config.icon === 'string' ? <span className="font-mono text-xs">{config.icon}</span> : config.icon}
              </span>
              <span className={cn("font-medium text-sm whitespace-nowrap", selectedId === block.id && "text-primary font-semibold")}>{descriptiveTitle}</span>
              {descriptiveDetails && descriptiveTitle !== descriptiveDetails && (
                  <span className="text-xs text-muted-foreground font-mono truncate hidden md:inline">
                      {descriptiveDetails}
                  </span>
              )}
            </div>

            {/* Action buttons: only show on hover of the main card or if selected */}
            <div className={cn("flex items-center gap-0.5 transition-opacity flex-shrink-0", (isInternallyHovered && selectedId !== quantifierToRender?.id) || selectedId === block.id ? "opacity-100" : "opacity-0 focus-within:opacity-100 group-hover/blocknode:opacity-100")}>
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
              <Button variant="ghost" size="iconSm" onClick={(e) => { e.stopPropagation(); onDelete(block.id, true); }} title="Удалить">
                <Trash2 size={14} className="text-destructive"/>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Attached Quantifier Card */}
      {quantifierToRender && (
         <Card 
            className={cn(
                "ml-8 my-0.5 shadow-sm hover:shadow-md border-l-4 border-orange-400 dark:border-orange-600", // Style to indicate attachment
                selectedId === quantifierToRender.id && "border-primary ring-2 ring-primary bg-primary/5" // Highlight if quantifier selected
            )}
            onClick={(e) => handleSelectBlock(e, quantifierToRender.id)}
            onMouseEnter={(e) => handleHoverBlock(e, quantifierToRender.id)} // Hover specific part
            onMouseLeave={(e) => handleHoverBlock(e, null)}  // Clear hover
          >
            <CardContent className="p-1.5 pl-2"> {/* Reduced padding for compact look */}
                 <div className="flex items-center gap-2">
                    <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab flex-shrink-0 opacity-50" /> {/* Less prominent grip */}
                    <span className={cn("text-orange-600 p-0.5 bg-orange-500/10 rounded-sm flex items-center justify-center h-6 w-6 flex-shrink-0", selectedId === quantifierToRender.id && "ring-1 ring-orange-500")}>
                        {quantifierIcon}
                    </span>
                    <span className={cn("font-medium text-xs text-orange-700 dark:text-orange-400 whitespace-nowrap", selectedId === quantifierToRender.id && "font-semibold")}>
                        {quantifierTitle}
                    </span>
                    {quantifierDetails && quantifierTitle !== quantifierDetails && (
                        <span className="text-xs text-muted-foreground font-mono truncate hidden md:inline">
                            {quantifierDetails}
                        </span>
                    )}
                    <div className="flex-grow"></div> {/* Pushes delete button to the right */}
                    {/* Action buttons for quantifier: only show on hover of quantifier card or if selected */}
                    <div className={cn("flex items-center transition-opacity", (isInternallyHovered && selectedId === quantifierToRender.id) || selectedId === quantifierToRender.id ? "opacity-100" : "opacity-0 focus-within:opacity-100 group-hover/blocknode:opacity-100")}>
                        <Button variant="ghost" size="iconSm" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onDelete(quantifierToRender.id, false); }} title="Удалить квантификатор">
                            <Trash2 size={12} className="text-destructive/70 hover:text-destructive"/>
                        </Button>
                    </div>
                 </div>
            </CardContent>
         </Card>
      )}

      {/* Children Area */}
      {isCurrentlyExpanded && hasVisibleChildren && (
        <div className="mt-1 pt-1 pl-3 border-l-2 border-primary/60 bg-primary/10 rounded-r-md ml-14 mr-px pr-2"> {/* Adjusted ml */}
          {renderChildNodes(block.children, block.id, depth + 1)}
        </div>
      )}
    </div>
  );
};

export default BlockNode;

