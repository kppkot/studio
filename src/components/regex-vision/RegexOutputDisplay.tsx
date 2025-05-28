"use client";
import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface RegexOutputDisplayProps {
  generatedRegex: string;
  regexFlags: string;
  onFlagsChange: (flags: string) => void;
}

const RegexOutputDisplay: React.FC<RegexOutputDisplayProps> = ({ generatedRegex, regexFlags, onFlagsChange }) => {
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
  
  return (
    <div className="space-y-2">
      <Label htmlFor="generatedRegexOutput" className="text-sm font-medium">Сгенерированное регулярное выражение</Label>
      <div className="flex items-center gap-2">
        <div className="flex-1 p-3 bg-muted rounded-lg font-mono text-sm min-h-[2.5rem] flex items-center overflow-x-auto">
          <span className="text-muted-foreground">/</span>
          <span className="text-foreground break-all">{generatedRegex || (
            <span className="italic text-muted-foreground">Добавьте блоки для построения выражения</span>
          )}</span>
          <span className="text-muted-foreground">/</span>
        </div>
        <Input
          id="regexFlags"
          type="text"
          value={regexFlags}
          onChange={(e) => onFlagsChange(e.target.value.replace(/[^gimsuy]/g, ''))} // Разрешить только валидные флаги
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
