
"use client";
import React, { useState } from 'react';
import type { Block, GroupInfo, QuantifierSettings, GroupSettings, CharacterClassSettings, AnchorSettings, LookaroundSettings, BackreferenceSettings, LiteralSettings } from './types';
import { BlockType } from './types';
import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BLOCK_CONFIGS } from './constants';
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

  const isSelected = selectedId === block.id || (quantifierToRender && selectedId === quantifierToRender.id);
  
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
        details = `Точное совпадение с "${(litSettings.text || '').substring(0, 20)}"`;
        regexFragment = litSettings.isRawRegex ? litSettings.text : escapeForDisplay(litSettings.text || '');
        break;

      case BlockType.CHARACTER_CLASS:
        const ccSettings = settings as CharacterClassSettings;
        const pattern = block.children && block.children.length > 0 ? reconstructPatternFromChildren(block.children) : ccSettings.pattern;
        title = 'Символьный класс';
        
        const shorthands: {[key: string]: string} = {
            '\\d': 'Любая цифра (0-9)',
            '\\D': 'Любой символ, кроме цифры',
            '\\w': 'Буквенно-цифровой символ или _',
            '\\W': 'Любой символ, кроме буквенно-цифрового или _',
            '\\s': 'Любой пробельный символ',
            '\\S': 'Любой символ, кроме пробельного',
            '.': 'Любой символ (кроме новой строки)',
        };

        if (shorthands[pattern]) {
            details = shorthands[pattern];
        } else if (pattern) {
            details = `${ccSettings.negated ? 'Кроме' : 'Один из'}: ${pattern.substring(0, 30)}`;
        } else {
            details = 'Пустой или составной класс'
        }
        
        const specialShorthands = ['\\d', '\\D', '\\w', '\\W', '\\s', '\\S', '.'];
        if (!ccSettings.negated && specialShorthands.includes(pattern)) {
          regexFragment = pattern;
        } else {
          regexFragment = `[${ccSettings.negated ? '^' : ''}${pattern}]`;
        }
        break;

      case BlockType.QUANTIFIER:
        const qSettings = settings as QuantifierSettings;
        title = 'Квантификатор (повтор)';
        const modeMap = {'greedy': ' (жадный)', 'lazy': ' (ленивый)', 'possessive': ' (ревнивый)'};
        
        switch (qSettings.type) {
          case '*': details = '0 или более раз'; break;
          case '+': details = '1 или более раз'; break;
          case '?': details = '0 или 1 раз'; break;
          case '{n}': details = `Ровно ${qSettings.min ?? 0} раз`; break;
          case '{n,}': details = `От ${qSettings.min ?? 0} раз`; break;
          case '{n,m}': details = `От ${qSettings.min ?? 0} до ${qSettings.max ?? '∞'} раз`; break;
        }
        details += modeMap[qSettings.mode];

        let qStr = qSettings.type;
        if (qStr === '{n}') qStr = `{${qSettings.min ?? 0}}`;
        else if (qStr === '{n,}') qStr = `{${qSettings.min ?? 0},}`;
        else if (qStr === '{n,m}') qStr = `{${qSettings.min ?? 0},${qSettings.max ?? ''}}`;
        let modeSuffix = qSettings.mode === 'lazy' ? '?' : qSettings.mode === 'possessive' ? '+' : '';
        regexFragment = qStr + modeSuffix;
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
        onClick={(e) => handleSelectBlock(e, block.id)}
      >
        <div 
          className={cn(
            "block-main-content border rounded-md relative transition-all",
            "bg-card",
            isSelected && "ring-2 ring-primary shadow-lg"
          )}
        >
            <div className="p-2 flex items-start gap-3">
              <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab flex-shrink-0 mt-1" />

              {isContainerBlock ? (
                <Button variant="ghost" size="iconSm" onClick={handleToggleExpand} className="flex-shrink-0 mt-0.5">
                  {isCurrentlyExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </Button>
              ) : (
                  <div className="w-7 h-7 flex-shrink-0" />
              )}
              
               <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-primary h-5 w-5 flex items-center justify-center">{icon}</span>
                    <h3 className="font-semibold text-sm truncate">{title}</h3>
                  </div>
                  {details && <p className="text-xs text-muted-foreground mt-0.5">{details}</p>}
                  {regexFragment && (
                    <div className="mt-1.5 px-2 py-1 bg-muted/70 rounded-md font-mono text-xs text-foreground/80 break-all">
                      {regexFragment}
                    </div>
                  )}
              </div>
            </div>
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
