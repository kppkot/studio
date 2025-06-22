
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
import { generateRegexStringAndGroupInfo } from './utils';

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

  const renderStructuredRegex = () => {
    const { groupInfos } = generateRegexStringAndGroupInfo(blocks);

    // Map block IDs to their group info if they are a capturing group
    const blockIdToGroupInfoMap = new Map<string, { groupIndex: number, groupName?: string }>();
    groupInfos.forEach(info => {
      blockIdToGroupInfoMap.set(info.blockId, { groupIndex: info.groupIndex, groupName: info.groupName });
    });
    
    // This recursive function will now also be responsible for syntax highlighting
    const renderNode = (block: Block): React.ReactNode => {
      const isSelected = block.id === selectedBlockId;
      const isHovered = block.id === hoveredBlockId;

      const interactiveProps = {
        onMouseEnter: () => onHoverBlockInOutput(block.id),
        onMouseLeave: () => onHoverBlockInOutput(null),
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          onSelectBlockInOutput(block.id);
        },
        className: cn(
          "cursor-pointer rounded-sm p-0.5",
          isSelected && "bg-primary text-primary-foreground shadow-md",
          isHovered && !isSelected && "bg-accent/70 text-accent-foreground shadow-sm"
        ),
      };

      const renderChildren = (children: Block[], separator: string = ''): React.ReactNode => {
        const childNodes = children.map(child => renderNode(child));
        if(childNodes.length === 0) return null;
        return childNodes.reduce((acc, curr, idx) => [acc, <span key={`sep-${idx}`} className="text-pink-600 dark:text-pink-400 font-bold mx-px">{separator}</span>, curr]);
      };

      const renderEscaped = (text: string) => {
        return <span className="text-green-700 dark:text-green-400">{text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</span>
      };


      let content: React.ReactNode;
      switch (block.type) {
        case BlockType.LITERAL:
            const literalText = (block.settings as LiteralSettings).text;
            content = <span className="text-green-700 dark:text-green-400">{literalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</span>;
            break;
        case BlockType.CHARACTER_CLASS:
          const { pattern, negated } = block.settings as CharacterClassSettings;
          const specialShorthands = ['\\d', '\\D', '\\w', '\\W', '\\s', '\\S', '.'];
          if (!negated && specialShorthands.includes(pattern)) {
              content = (
                  <span className="text-purple-700 dark:text-purple-300 font-semibold">
                      {pattern}
                  </span>
              );
          } else {
              content = (
                  <span className="bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 px-0.5 rounded-sm">
                      [{negated && <span className="text-red-500 dark:text-red-400">^</span>}{pattern}]
                  </span>
              );
          }
          break;
        case BlockType.QUANTIFIER:
            const qs = block.settings as QuantifierSettings;
            let qText = qs.type;
             if (qText.includes('{')) {
                if (qs.type === '{n}') qText = `{${qs.min ?? 0}}`;
                else if (qs.type === '{n,}') qText = `{${qs.min ?? 0},}`;
                else if (qs.type === '{n,m}') qText = `{${qs.min ?? 0},${qs.max ?? ''}}`;
            }
            content = <span className="text-orange-600 dark:text-orange-400">{qText}{(qs.mode === 'lazy' ? '?' : qs.mode === 'possessive' ? '+' : '')}</span>;
            break;
        case BlockType.GROUP:
          const gs = block.settings as GroupSettings;
          let open = '(', close = ')';
          if (gs.type === 'non-capturing') open = '(?:';
          else if (gs.type === 'named') open = `(?<${gs.name || ''}>`;
          content = <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-0.5 rounded-sm">{open}{block.children.map(renderNode)}{close}</span>;
          break;
        case BlockType.ANCHOR:
          const as = block.settings as AnchorSettings;
          content = <span className="text-red-600 dark:text-red-400">{as.type}</span>;
          break;
        case BlockType.ALTERNATION:
            content = <>{renderChildren(block.children, '|')}</>;
            break;
        case BlockType.LOOKAROUND:
            const ls = block.settings as LookaroundSettings;
            const lookaroundMap = {
                'positive-lookahead': '(?=', 'negative-lookahead': '(?!',
                'positive-lookbehind': '(?<=', 'negative-lookbehind': '(?<!'
            };
            content = <span className="bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 px-0.5 rounded-sm">{lookaroundMap[ls.type]}{block.children.map(renderNode)}{')'}</span>;
            break;
        case BlockType.BACKREFERENCE:
            const ref = (block.settings as BackreferenceSettings).ref;
            const backrefText = isNaN(Number(ref)) ? `\\k<${ref}>` : `\\${ref}`;
            content = <span className="text-cyan-600 dark:text-cyan-400">{backrefText}</span>;
            break;
        default:
          content = <>{block.children.map(renderNode)}</>;
      }

      return <span {...interactiveProps} key={block.id}>{content}</span>;
    };

    return blocks.map(renderNode);
  };
  
  return (
    <div className="space-y-2">
      <Label htmlFor="generatedRegexOutput" className="text-sm font-medium">Сгенерированное регулярное выражение</Label>
      <div className="flex items-center gap-2">
        <div className="flex-1 p-2.5 bg-muted rounded-lg font-mono text-sm min-h-[2.5rem] flex items-center overflow-x-auto flex-wrap leading-relaxed">
          <span className="text-muted-foreground">/</span>
          {blocks.length > 0 
            ? renderStructuredRegex()
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
