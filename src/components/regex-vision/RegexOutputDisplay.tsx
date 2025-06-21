
"use client";
import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Block, CharacterClassSettings, GroupSettings, LiteralSettings, QuantifierSettings, AnchorSettings, BackreferenceSettings, LookaroundSettings, ConditionalSettings } from './types';
import { BlockType } from './types';
import { cn } from '@/lib/utils';
import { escapeRegexChars } from './utils';

interface RegexOutputDisplayProps {
  blocks: Block[];
  regexFlags: string;
  onFlagsChange: (flags: string) => void;
  generatedRegex: string;
  selectedBlockId: string | null;
  hoveredBlockId: string | null; // New prop for hover state
  onHoverBlockInOutput: (blockId: string | null) => void; // New callback
  onSelectBlockInOutput: (blockId: string) => void; // New callback
}

const RegexOutputDisplay: React.FC<RegexOutputDisplayProps> = ({
  blocks,
  regexFlags,
  onFlagsChange,
  generatedRegex,
  selectedBlockId,
  hoveredBlockId,
  onHoverBlockInOutput,
  onSelectBlockInOutput,
}) => {
  const { toast } = useToast();

  const handleCopyRegex = () => {
    navigator.clipboard.writeText(`/${generatedRegex}/${regexFlags}`)
      .then(() => {
        toast({ title: "Успех", description: "Regex скопирован в буфер обмена!" });
      })
      .catch(err => {
        toast({ title: "Ошибка", description: "Не удалось скопировать regex.", variant: "destructive" });
        console.error('Не удалось скопировать regex: ', err);
      });
  };

  const renderBlockWithStructure = React.useCallback((
    block: Block,
    keyPrefix: string,
    currentSelectedBlockId: string | null,
    currentHoveredBlockId: string | null
  ): React.ReactNode => {
    const settings = block.settings;
    const isSelected = block.id === currentSelectedBlockId;
    const isHovered = block.id === currentHoveredBlockId;

    const selectedHighlightClass = "bg-primary text-primary-foreground p-0.5 rounded-sm font-semibold shadow-md";
    const hoverHighlightClass = "bg-accent/70 text-accent-foreground p-0.5 rounded-sm shadow-sm";
    const interactiveCursorClass = "cursor-pointer";

    const attachEvents = (children: React.ReactNode) => (
      <span
        onMouseEnter={() => onHoverBlockInOutput(block.id)}
        onMouseLeave={() => onHoverBlockInOutput(null)}
        onClick={(e) => { e.stopPropagation(); onSelectBlockInOutput(block.id); }}
        className={cn(
          interactiveCursorClass,
          isSelected && selectedHighlightClass,
          isHovered && !isSelected && hoverHighlightClass
        )}
      >
        {children}
      </span>
    );

    const renderChildren = (children: Block[] | undefined, childKeyPrefix: string): React.ReactNode[] => {
      if (!children) return [];
      return children.map((child, idx) => renderBlockWithStructure(child, `${childKeyPrefix}-child-${idx}`, currentSelectedBlockId, currentHoveredBlockId));
    };

    let contentNode: React.ReactNode;
    let rawContent: React.ReactNode;

    switch (block.type) {
      case BlockType.LITERAL:
        const literalText = (settings as LiteralSettings).text || '';
        const escapedText = escapeRegexChars(literalText);

        const parts: React.ReactNode[] = [];
        let i = 0;
        while (i < escapedText.length) {
            if (escapedText[i] === '\\') {
                if (i + 1 < escapedText.length) {
                    parts.push(
                        <span key={i} className="text-green-700 dark:text-green-400">
                            <span className="text-red-600 dark:text-red-400">\\</span>
                            <span>{escapedText[i + 1]}</span>
                        </span>
                    );
                    i += 2;
                } else {
                    parts.push(<span key={i} className="text-green-700 dark:text-green-400">{escapedText[i]}</span>);
                    i++;
                }
            } else {
                parts.push(<span key={i} className="text-green-700 dark:text-green-400">{escapedText[i]}</span>);
                i++;
            }
        }
        rawContent = <span>{parts}</span>;
        contentNode = attachEvents(rawContent);
        break;
      
      case BlockType.CHARACTER_CLASS:
        const ccSettings = settings as CharacterClassSettings;
        const specialCharShorthands = ['\\d', '\\D', '\\w', '\\W', '\\s', '\\S', '.'];

        if (!ccSettings.negated && specialCharShorthands.includes(ccSettings.pattern)) {
            rawContent = (
              <span className={cn("text-purple-700 dark:text-purple-300 font-semibold")}>
                {ccSettings.pattern.startsWith('\\') ? (
                  <>
                    <span className="text-red-600 dark:text-red-400">{ccSettings.pattern[0]}</span>
                    <span>{ccSettings.pattern.substring(1)}</span>
                  </>
                ) : (
                  ccSettings.pattern
                )}
              </span>
            );
        } else {
          const escapedPattern = ccSettings.pattern.replace(/[\]\\]/g, '\\$&');
          rawContent = (
            <span className={cn("bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 px-0.5 rounded-sm mx-px")}>
              [{ccSettings.negated && <span className="text-red-500 dark:text-red-400">^</span>}{escapedPattern || ''}]
            </span>
          );
        }
        contentNode = attachEvents(rawContent);
        break;
      
      case BlockType.QUANTIFIER:
        const qSettings = settings as QuantifierSettings;
        const baseQuantifier = qSettings.type || '*';
        let modeModifier = '';
        if (qSettings.mode === 'lazy') modeModifier = '?';
        else if (qSettings.mode === 'possessive') modeModifier = '+';
        let qText = '';
        if (baseQuantifier.includes('{')) {
          const min = qSettings.min ?? 0;
          const max = qSettings.max;
          if (baseQuantifier === '{n}') qText = `{${min}}`;
          else if (baseQuantifier === '{n,}') qText = `{${min},}`;
          else if (baseQuantifier === '{n,m}') qText = `{${min},${max ?? ''}}`;
        } else {
          qText = baseQuantifier;
        }
        rawContent = <span className={cn("text-orange-600 dark:text-orange-400")}>{qText + modeModifier}</span>;
        contentNode = attachEvents(rawContent);
        break;
      
      case BlockType.GROUP:
        const gSettings = settings as GroupSettings;
        let groupOpen = "(";
        if (gSettings.type === 'non-capturing') groupOpen = "(?:";
        if (gSettings.type === 'named' && gSettings.name) groupOpen = `(?<${gSettings.name}>`;
        rawContent = (
          <span className={cn("bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-0.5 rounded-sm mx-px")}>
            {groupOpen}
            {renderChildren(block.children, `${keyPrefix}-grpchildren`)}
            )
          </span>
        );
        contentNode = attachEvents(rawContent);
        break;
      
      case BlockType.ANCHOR:
        const anchorType = (settings as AnchorSettings).type || '^';
        rawContent = (
          <span className={cn("text-red-600 dark:text-red-400")}>
            {anchorType.startsWith('\\') ? (
              <>
                <span className="text-red-600 dark:text-red-400">{anchorType[0]}</span>
                <span>{anchorType.substring(1)}</span>
              </>
            ) : (
              anchorType
            )}
          </span>
        );
        contentNode = attachEvents(rawContent);
        break;
      
      case BlockType.ALTERNATION:
        if (!block.children || block.children.length === 0) {
            contentNode = null;
            break;
        }
        const alternatedNodes = renderChildren(block.children, `${keyPrefix}-altchildren`);
        rawContent = (
          <>
            {alternatedNodes.reduce((acc, curr, currIdx) => {
              return acc === null ? [curr] : [...(acc as React.ReactNode[]), <span key={`${keyPrefix}-alt-sep-${currIdx}`} className="text-pink-600 dark:text-pink-400 font-bold mx-0.5">|</span>, curr];
            }, null as React.ReactNode[] | null)}
          </>
        );
        contentNode = attachEvents(rawContent);
        break;
      
      case BlockType.LOOKAROUND:
        const lSettings = settings as LookaroundSettings;
        const lookaroundMap = {
          'positive-lookahead': "(?=",
          'negative-lookahead': "(?!",
          'positive-lookbehind': "(?<=",
          'negative-lookbehind': "(?<!"
        };
        rawContent = (
          <span className={cn("bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 px-0.5 rounded-sm mx-px")}>
            {lookaroundMap[lSettings.type]}
            {renderChildren(block.children, `${keyPrefix}-lookchildren`)}
            )
          </span>
        );
        contentNode = attachEvents(rawContent);
        break;
      
      case BlockType.BACKREFERENCE:
        const brSettings = settings as BackreferenceSettings;
        rawContent = <span className={cn("text-cyan-600 dark:text-cyan-400")}>\\{brSettings.ref}</span>;
        contentNode = attachEvents(rawContent);
        break;

      case BlockType.CONDITIONAL:
        const condSettings = settings as ConditionalSettings;
        let conditionalStr = `(?(${condSettings.condition})${condSettings.yesPattern}`;
        if (condSettings.noPattern) {
          conditionalStr += `|${condSettings.noPattern}`;
        }
        conditionalStr += `)`;
        rawContent = <span className={cn("text-indigo-600 dark:text-indigo-400")}>{conditionalStr}</span>;
        contentNode = attachEvents(rawContent);
        break;

      default:
        const defaultChildren = renderChildren(block.children, `${keyPrefix}-defchildren`);
        if (defaultChildren.length > 0) {
             contentNode = <>{defaultChildren}</>;
        } else {
            contentNode = attachEvents(<span className="opacity-50">({block.type})</span>);
        }
        break;
    }
    return <React.Fragment key={`${keyPrefix}-${block.id}`}>{contentNode}</React.Fragment>;
  }, [onHoverBlockInOutput, onSelectBlockInOutput]);
  
  return (
    <div className="space-y-2">
      <Label htmlFor="generatedRegexOutput" className="text-sm font-medium">Сгенерированное регулярное выражение</Label>
      <div className="flex items-center gap-2">
        <div className="flex-1 p-2.5 bg-muted rounded-lg font-mono text-sm min-h-[2.5rem] flex items-center overflow-x-auto flex-wrap leading-relaxed">
          <span className="text-muted-foreground">/</span>
          {blocks.length > 0 
            ? blocks.map((block, index) => renderBlockWithStructure(block, `structured-${block.id}-${index}`, selectedBlockId, hoveredBlockId))
            : <span className="italic text-muted-foreground">Добавьте блоки для построения выражения</span>
          }
          <span className="text-muted-foreground">/</span>
        </div>
        <Input
          id="regexFlags"
          type="text"
          value={regexFlags}
          onChange={(e) => onFlagsChange(e.target.value.replace(/[^gimsuy]/g, ''))}
          className="w-20 p-3 font-mono text-center h-10"
          placeholder="флаги"
          aria-label="Флаги Regex"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={handleCopyRegex}
          title="Копировать Regex"
          className="h-10 w-10"
          disabled={!generatedRegex}
        >
          <Copy size={16} />
        </Button>
      </div>
    </div>
  );
};

export default RegexOutputDisplay;
