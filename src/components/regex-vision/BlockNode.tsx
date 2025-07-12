
"use client";
import React, { useMemo } from 'react';
import type { Block, GroupInfo, QuantifierSettings, GroupSettings, CharacterClassSettings, AnchorSettings, LookaroundSettings, BackreferenceSettings, LiteralSettings, DropIndicator } from './types';
import { BlockType } from './types';
import { ChevronDown, ChevronRight, GripVertical, Repeat, Trash2, PlusCircle, Ungroup, WrapText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BLOCK_CONFIGS } from './constants';

interface BlockNodeProps {
  block: Block;
  quantifierToRender?: Block | null;
  onUpdate: (id: string, updatedBlock: Partial<Block>) => void;
  onDelete: (id: string, deleteAttachedQuantifier?: boolean) => void;
  onAddChild: (parentId: string, contextId: string) => void;
  onAddSibling: (parentId: string | null, contextId:string) => void;
  onDuplicate: (id: string) => void;
  onUngroup: (id: string) => void;
  onWrapBlock: (id: string) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  parentId: string | null;
  depth?: number;
  hoveredId: string | null;
  onBlockHover: (blockId: string | null) => void;
  renderChildNodes: (nodes: Block[], parentId: string, depth: number, groupInfos: GroupInfo[]) => React.ReactNode[];
  groupInfos: GroupInfo[];
  
  // Drag and Drop props
  onDragStart: (e: React.DragEvent, blockId: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, targetBlockId: string) => void;
  onDragOver: (e: React.DragEvent, targetBlockId: string) => void;
  onDragLeave: (e: React.DragEvent) => void;
  dropIndicator: DropIndicator | null;
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
  selectedId,
  onSelect,
  parentId,
  depth = 0,
  hoveredId,
  onBlockHover,
  renderChildNodes,
  groupInfos,
  onDragStart,
  onDragEnd,
  onDrop,
  onDragOver,
  onDragLeave,
  dropIndicator,
}) => {

  const hasChildren = block.children && block.children.length > 0;

  const isContainerBlock =
      block.type === BlockType.GROUP ||
      block.type === BlockType.LOOKAROUND ||
      block.type === BlockType.ALTERNATION ||
      block.type === BlockType.CONDITIONAL;

  const isCurrentlyExpanded = block.isExpanded ?? false;
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

  const getBlockVisuals = () => {
    const config = BLOCK_CONFIGS[block.type];
    const settings = block.settings;
    let title = config.name;
    let details = '';
    let regexFragment = '';
    let visualHint: React.ReactNode = null;

    switch (block.type) {
      case BlockType.LITERAL:
        const litSettings = settings as LiteralSettings;
        if (litSettings.isRawRegex) {
          title = 'Необработанный Regex';
          regexFragment = litSettings.text || '';
        } else {
          title = 'Текст';
          regexFragment = (litSettings.text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
        if (regexFragment) {
            details = `'${(litSettings.text || '').substring(0, 20)}'`;
        } else {
            details = 'Пустой литерал. Введите текст.';
        }
        break;

      case BlockType.CHARACTER_CLASS:
        const ccSettings = settings as CharacterClassSettings;
        const pattern = ccSettings.pattern;

        const shorthandInfo: { [key: string]: { title: string; details: string } } = {
          '\\d': { title: 'Любая цифра', details: 'Эквивалент [0-9]' },
          '\\D': { title: 'Не цифра', details: 'Эквивалент [^0-9]' },
          '\\w': { title: 'Символ слова', details: 'Буква, цифра или _' },
          '\\W': { title: 'Не символ слова', details: 'Кроме \\w' },
          '\\s': { title: 'Пробельный символ', details: 'Пробел, таб, новая строка...' },
          '\\S': { title: 'Не пробельный символ', details: 'Кроме \\s' },
          '.': { title: 'Любой символ', details: 'Кроме новой строки' },
          '\\p{L}': { title: 'Любая буква', details: 'Находит одну букву любого алфавита' },
        };

        if (shorthandInfo[pattern]) {
          title = shorthandInfo[pattern].title;
          details = shorthandInfo[pattern].details;
        } else {
          title = 'Набор символов';
          if (pattern) {
            details = ccSettings.negated ? `Кроме: [${pattern}]` : `Любой из: [${pattern}]`;
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
        
        switch(gSettings.type) {
          case 'capturing':
            title = groupInfo ? `Группа (захват №${groupInfo.groupIndex})` : 'Группа (захватывающая)';
            regexFragment = `(...)`;
            details = 'Сохраняет найденный текст.';
            break;
          case 'non-capturing':
            title = `Группа (незахватывающая)`;
            regexFragment = `(?:...)`;
            details = 'Объединяет, но не сохраняет.';
            break;
          case 'named':
            title = `Группа (имя: ${gSettings.name || '...'})`;
            regexFragment = `(?<${gSettings.name || '...'}>...)`;
            details = 'Сохраняет в именованную группу.';
            break;
          default:
            title = "Группа";
            details = 'Контейнер для блоков';
            regexFragment = `(...)`;
        }
        break;

      case BlockType.ANCHOR:
        const aSettings = settings as AnchorSettings;
        const anchorMap: {[key: string]: {title: string, details: string, regex: string}} = {
            '^': {title: 'Начало строки/текста', details: 'Совпадение в начале', regex: '^'},
            '$': {title: 'Конец строки/текста', details: 'Совпадение в конце', regex: '$'},
            '\\b': {title: 'Граница слова', details: 'На границе слова', regex: '\\b'},
            '\\B': {title: 'Не граница слова', details: 'Не на границе слова', regex: '\\B'},
        };
        const anchorInfo = anchorMap[aSettings.type];
        title = anchorInfo?.title || 'Якорь';
        details = anchorInfo?.details || 'Указывает позицию';
        regexFragment = anchorInfo?.regex || aSettings.type;
        break;

      case BlockType.LOOKAROUND:
        const lSettings = settings as LookaroundSettings;
        const lookaroundInfo: {[key in LookaroundSettings['type']]: {title: string, details: string, regex: string, hint: React.ReactNode} } = {
          'positive-lookahead': { title: 'Просмотр вперёд (+)', details: 'Условие: далее следует', regex: '(?=...)', hint: <div className="flex items-center gap-1 text-xs text-muted-foreground/80 font-semibold"><span className="font-bold text-lg leading-none text-primary/70">→</span><span>Проверка</span></div> },
          'negative-lookahead': { title: 'Просмотр вперёд (-)', details: 'Условие: далее НЕ следует', regex: '(?!...)', hint: <div className="flex items-center gap-1 text-xs text-muted-foreground/80 font-semibold"><span className="font-bold text-lg leading-none text-primary/70">→</span><span>Проверка</span></div> },
          'positive-lookbehind': { title: 'Просмотр назад (+)', details: 'Условие: этому предшествует', regex: '(?<=...)', hint: <div className="flex items-center gap-1 text-xs text-muted-foreground/80 font-semibold"><span className="font-bold text-lg leading-none text-primary/70">←</span><span>Проверка</span></div> },
          'negative-lookbehind': { title: 'Просмотр назад (-)', details: 'Условие: этому НЕ предшествует', regex: '(?<!...)', hint: <div className="flex items-center gap-1 text-xs text-muted-foreground/80 font-semibold"><span className="font-bold text-lg leading-none text-primary/70">←</span><span>Проверка</span></div> },
        };
        const info = lookaroundInfo[lSettings.type];
        title = info.title;
        details = info.details;
        regexFragment = info.regex;
        visualHint = info.hint;
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

    return { icon: config.icon, title, details, regexFragment, visualHint };
  };

  const { icon, title, details, regexFragment, visualHint } = getBlockVisuals();

  const renderQuantifierBadge = () => {
    if (!quantifierToRender) return null;

    const qSettings = quantifierToRender.settings as QuantifierSettings;
    let badgeDetails = '';
    switch (qSettings.type) {
      case '*': badgeDetails = '0+'; break;
      case '+': badgeDetails = '1+'; break;
      case '?': badgeDetails = '0–1'; break;
      case '{n}': badgeDetails = `{${qSettings.min ?? 0}}`; break;
      case '{n,}': badgeDetails = `${qSettings.min ?? 0}+`; break;
      case '{n,m}': badgeDetails = `${qSettings.min ?? 0}–${qSettings.max ?? ''}`; break;
    }
    const modeMap: {[key in QuantifierSettings['mode']]: string} = {'greedy': 'Жадный', 'lazy': 'Ленивый', 'possessive': 'Ревнивый'};

    return (
      <div
        onClick={(e) => handleSelectBlock(e, quantifierToRender!.id)}
        onMouseEnter={() => onBlockHover(quantifierToRender!.id)}
        onMouseLeave={() => onBlockHover(null)}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 right-[2.5rem] z-10 cursor-pointer",
          "bg-sky-100 text-sky-800 border-sky-300 border",
          "dark:bg-sky-900/50 dark:text-sky-300 dark:border-sky-700/50",
          "px-2.5 py-1 rounded-full text-xs font-semibold shadow-md hover:shadow-lg transition-all flex items-center gap-1.5",
          (hoveredId === quantifierToRender.id) && !isQuantifierSelected && "ring-2 ring-accent bg-accent/20 brightness-110",
          isQuantifierSelected && "ring-2 ring-primary bg-primary/20 brightness-110"
        )}
        title={`${modeMap[qSettings.mode]} квантификатор`}
      >
        <Repeat size={12} />
        <span>{badgeDetails}</span>
      </div>
    );
  };


  return (
    <div
      id={`block-node-${block.id}`}
      style={{ paddingLeft: `${depth * 1.5}rem` }}
      className="relative"
      onDragOver={(e) => onDragOver(e, block.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, block.id)}
    >
       {dropIndicator && dropIndicator.targetId === block.id && (
          <div
            className={cn('absolute left-0 right-0 z-20 h-1 bg-blue-500 rounded-full pointer-events-none', {
              'top-[-4px]': dropIndicator.position === 'before',
              'bottom-[-4px]': dropIndicator.position === 'after',
              'hidden': dropIndicator.position === 'inside',
            })}
          />
        )}
      <div
        draggable="true"
        onDragStart={(e) => onDragStart(e, block.id)}
        onDragEnd={onDragEnd}
        onMouseEnter={() => onBlockHover(block.id)}
        onMouseLeave={() => onBlockHover(null)}
        className="transition-all relative group/blocknode"
        onClick={(e) => handleSelectBlock(e, block.id)}
      >
        <div
          className={cn(
            "block-main-content border rounded-md relative transition-all",
            "bg-card",
            isBlockHovered && "bg-accent/10 ring-1 ring-accent",
            isSelected && "ring-2 ring-primary shadow-lg bg-primary/10",
            dropIndicator?.targetId === block.id && dropIndicator?.position === 'inside' && 'ring-2 ring-blue-500 ring-inset'
          )}
        >
          <div className="absolute top-1 right-1 flex items-center gap-0.5 z-20">
              {isContainerBlock && (
                <Button variant="ghost" size="iconSm" onClick={handleToggleExpand} className="h-6 w-6 text-muted-foreground hover:text-primary">
                  {isCurrentlyExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </Button>
              )}
              {block.type === BlockType.GROUP && hasChildren && (
                 <Button variant="ghost" size="iconSm" onClick={(e) => { e.stopPropagation(); onUngroup(block.id); }} className="h-6 w-6 opacity-0 group-hover/blocknode:opacity-100 transition-opacity text-muted-foreground hover:text-primary" title="Разгруппировать"><Ungroup size={14}/></Button>
              )}
               <Button variant="ghost" size="iconSm" onClick={(e) => { e.stopPropagation(); onWrapBlock(block.id); }} className="h-6 w-6 opacity-0 group-hover/blocknode:opacity-100 transition-opacity text-muted-foreground hover:text-primary" title="Обернуть в группу"><WrapText size={14} /></Button>
              <Button
                  variant="ghost"
                  size="iconSm"
                  onClick={(e) => {
                      e.stopPropagation();
                      onAddSibling(parentId, block.id);
                  }}
                  className="h-6 w-6 opacity-0 group-hover/blocknode:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                  title="Добавить блок после"
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

          <div className="p-2 pr-4 flex items-start gap-3">
            <GripVertical className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1 cursor-grab" />
            
             <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-primary h-5 w-5 flex items-center justify-center">{icon}</span>
                  <h3 className="font-semibold text-sm truncate">{title}</h3>
                  {visualHint}
                </div>

                {(details || regexFragment) && (
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {details && <p className="text-xs text-muted-foreground truncate">{details}</p>}
                        {regexFragment && (
                            <div className="px-1.5 py-0.5 bg-muted/70 rounded font-mono text-xs text-foreground/80">
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
             <div className="absolute left-0 top-0 bottom-2 w-px bg-primary/20 -translate-x-1/2"></div>
             {isEmptyContainer ? (
               <div className="pt-2 pb-1">
                 <div
                  className="pl-4 pr-2 py-4 border-l-2 border-dashed border-muted-foreground/50 bg-muted/30 rounded-r-md text-center text-muted-foreground text-xs italic hover:border-primary hover:text-primary cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); onAddChild(block.id, block.id); }}
                >
                  <p>{block.type === BlockType.ALTERNATION ? 'Добавьте дочерний блок как первую альтернативу' : 'Перетащите дочерние блоки сюда'}</p>
                 </div>
               </div>
            ) : block.type === BlockType.ALTERNATION ? (
                 <div className="space-y-1 pt-1">
                    {(block.children || []).map((altChild, index, arr) => (
                      <React.Fragment key={altChild.id}>
                        {renderChildNodes([altChild], block.id, depth + 1, groupInfos)}
                        {index < arr.length - 1 && (
                          <div className="alternation-separator my-2 flex items-center justify-center" aria-hidden="true">
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
