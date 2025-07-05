
"use client";
import React, { useState, useEffect, useRef } from 'react';
import type { RegexStringPart } from './types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Copy, Loader2, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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

const COLORS = [
  'bg-red-100 dark:bg-red-900/40 text-red-900 dark:text-red-200',
  'bg-orange-100 dark:bg-orange-900/40 text-orange-900 dark:text-orange-200',
  'bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200',
  'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-900 dark:text-yellow-200',
  'bg-lime-100 dark:bg-lime-900/40 text-lime-900 dark:text-lime-200',
  'bg-green-100 dark:bg-green-900/40 text-green-900 dark:text-green-200',
  'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-200',
  'bg-teal-100 dark:bg-teal-900/40 text-teal-900 dark:text-teal-200',
  'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-900 dark:text-cyan-200',
  'bg-sky-100 dark:bg-sky-900/40 text-sky-900 dark:text-sky-200',
  'bg-blue-100 dark:bg-blue-900/40 text-blue-900 dark:text-blue-200',
  'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-900 dark:text-indigo-200',
  'bg-violet-100 dark:bg-violet-900/40 text-violet-900 dark:text-violet-200',
  'bg-purple-100 dark:bg-purple-900/40 text-purple-900 dark:text-purple-200',
  'bg-fuchsia-100 dark:bg-fuchsia-900/40 text-fuchsia-900 dark:text-fuchsia-200',
  'bg-pink-100 dark:bg-pink-900/40 text-pink-900 dark:text-pink-200',
  'bg-rose-100 dark:bg-rose-900/40 text-rose-900 dark:text-rose-200',
];

const getColorForId = (id: string) => {
  if (!id) return COLORS[0];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
};


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
              onClick={() => setIsEditing(true)}
              role="textbox"
              tabIndex={0}
              onFocus={() => setIsEditing(true)}
              onMouseLeave={() => onHoverPart(null)}
            >
                {stringParts.length > 0 ? stringParts.map((part, index) => (
                    <span 
                        key={`${part.blockId}-${index}`}
                        onMouseEnter={() => onHoverPart(part.blockId)}
                        onClick={(e) => { e.stopPropagation(); onSelectBlock(part.blockId); }}
                        className={cn(
                            "transition-all duration-100 rounded-sm px-1 cursor-pointer",
                            part.blockId ? getColorForId(part.blockId) : "text-foreground",
                            part.blockId === selectedBlockId ? "ring-2 ring-primary scale-105 shadow-lg z-10 relative font-bold" : 
                            part.blockId === hoveredBlockId ? "ring-1 ring-primary brightness-110" : ""
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
        <Input
          id="regexFlags"
          type="text"
          value={regexFlags}
          onChange={(e) => onFlagsChange(e.target.value.replace(/[^gimsuy]/g, ''))}
          className="w-20 font-mono text-center h-10"
          placeholder="флаги"
          aria-label="Флаги Regex"
        />
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
