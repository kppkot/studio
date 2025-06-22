"use client";
import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Block, LiteralSettings, CharacterClassSettings, QuantifierSettings, GroupSettings, AnchorSettings, LookaroundSettings, BackreferenceSettings, ConditionalSettings } from './types';
import { BlockType } from './types';
import { cn } from '@/lib/utils';


interface RegexOutputDisplayProps {
  blocks: Block[];
  regexFlags: string;
  onFlagsChange: (flags: string) => void;
  generatedRegex: string;
  selectedBlockId: string | null;
  hoveredBlockId: string | null;
  onHoverBlockInOutput: (blockId: string | null) => void;
  onSelectBlockInOutput: (blockId: string) => void;
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
  
  const escapeRegexCharsForDisplay = (text: string): string => {
    // This function escapes all special regex characters.
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  const renderInteractiveRegex = (blocksToRender: Block[]): React.ReactNode[] => {
    return blocksToRender.map(block => {
      const isSelected = selectedBlockId === block.id;
      const isHovered = hoveredBlockId === block.id;
      const settings = block.settings;

      const spanProps = {
        className: cn('cursor-pointer rounded-[3px] p-0.5 transition-colors', {
          'bg-primary/20 ring-1 ring-primary/80': isSelected,
          'bg-accent/30': isHovered && !isSelected,
        }),
        onMouseEnter: (e: React.MouseEvent) => { e.stopPropagation(); onHoverBlockInOutput(block.id); },
        onMouseLeave: (e: React.MouseEvent) => { e.stopPropagation(); onHoverBlockInOutput(null); },
        onClick: (e: React.MouseEvent) => { e.stopPropagation(); onSelectBlockInOutput(block.id); },
      };

      const renderChildren = (b: Block): React.ReactNode[] => {
        if (!b.children) return [];
        if (b.type === BlockType.ALTERNATION) {
          return b.children.map((child, index) => (
            <React.Fragment key={child.id}>
              {renderInteractiveRegex([child])}
              {index < b.children.length - 1 && <span className='text-orange-600 font-bold px-0.5'>|</span>}
            </React.Fragment>
          ));
        }
        return renderInteractiveRegex(b.children);
      };

      switch (block.type) {
        case BlockType.LITERAL:
          return (
            <span key={block.id} {...spanProps}>
              <span className='text-green-700 dark:text-green-400'>
                {escapeRegexCharsForDisplay((settings as LiteralSettings).text || '')}
              </span>
            </span>
          );
        
        case BlockType.CHARACTER_CLASS:
          const ccSettings = settings as CharacterClassSettings;
          const specialShorthands = ['\\d', '\\D', '\\w', '\\W', '\\s', '\\S'];
          let content;
          if (!ccSettings.negated && specialShorthands.includes(ccSettings.pattern)) {
            content = (
              <>
                <span className="text-red-500 font-semibold">\</span>
                <span className="text-purple-700 dark:text-purple-300 font-semibold">{ccSettings.pattern.substring(1)}</span>
              </>
            );
          } else if (ccSettings.pattern === '.') {
              content = <span className="text-purple-700 dark:text-purple-300 font-semibold">.</span>
          } else if (block.children && block.children.length > 0) {
            content = (
              <>
                 <span className='text-purple-700 dark:text-purple-300'>[</span>
                  <span className='text-orange-600 font-bold'>
                    {ccSettings.negated ? '^' : ''}
                  </span>
                  {renderChildren(block)}
                 <span className='text-purple-700 dark:text-purple-300'>]</span>
              </>
            )
          } else {
            content = (
              <>
                <span className='text-purple-700 dark:text-purple-300'>[</span>
                <span className='text-orange-600 font-bold'>
                  {ccSettings.negated ? '^' : ''}
                </span>
                <span className='text-green-700 dark:text-green-400'>
                  {ccSettings.pattern || ''}
                </span>
                <span className='text-purple-700 dark:text-purple-300'>]</span>
              </>
            );
          }
          return <span key={block.id} {...spanProps}>{content}</span>;

        case BlockType.QUANTIFIER:
          const qSettings = settings as QuantifierSettings;
          let qStr = qSettings.type || '*';
          if (qStr.includes('{')) {
            const min = qSettings.min ?? 0;
            const max = qSettings.max;
            if (qStr === '{n}') qStr = `{${min}}`;
            else if (qStr === '{n,}') qStr = `{${min},}`;
            else if (qStr === '{n,m}') qStr = `{${min},${max ?? ''}}`;
          }
          let mode = '';
          if (qSettings.mode === 'lazy') mode = '?';
          else if (qSettings.mode === 'possessive') mode = '+';
          return <span key={block.id} {...spanProps} className={cn(spanProps.className, 'text-orange-600 font-bold')}>{qStr + mode}</span>;

        case BlockType.GROUP:
          const gSettings = settings as GroupSettings;
          let groupOpen = "(";
          if (gSettings.type === 'non-capturing') groupOpen = "(?:";
          if (gSettings.type === 'named' && gSettings.name) groupOpen = `(?<${gSettings.name}>`;
          return (
            <span key={block.id} {...spanProps}>
              <span className='text-blue-700 dark:text-blue-300'>{groupOpen}</span>
              {renderChildren(block)}
              <span className='text-blue-700 dark:text-blue-300'>)</span>
            </span>
          );
        
        case BlockType.ANCHOR:
          return <span key={block.id} {...spanProps} className={cn(spanProps.className, 'text-red-500 font-semibold')}>{(settings as AnchorSettings).type || '^'}</span>;

        case BlockType.LOOKAROUND:
          const lSettings = settings as LookaroundSettings;
          const lookaroundMap = { 'positive-lookahead': '(?=', 'negative-lookahead': '(?!', 'positive-lookbehind': '(?<=', 'negative-lookbehind': '(?<!' };
          return (
            <span key={block.id} {...spanProps}>
              <span className='text-blue-700 dark:text-blue-300'>{lookaroundMap[lSettings.type]}</span>
              {renderChildren(block)}
              <span className='text-blue-700 dark:text-blue-300'>)</span>
            </span>
          );
        
        case BlockType.BACKREFERENCE:
          const ref = (settings as BackreferenceSettings).ref;
          return (
            <span key={block.id} {...spanProps} className={cn(spanProps.className, 'text-purple-700 dark:text-purple-300 font-semibold')}>
              {isNaN(Number(ref)) ? `\\k<${ref}>` : `\\${ref}`}
            </span>
          );

        case BlockType.ALTERNATION:
             return <span key={block.id} {...spanProps}>{renderChildren(block)}</span>;

        default:
          return <React.Fragment key={block.id}>{renderChildren(block)}</React.Fragment>;
      }
    });
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="generatedRegexOutput" className="text-sm font-medium">Сгенерированное регулярное выражение</Label>
      <div className="flex items-center gap-2">
        <div className="flex-1 p-2.5 bg-muted rounded-lg font-mono text-sm min-h-[2.5rem] flex items-center overflow-x-auto flex-wrap leading-relaxed">
          <span className="text-muted-foreground">/</span>
          {blocks.length > 0 ? (
            renderInteractiveRegex(blocks)
          ) : (
            <span className="italic text-muted-foreground">Добавьте блоки для построения выражения</span>
          )}
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
