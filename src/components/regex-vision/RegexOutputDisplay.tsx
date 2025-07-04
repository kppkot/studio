
"use client";
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Copy, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface RegexOutputDisplayProps {
  generatedRegex: string;
  regexFlags: string;
  onFlagsChange: (flags: string) => void;
  onParseRegexString: (regex: string) => void;
  isParsing: boolean;
}

const RegexOutputDisplay: React.FC<RegexOutputDisplayProps> = ({
  generatedRegex,
  regexFlags,
  onFlagsChange,
  onParseRegexString,
  isParsing,
}) => {
  const { toast } = useToast();
  const [inputValue, setInputValue] = useState(generatedRegex);

  useEffect(() => {
    // Sync from parent when blocks change
    setInputValue(generatedRegex);
  }, [generatedRegex]);

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
    // Only parse if the value has changed from what's derived from blocks
    if (inputValue !== generatedRegex) {
        onParseRegexString(inputValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleParse();
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="generatedRegexOutput" className="text-sm font-medium">Ваше регулярное выражение</Label>
      <div className="flex items-center gap-2">
        <div className="flex-1 relative flex items-center">
            <span className="absolute left-3 text-muted-foreground">/</span>
            <Input
                id="generatedRegexOutput"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onBlur={handleParse}
                onKeyDown={handleKeyDown}
                className="flex-1 font-mono text-sm pl-5 pr-3 h-10"
                placeholder="Вставьте ваш Regex здесь и нажмите Enter"
                disabled={isParsing}
            />
            {isParsing && <Loader2 className="absolute right-3 h-4 w-4 animate-spin text-primary" />}
            <span className="absolute -right-10 text-muted-foreground">/</span>
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
