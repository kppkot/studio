
"use client";
import React, { useState, useMemo } from 'react';
import type { Block, GroupInfo, QuantifierSettings, GroupSettings, CharacterClassSettings, AnchorSettings, LookaroundSettings, BackreferenceSettings, LiteralSettings } from './types';
import { BlockType } from './types';
import { ChevronDown, ChevronRight, GripVertical, Repeat, Trash2, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BLOCK_CONFIGS } from './constants';
import { reconstructPatternFromChildren } from './utils';

interface BlockNodeProps {
  block: Block;
  quantifierToRender?: Block | null; 
  onUpdate: (id: string, updatedBlock: Partial<Block>) => void;
  onDelete: (id: string, deleteAttachedQuantifier?: boolean) => void; 
  onAddChild: (parentId: string | null, contextId: string) => void;
  onAddSibling: (parentId: string | null, contextId: string) => void;
  onDuplicate: (id: string) => void;
  onUngroup: (id: string) => void;
  onWrapBlock: (id: string) => void;
  onReorder: (draggedId: string, targetId: string, parentId: string | null) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  parentId: string | null;
  depth?: number;
  hoveredId: string | null;
  onBlockHover: (blockId: string | null) => void;
  renderChildNodes: (nodes: Block[], parentId: string, depth: number, groupInfos: GroupInfo[]) => React.ReactNode[];
  groupInfos: GroupInfo[];
}

const BlockNode: React.FC<BlockNodeProps> = ({
  block,
  quantifierToRender,
  onUpdate,
  onDelete,
  onAddChild,
  onAddSibling,
  onDuplicate,
  onUngroup,
  onWrapBlock,
  onReorder,
  selectedId,
  onSelect,
  parentId,
  depth = 0, 
  hoveredId,
  onBlockHover,
  renderChildNodes,
  groupInfos,
}) => {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [showAsParentDropTarget, setShowAsParentDropTarget] = useState(false);

  const hasChildren = block.children && block.children.length > 0;

  const isContainerBlock = 
      block.type === BlockType.GROUP ||
      block.type === BlockType.LOOKAROUND ||
      block.type === BlockType.ALTERNATION ||
      block.type === BlockType.CONDITIONAL ||
      (block.type === BlockType.CHARACTER_CLASS && hasChildren);
      
  const isCurrentlyExpanded = block.isExpanded ?? (isContainerBlock ? true : false);
  const isEmptyContainer = isContainerBlock && !hasChildren;

  const isBlockSelected = selectedId === block.id;
  const isQuantifierSelected = quantifierToRender && selectedId === quantifierToRender.id;
  
  const isSelected = useMemo(() => isBlockSelected || isQuantifierSelected, [isBlockSelected, isQuantifierSelected]);

  const isBlockHovered = (hoveredId === block.id) && !isSelected;
  
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
    } else {
      setShowAsParentDropTarget(false);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsDraggingOver(false);
    setShowAsParentDropTarget(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    setShowAsParentDropTarget(false);
    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId && draggedId !== block.id) {
      onReorder(draggedId, block.id, showAsParentDropTarget ? block.id : parentId);
    }
  };
  
  const getBlockVisuals = () => {
    const config = BLOCK_CONFIGS[block.type];
    const settings = block.settings;
    let title = config.name;
    let details = '';
    let regexFragment = '';
    
    const escapeForDisplay = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    switch (block.type) {
      case BlockType.LITERAL:
        const litSettings = settings as LiteralSettings;
        title = 'Текст (литерал)';
        if (litSettings.isRawRegex) {
          details = 'Необработанный фрагмент Regex';
        } else {
          details = 'Точное совпадение';
        }
        regexFragment = litSettings.isRawRegex ? litSettings.text || '' : escapeForDisplay(litSettings.text || '');
        if (!regexFragment) {
            details = 'Пустой литерал. Введите текст.';
        }
        break;

      case BlockType.CHARACTER_CLASS:
        const ccSettings = settings as CharacterClassSettings;
        const pattern = block.children && block.children.length > 0 ? reconstructPatternFromChildren(block.children) : ccSettings.pattern;
        
        const shorthandInfo: { [key: string]: { title: string; details: string } } = {
          '\\d': { title: 'Любая цифра', details: 'Эквивалент [0-9]' },
          '\\D': { title: 'Не цифра', details: 'Эквивалент [^0-9]' },
          '\\w': { title: 'Символ слова', details: 'Буква, цифра или _' },
          '\\W': { title: 'Не символ слова', details: 'Кроме \\w' },
          '\\s': { title: 'Пробельный символ', details: 'Пробел, таб, новая строка...' },
          '\\S': { title: 'Не пробельный символ', details: 'Кроме \\s' },
          '.': { title: 'Любой символ', details: 'Кроме новой строки' },
          '\\p{L}': { title: 'Любая буква (Unicode)', details: 'Буквы всех языков (требует флаг \'u\')' },
        };

        if (shorthandInfo[pattern]) {
          title = shorthandInfo[pattern].title;
          details = shorthandInfo[pattern].details;
        } else {
          title = 'Набор символов';
          if (pattern) {
            details = ccSettings.negated ? 'Кроме указанных символов' : 'Любой из указанных символов';
          } else {
            details = 'Пустой или составной набор';
          }
        }
        
        const specialShorthands = ['\\d', '\\D', '\\w', '\\W', '\\s', '\\S', '.', '\\p{L}'];
        if (!ccSettings.negated && specialShorthands.includes(pattern)) {
          regexFragment = pattern;
        } else {
          regexFragment = `[${ccSettings.negated ? '^' : ''}${pattern}]`;
        }
        break;

      case BlockType.GROUP:
        const gSettings = settings as GroupSettings;
        const groupInfo = groupInfos.find(gi => gi.blockId === block.id);
        if (gSettings.type === 'capturing' && groupInfo) {
          title = `Группа (захват №${groupInfo.groupIndex})`;
          regexFragment = `(...)`;
        } else if (gSettings.type === 'non-capturing') {
          title = `Группа (незахватывающая)`;
          regexFragment = `(?:...)`;
        } else if (gSettings.type === 'named' && groupInfo) {
          title = `Группа (имя: ${gSettings.name || '...'})`;
          regexFragment = `(?<${gSettings.name || '...'}>...)`;
        }
        details = 'Контейнер для других блоков';
        break;

      case BlockType.ANCHOR:
        const aSettings = settings as AnchorSettings;
        title = 'Якорь (позиция)';
        const anchorMap: {[key: string]: string} = {
            '^': 'Начало строки/текста',
            '$': 'Конец строки/текста',
            '\\b': 'Граница слова',
            '\\B': 'Не граница слова',
        };
        details = anchorMap[aSettings.type] || 'Неизвестный якорь';
        regexFragment = aSettings.type;
        break;

      case BlockType.LOOKAROUND:
        const lSettings = settings as LookaroundSettings;
        const lookaroundMap: {[key: string]: string} = {
            'positive-lookahead': 'Просмотр вперед (+)',
            'negative-lookahead': 'Просмотр вперед (-)',
            'positive-lookbehind': 'Просмотр назад (+)',
            'negative-lookbehind': 'Просмотр назад (-)',
        };
        const lookaroundDetails: {[key: string]: string} = {
            'positive-lookahead': 'Условие: далее следует...',
            'negative-lookahead': 'Условие: далее НЕ следует...',
            'positive-lookbehind': 'Условие: этому предшествует...',
            'negative-lookbehind': 'Условие: этому НЕ предшествует...',
        };
        const lookaroundRegex: {[key: string]: string} = {
            'positive-lookahead': '(?=...)',
            'negative-lookahead': '(?!...)',
            'positive-lookbehind': '(?<=...)',
            'negative-lookbehind': '(?<!...)',
        };
        title = lookaroundMap[lSettings.type];
        details = lookaroundDetails[lSettings.type];
        regexFragment = lookaroundRegex[lSettings.type];
        break;
      
      case BlockType.BACKREFERENCE:
        const bSettings = settings as BackreferenceSettings;
        title = 'Обратная ссылка';
        details = `Совпадает с текстом группы №${bSettings.ref}`;
        regexFragment = `\\${bSettings.ref}`;
        break;
      
      case BlockType.ALTERNATION:
        title = 'Чередование (ИЛИ)';
        details = 'Совпадает с одним из вариантов';
        regexFragment = '...|...';
        break;

      case BlockType.CONDITIONAL:
        title = 'Условное выражение';
        details = 'Если (X) то (Y) иначе (Z)';
        regexFragment = '?(...)';
        break;

      default:
        title = config.name;
    }

    return { icon: config.icon, title, details, regexFragment };
  };

  const { icon, title, details, regexFragment } = getBlockVisuals();
  
  const renderQuantifierBadge = () => {
    if (!quantifierToRender) return null;

    const qSettings = quantifierToRender.settings as QuantifierSettings;
    let badgeDetails = '';
    switch (qSettings.type) {
      case '*': badgeDetails = '0+'; break;
      case '+': badgeDetails = '1+'; break;
      case '?': badgeDetails = '0-1'; break;
      case '{n}': badgeDetails = `{${qSettings.min ?? 0}}`; break;
      case '{n,}': badgeDetails = `min ${qSettings.min ?? 0}`; break;
      case '{n,m}': badgeDetails = `${qSettings.min ?? 0}-${qSettings.max ?? '∞'}`; break;
    }
    const modeMap: {[key in QuantifierSettings['mode']]: string} = {'greedy': 'Жадный', 'lazy': 'Ленивый', 'possessive': 'Ревнивый'};
    
    return (
      <div
        onClick={(e) => handleSelectBlock(e, quantifierToRender!.id)}
        onMouseEnter={() => onBlockHover(quantifierToRender!.id)}
        onMouseLeave={() => onBlockHover(null)}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 right-14 z-10 cursor-pointer",
          "bg-sky-100 text-sky-800 border-sky-300 border",
          "dark:bg-sky-900/50 dark:text-sky-300 dark:border-sky-700/50",
          "px-2 py-1 rounded-full text-xs font-semibold shadow-sm hover:shadow-md transition-all flex items-center gap-1.5",
          (hoveredId === quantifierToRender.id) && "ring-2 ring-accent bg-accent/20 brightness-110",
          (selectedId === quantifierToRender.id) && "ring-2 ring-primary bg-primary/20 brightness-110"
        )}
        title={`${modeMap[qSettings.mode]} квантификатор`}
      >
        <Repeat size={12} />
        <span>{badgeDetails}</span>
      </div>
    );
  };


  return (
    <div className="relative">
      <div
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onMouseEnter={() => onBlockHover(block.id)}
        onMouseLeave={() => onBlockHover(null)}
        className={cn(
          "transition-all relative group/blocknode rounded-md",
          isDraggingOver && !showAsParentDropTarget && "bg-accent/20",
          showAsParentDropTarget && "bg-green-100 dark:bg-green-800/30 ring-2 ring-green-500",
        )}
        onClick={(e) => handleSelectBlock(e, block.id)}
      >
        <div 
          className={cn(
            "block-main-content border rounded-md relative transition-all",
            "bg-card",
            isBlockHovered && "bg-accent/10 ring-1 ring-accent",
            isSelected && "ring-2 ring-primary shadow-lg bg-primary/10"
          )}
        >
          <div className="absolute top-1 right-1 flex items-center gap-0.5 z-20">
              <Button
                  variant="ghost"
                  size="iconSm"
                  onClick={(e) => {
                      e.stopPropagation();
                      onAddSibling(parentId, block.id);
                  }}
                  className="h-6 w-6 opacity-0 group-hover/blocknode:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                  title="Добавить блок"
              >
                  <PlusCircle size={14} />
              </Button>
              <Button
                  variant="ghost"
                  size="iconSm"
                  onClick={(e) => {
                      e.stopPropagation();
                      onDelete(block.id, true);
                  }}
                  className="h-6 w-6 opacity-0 group-hover/blocknode:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  title="Удалить блок"
              >
                  <Trash2 size={14} />
              </Button>
          </div>

          <div className="p-2 flex items-start gap-3">
            <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab flex-shrink-0 mt-1" />

            {isContainerBlock ? (
              <Button variant="ghost" size="iconSm" onClick={handleToggleExpand} className="flex-shrink-0 mt-0.5">
                {isCurrentlyExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </Button>
            ) : (
                <div className="w-7 h-7 flex-shrink-0" />
            )}
            
             <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-2">
                  <span className="text-primary h-5 w-5 flex items-center justify-center">{icon}</span>
                  <h3 className="font-semibold text-sm truncate">{title}</h3>
                </div>

                {(details || regexFragment) && (
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {details && <p className="text-xs text-muted-foreground">{details}</p>}
                        {regexFragment && (
                            <div className="px-1.5 py-0.5 bg-muted/70 rounded-md font-mono text-xs text-foreground/80">
                                {regexFragment}
                            </div>
                        )}
                    </div>
                )}
            </div>
          </div>
          {renderQuantifierBadge()}
        </div>
        
        {isContainerBlock && isCurrentlyExpanded && (
          <div className="children-container mt-1 pl-6 relative">
            <div className="absolute left-[18px] top-0 bottom-2 w-px bg-primary/20"></div>
             {isEmptyContainer ? (
               <div className="pt-2 pb-1">
                 <div 
                  className="ml-5 pl-4 pr-2 py-4 border-l-2 border-dashed border-muted-foreground/50 bg-muted/30 rounded-r-md text-center text-muted-foreground text-xs italic hover:border-primary hover:text-primary cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); onAddChild(block.id, block.id); }}
                >
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
