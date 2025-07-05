
"use client";
import React, { useState, useEffect, useRef } from 'react';
import type { RegexStringPart, BlockType } from './types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Copy, Loader2, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { FlagsControl } from './FlagsControl';

const colorMap: Record<string, string> = {
  ANCHOR: 'bg-blue-200/70 dark:bg-blue-800/40 text-blue-900 dark:text-blue-200',
  QUANTIFIER: 'bg-sky-200/70 dark:bg-sky-800/40 text-sky-900 dark:text-sky-200',
  CHARACTER_CLASS: 'bg-orange-200/70 dark:bg-orange-800/40 text-orange-900 dark:text-orange-200',
  GROUP: 'bg-green-200/70 dark:bg-green-800/40 text-green-900 dark:text-green-200',
  LOOKAROUND: 'bg-green-200/70 dark:bg-green-800/40 text-green-900 dark:text-green-200',
  ALTERNATION: 'bg-green-200/70 dark:bg-green-800/40 text-green-900 dark:text-green-200',
  BACKREFERENCE: 'bg-pink-200/70 dark:bg-pink-800/40 text-pink-900 dark:text-pink-200',
  CONDITIONAL: 'bg-fuchsia-200/70 dark:bg-fuchsia-800/40 text-fuchsia-900 dark:text-fuchsia-200',
  LITERAL: 'text-foreground',
};

const getColorForType = (type: BlockType | undefined) => {
  if (!type) return 'text-foreground';
  return colorMap[type] || 'text-foreground';
};


interface RegexOutputDisplayProps {
  generatedRegex: string;
  regexFlags: string;
  onFlagsChange: (flags: string) => void;
  onParseRegexString: (regex: string) => void;
  isParsing: boolean;
  stringParts: RegexStringPart[];
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  hoveredBlockId: string | null;
  onHoverPart: (blockId: string | null) => void;
}

const RegexOutputDisplay: React.FC<RegexOutputDisplayProps> = ({
  generatedRegex,
  regexFlags,
  onFlagsChange,
  onParseRegexString,
  isParsing,
  stringParts,
  selectedBlockId,
  onSelectBlock,
  hoveredBlockId,
  onHoverPart
}) => {
  const { toast } = useToast();
  const [inputValue, setInputValue] = useState(generatedRegex);
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Only update from parent if not currently editing
    if (!isEditing) {
      setInputValue(generatedRegex);
    }
  }, [generatedRegex, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
    }
  }, [isEditing]);


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

  const handleParse = () => {
    if (inputValue !== generatedRegex) {
        onParseRegexString(inputValue);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleParse();
    } else if (e.key === 'Escape') {
      setInputValue(generatedRegex); // Revert changes on escape
      setIsEditing(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="generatedRegexOutput" className="text-sm font-medium">Ваше регулярное выражение</Label>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">/</span>
        <div className="flex-1 relative">
           {isEditing ? (
             <Input
                ref={inputRef}
                id="generatedRegexOutput"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onBlur={handleParse}
                onKeyDown={handleKeyDown}
                className="flex-1 font-mono text-sm h-10 pr-8"
                placeholder="Вставьте ваш Regex здесь и нажмите Enter"
                disabled={isParsing}
            />
           ) : (
            <div 
              className="flex items-center h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background cursor-text flex-wrap"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                   setIsEditing(true);
                }
              }}
              role="textbox"
              tabIndex={0}
              onMouseLeave={() => onHoverPart(null)}
            >
                {stringParts.length > 0 ? stringParts.map((part, index) => (
                    <span 
                        key={`${part.blockId}-${index}`}
                        onMouseEnter={() => onHoverPart(part.blockId)}
                        onClick={(e) => { e.stopPropagation(); onSelectBlock(part.blockId); }}
                        className={cn(
                          "transition-all duration-100 rounded-sm px-0.5 cursor-pointer",
                          getColorForType(part.blockType),
                          {
                            "ring-2 ring-primary scale-105 shadow-lg z-10 relative font-bold brightness-110": part.blockId === selectedBlockId,
                            "ring-1 ring-primary brightness-110": part.blockId === hoveredBlockId && part.blockId !== selectedBlockId,
                          }
                        )}
                    >
                        {part.text}
                    </span>
                )) : <span className="text-muted-foreground">Начните строить выражение...</span>}
            </div>
           )}
           {isParsing && !isEditing && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />}
        </div>
        <span className="text-muted-foreground">/</span>
        <FlagsControl flags={regexFlags} onFlagsChange={onFlagsChange} />
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsEditing(true)}
          title="Разобрать выражение и построить дерево"
          className="h-10 w-10"
          disabled={isParsing}
        >
          <Wand2 size={16} />
        </Button>
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
