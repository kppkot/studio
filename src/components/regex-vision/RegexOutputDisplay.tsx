
"use client";
import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Block } from './types';
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

  // A simple tokenizer for syntax highlighting
  const tokenizeRegex = (regexStr: string): { type: string; value: string }[] => {
      const tokens: { type: string; value: string }[] = [];
      const regex = /\\.|\[\^?.*?\]|\(.*?\)|\.|[+*?{}()|^$]/g;
      let match;
      let lastIndex = 0;

      while ((match = regex.exec(regexStr)) !== null) {
          if (match.index > lastIndex) {
              tokens.push({ type: 'literal', value: regexStr.substring(lastIndex, match.index) });
          }
          const matchedValue = match[0];
          if (matchedValue.startsWith('\\')) {
              tokens.push({ type: 'escaped', value: matchedValue });
          } else if (matchedValue.startsWith('[')) {
              tokens.push({ type: 'char-class', value: matchedValue });
          } else if (matchedValue.startsWith('(')) {
              tokens.push({ type: 'group', value: matchedValue });
          } else {
              tokens.push({ type: 'meta', value: matchedValue });
          }
          lastIndex = match.index + matchedValue.length;
      }

      if (lastIndex < regexStr.length) {
          tokens.push({ type: 'literal', value: regexStr.substring(lastIndex) });
      }

      return tokens;
  };

  const renderTokenizedRegex = () => {
      const tokens = tokenizeRegex(generatedRegex);
      return tokens.map((token, index) => {
          let className = '';
          switch (token.type) {
              case 'escaped': className = 'text-purple-700 dark:text-purple-300 font-semibold'; break;
              case 'char-class': className = 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300'; break;
              case 'group': className = 'text-blue-700 dark:text-blue-300'; break;
              case 'meta': className = 'text-orange-600 dark:text-orange-400 font-bold'; break;
              case 'literal':
              default:
                  className = 'text-green-700 dark:text-green-400';
                  break;
          }
          return <span key={index} className={className}>{token.value}</span>;
      });
  };
  
  return (
    <div className="space-y-2">
      <Label htmlFor="generatedRegexOutput" className="text-sm font-medium">Сгенерированное регулярное выражение</Label>
      <div className="flex items-center gap-2">
        <div className="flex-1 p-2.5 bg-muted rounded-lg font-mono text-sm min-h-[2.5rem] flex items-center overflow-x-auto flex-wrap leading-relaxed">
          <span className="text-muted-foreground">/</span>
          {blocks.length > 0 
            ? renderTokenizedRegex()
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
