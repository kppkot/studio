"use client";

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Check } from 'lucide-react';

interface FlagConfig {
  flag: 'g' | 'i' | 'm' | 's' | 'u' | 'y';
  title: string;
  description: React.ReactNode;
}

const FLAGS_CONFIG: FlagConfig[] = [
  { flag: 'g', title: 'Глобальный поиск (global)', description: 'Не останавливаться после первого совпадения' },
  { flag: 'i', title: 'Игнорировать регистр (insensitive)', description: 'Регистронезависимое совпадение' },
  { flag: 'm', title: 'Многострочный режим (multi line)', description: <span>Символы <code className="font-mono bg-muted px-1 py-0.5 rounded-sm">^</code> и <code className="font-mono bg-muted px-1 py-0.5 rounded-sm">$</code> соответствуют началу/концу строки</span> },
  { flag: 's', title: 'Однострочный режим (single line)', description: 'Символ "." соответствует также символу переноса строки' },
  { flag: 'u', title: 'Unicode', description: 'Корректная обработка полной поддержки Unicode' },
  { flag: 'y', title: 'Липкий поиск (sticky)', description: 'Поиск только с позиции, указанной в lastIndex' },
];

interface FlagsControlProps {
  flags: string;
  onFlagsChange: (flags: string) => void;
}

export const FlagsControl: React.FC<FlagsControlProps> = ({ flags, onFlagsChange }) => {
  const handleFlagToggle = (flag: FlagConfig['flag']) => {
    const flagSet = new Set(flags.split(''));
    if (flagSet.has(flag)) {
      flagSet.delete(flag);
    } else {
      flagSet.add(flag);
    }
    
    // Maintain a consistent order for flags
    const newFlags = ['g', 'i', 'm', 's', 'u', 'y'].filter(f => flagSet.has(f as any)).join('');
    onFlagsChange(newFlags);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-10 w-24 font-mono text-sm" title="Настроить флаги">
          /{flags}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 p-2" align="end">
        <DropdownMenuLabel className="px-2 py-1.5 text-sm font-semibold text-foreground/80 tracking-wider">
          ФЛАГИ REGEX
        </DropdownMenuLabel>
        
        <div className="flex flex-col gap-1 mt-1">
          {FLAGS_CONFIG.map(({ flag, title, description }) => (
            <DropdownMenuItem
              key={flag}
              onSelect={(e) => {
                e.preventDefault(); // prevent menu from closing to allow multiple selections
                handleFlagToggle(flag);
              }}
              className="flex flex-col items-start p-2 cursor-pointer focus:bg-accent/50 rounded-md"
            >
              <div className="flex justify-between w-full items-center">
                <span className="font-semibold text-green-700 dark:text-green-500">{title}</span>
                {flags.includes(flag) && <Check className="h-4 w-4 text-green-700 dark:text-green-500" />}
              </div>
              <div className="text-xs text-muted-foreground whitespace-normal">{description}</div>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
