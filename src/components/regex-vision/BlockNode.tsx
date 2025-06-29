
"use client";
import React, { useState } from 'react';
import type { Block, BlockConfig, LiteralSettings, CharacterClassSettings, QuantifierSettings, GroupSettings, AnchorSettings, LookaroundSettings, BackreferenceSettings, ConditionalSettings, GroupInfo } from './types';
import { BlockType } from './types';
import { BLOCK_CONFIGS } from './constants';
import { ChevronDown, ChevronRight, PlusCircle, Trash2, GripVertical, Copy, Ungroup, PackagePlus, Asterisk, Combine, GitFork, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { reconstructPatternFromChildren } from './utils';


interface BlockNodeProps {
  block: Block;
  quantifierToRender?: Block | null; 
  onUpdate: (id: string, updatedBlock: Partial<Block>) => void;
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
  renderChildNodes: (nodes: Block[], parentId: string, depth: number, groupInfos: GroupInfo[]) => React.ReactNode[];
  groupInfos: GroupInfo[];
}

const getDescriptiveBlockTitle = (block: Block, config: BlockConfig, groupInfo?: GroupInfo): { title: string, details: string } => {
  const settings = block.settings;
  const hasChildren = block.children && block.children.length > 0;
  let title = config.name;
  let details = "";

  switch (block.type) {
    case BlockType.LITERAL:
      const ls = settings as LiteralSettings;
      title = `Текст: "${ls.text || '...'}"`;
      if (ls.isRawRegex) {
        details = ls.text;
      } else {
        details = (ls.text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }
      break;
    case BlockType.CHARACTER_CLASS:
      const cs = settings as CharacterClassSettings;
      if (hasChildren) {
          const childPattern = reconstructPatternFromChildren(block.children);
          title = cs.negated ? `Символьный класс (НЕ набор)` : `Символьный класс (набор)`;
          details = `${cs.negated ? '[^' : '['}${childPattern}${cs.negated ? ']' : ']'}`;
          break;
      }

      let patternDesc = cs.pattern || '...';
      const specialShorthands = ['\\d', '\\D', '\\w', '\\W', '\\s', '\\S', '.'];
      if (specialShorthands.includes(cs.pattern)) {
          if (cs.pattern === '\\d') patternDesc = 'любая цифра';
          else if (cs.pattern === '\\D') patternDesc = 'НЕ цифра';
          else if (cs.pattern === '\\w') patternDesc = 'любая буква/цифра';
          else if (cs.pattern === '\\W') patternDesc = 'НЕ буква/цифра';
          else if (cs.pattern === '\\s') patternDesc = 'любой пробел';
          else if (cs.pattern === '\\S') patternDesc = 'НЕ пробел';
          else if (cs.pattern === '.') patternDesc = 'любой символ';
          title = `Символы: ${patternDesc}`;
          details = cs.pattern;
      } else {
        patternDesc = cs.pattern?.length > 10 ? `[${cs.pattern.substring(0,10)}...]` : `[${cs.pattern || '...'}]`;
        title = cs.negated ? `Символы: НЕ из набора` : `Символы: из набора`;
        details = `[${cs.negated ? '^' : ''}${cs.pattern || ''}]`;
      }
      break;
    case BlockType.QUANTIFIER:
      const qs = settings as QuantifierSettings;
      let quantType = qs.type;
      if (quantType === '{n}') quantType = `ровно ${qs.min} р.`;
      else if (quantType === '{n,}') quantType = `от ${qs.min} р.`;
      else if (quantType === '{n,m}') quantType = `от ${qs.min ?? ''} до ${qs.max ?? ''} р.`;
      else if (quantType === '*') quantType = '0+ раз';
      else if (quantType === '+') quantType = '1+ раз';
      else if (quantType === '?') quantType = '0 или 1 раз';
      
      let modeDesc = '';
      if (qs.mode === 'lazy') modeDesc = ', лениво';
      else if (qs.mode === 'possessive') modeDesc = ', ревниво';
      
      title = `${quantType}${modeDesc}`;
      details = `${qs.type}${qs.mode === 'lazy' ? '?' : qs.mode === 'possessive' ? '+' : ''}`;
      if (qs.type?.includes('{')) {
        details = `{${qs.min ?? 0}${qs.type === '{n,m}' ? ',' + (qs.max ?? '') : qs.type === '{n,}' ? ',' : ''}}`;
        details += `${qs.mode === 'lazy' ? '?' : qs.mode === 'possessive' ? '+' : ''}`;
      }
      break;
    case BlockType.GROUP:
        const gs = settings as GroupSettings;
        if (!hasChildren) {
            if (gs.type === 'capturing' && groupInfo) title = `Пустая группа (захват №${groupInfo.groupIndex})`;
            else if (gs.type === 'named' && gs.name) title = `Пустая группа ("${gs.name}")`;
            else if (gs.type === 'non-capturing') title = `Пустой контейнер`;
            else title = 'Пустая группа';
            details = '(добавьте элементы)';
            break;
        }
        if (gs.type === 'non-capturing') {
            title = 'Группа (для порядка)';
        } else if (gs.type === 'named' && gs.name) {
            title = `Группа ("${gs.name}")`;
        } else if (gs.type === 'capturing' && groupInfo) {
            title = `Группа (захват №${groupInfo.groupIndex})`;
        } else {
            if (gs.type === 'named') title = 'Группа (именованный захват)';
            else if (gs.type === 'capturing') title = 'Группа (захват)';
            else title = 'Группа';
        }
        details = `(${gs.type === 'non-capturing' ? '?:' : ''}${gs.type === 'named' ? `?<${gs.name || ''}>` : ''}... )`;
        break;
    case BlockType.ALTERNATION:
        if (!hasChildren) {
            title = "Выбор 'ИЛИ' (пустой)";
            details = '(добавьте альтернативы)';
            break;
        }
        title = 'Чередование (ИЛИ)';
        details = '(...|...)';
        break;
    case BlockType.LOOKAROUND:
      const los = settings as LookaroundSettings;
      let lookDesc = '';
      let lookSymbol = '';
      if (los.type === 'positive-lookahead') { lookDesc = 'Просмотр вперед (+)'; lookSymbol = '(?=...)'; }
      else if (los.type === 'negative-lookahead') { lookDesc = 'Просмотр вперед (-)'; lookSymbol = '(?!...)'; }
      else if (los.type === 'positive-lookbehind') { lookDesc = 'Просмотр назад (+)'; lookSymbol = '(?<=...)'; }
      else if (los.type === 'negative-lookbehind') { lookDesc = 'Просмотр назад (-)'; lookSymbol = '(?<!...)'; }
      
      if (!hasChildren) {
          title = `Пустой ${lookDesc}`;
          details = '(добавьте элементы)';
          break;
      }
      title = lookDesc;
      details = lookSymbol;
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
  groupInfos,
}) => {
  const [isInternallyHovered, setIsInternallyHovered] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [showAsParentDropTarget, setShowAsParentDropTarget] = useState(false);

  const config: BlockConfig | undefined = BLOCK_CONFIGS[block.type];

  const hasChildren = block.children && block.children.length > 0;

  const isContainerBlock = 
      block.type === BlockType.GROUP ||
      block.type === BlockType.LOOKAROUND ||
      block.type === BlockType.ALTERNATION ||
      block.type === BlockType.CONDITIONAL ||
      (block.type === BlockType.CHARACTER_CLASS && hasChildren);
      
  const canAddNewChildren = 
      block.type === BlockType.GROUP ||
      block.type === BlockType.LOOKAROUND ||
      block.type === BlockType.ALTERNATION ||
      block.type === BlockType.CONDITIONAL;

  const isCurrentlyExpanded = block.isExpanded ?? (isContainerBlock ? true : false);
  const isEmptyContainer = isContainerBlock && !hasChildren;

  const isSelected = selectedId === block.id || (quantifierToRender && selectedId === quantifierToRender.id);

  if (!config) {
    return <div className="text-destructive p-2">Ошибка: Неизвестный тип блока: {block.type}</div>;
  }
  
  const groupInfo = block.type === BlockType.GROUP ? groupInfos.find(gi => gi.blockId === block.id) : undefined;
  const { title: descriptiveTitle, details: descriptiveDetails } = getDescriptiveBlockTitle(block, config, groupInfo);

  let quantifierTitle = "";
  if (quantifierToRender) {
    const qConfig = BLOCK_CONFIGS[quantifierToRender.type];
    const qDesc = getDescriptiveBlockTitle(quantifierToRender, qConfig);
    quantifierTitle = qDesc.title;
  }


  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isContainerBlock) {
      onUpdate(block.id, { isExpanded: !isCurrentlyExpanded });
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
      if (quantifierToRender) {
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

  const canBeUngrouped = isContainerBlock && hasChildren && block.type !== BlockType.CHARACTER_CLASS && block.type !== BlockType.ALTERNATION;

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
      onReorder(draggedId, block.id, dropTargetRole === 'parent' ? block.id : parentId);
    }
    document.body.removeAttribute('data-drag-target-role');
  };
  
  return (
    <div className="relative">
      <div
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "transition-all relative group/blocknode rounded-md",
          isDraggingOver && !showAsParentDropTarget && "bg-accent/20",
          showAsParentDropTarget && "bg-green-100 dark:bg-green-800/30 ring-2 ring-green-500",
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={(e) => handleSelectBlock(e, block.id)}
      >
        <div 
          className={cn(
            "block-main-content border rounded-md relative transition-all",
            "bg-green-200 border-green-500", // Force green for test
            "hover:border-green-600 hover:shadow-md",
            isSelected && "ring-2 ring-green-700 shadow-lg"
          )}
          onMouseEnter={(e) => handleHoverBlock(e, block.id)}
          onMouseLeave={(e) => handleHoverBlock(e, null)}
        >
            <div className="p-2 flex items-center gap-2">
              <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab flex-shrink-0" />

              {isContainerBlock ? (
                <Button variant="ghost" size="iconSm" onClick={handleToggleExpand} className="flex-shrink-0">
                  {isCurrentlyExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </Button>
              ) : (
                  <div className="w-7 h-7 flex-shrink-0" />
              )}

              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className={cn(
                    "text-primary p-1 bg-primary/10 rounded-sm flex items-center justify-center h-7 w-7 flex-shrink-0",
                    selectedId === block.id && "ring-1 ring-primary",
                    isEmptyContainer && "opacity-50",
                    block.type === BlockType.ALTERNATION && "text-purple-600 bg-purple-500/10"
                  )}>
                  {block.type === BlockType.CHARACTER_CLASS && hasChildren ? <Combine size={18} /> : 
                   block.type === BlockType.ALTERNATION ? <GitFork size={18} className="transform -rotate-90" /> :
                   (typeof config.icon === 'string' ? <span className="font-mono text-xs">{config.icon}</span> : config.icon)}
                </span>
                <div className="flex flex-col min-w-0">
                  <span className={cn(
                      "font-medium text-sm whitespace-nowrap", 
                      selectedId === block.id && "text-primary font-semibold",
                      isEmptyContainer && "text-muted-foreground italic"
                  )}>
                      {descriptiveTitle}
                  </span>
                  {descriptiveDetails && (
                      <span className="text-xs text-muted-foreground font-mono truncate hidden md:inline-block">
                          {descriptiveDetails}
                      </span>
                  )}
                </div>
              </div>

              <div className={cn("flex items-center gap-0.5 transition-opacity flex-shrink-0", (isInternallyHovered && selectedId !== quantifierToRender?.id) || selectedId === block.id ? "opacity-100" : "opacity-0 focus-within:opacity-100 group-hover/blocknode:opacity-100")}>
                {canAddNewChildren && (
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
          
          {quantifierToRender && (
             <div 
                className={cn(
                  "quantifier-badge absolute -bottom-2 -right-2 flex items-center gap-1 border border-orange-500/50 text-orange-700 dark:text-orange-400 text-xs font-medium px-2 py-0.5 rounded-full shadow-sm cursor-pointer",
                   "bg-green-200", // Force green for test
                   selectedId === quantifierToRender.id ? "ring-2 ring-orange-500" : ""
                )}
                onClick={(e) => handleSelectBlock(e, quantifierToRender.id)}
                onMouseEnter={(e) => handleHoverBlock(e, quantifierToRender.id)}
                onMouseLeave={(e) => handleHoverBlock(e, null)}
              >
               <Asterisk size={12}/> {quantifierTitle}
                <button 
                  onClick={(e) => { e.stopPropagation(); onDelete(quantifierToRender.id, false); }} 
                  className="ml-1 opacity-50 hover:opacity-100 text-destructive/70 hover:text-destructive"
                  title="Удалить квантификатор"
                >
                  <X size={12}/>
                </button>
            </div>
          )}
        </div>
        
        {isContainerBlock && isCurrentlyExpanded && (
          <div className="children-container mt-1 pl-6 relative">
            <div className="absolute left-[18px] top-0 bottom-2 w-px bg-primary/20"></div>
             {isEmptyContainer ? (
               <div className="pt-2 pb-1">
                 <div className="ml-5 pl-4 pr-2 py-4 border-l-2 border-dashed border-muted-foreground/50 bg-muted/30 rounded-r-md text-center text-muted-foreground text-xs italic">
                  <p>{block.type === BlockType.ALTERNATION ? 'Добавьте дочерний блок как первую альтернативу' : 'Добавьте или перетащите дочерние блоки сюда'}</p>
                 </div>
               </div>
            ) : block.type === BlockType.ALTERNATION ? (
                 <div className="space-y-1 pt-1">
                    {(block.children || []).map((altChild, index, arr) => (
                      <React.Fragment key={altChild.id}>
                        {renderChildNodes([altChild], block.id, depth + 1, groupInfos)}
                        {index < arr.length - 1 && (
                          <div className="alternation-separator my-2 flex items-center justify-center ml-5" aria-hidden="true">
                            <hr className="flex-grow border-t-0 border-b border-dashed border-purple-500/40" />
                            <span className="mx-2 px-1.5 py-0.5 text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-500/10 border border-purple-500/20 rounded-full">
                              ИЛИ
                            </span>
                            <hr className="flex-grow border-t-0 border-b border-dashed border-purple-500/40" />
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                </div>
            ) : (
                <div className="space-y-1 pt-1">
                  {renderChildNodes(block.children, block.id, depth + 1, groupInfos)}
                </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BlockNode;
