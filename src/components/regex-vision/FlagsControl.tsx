"use client";
import React from 'react';
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface FlagConfig {
  flag: 'g' | 'i' | 'm' | 's' | 'u' | 'y';
  description: string;
}

const FLAGS_CONFIG: FlagConfig[] = [
  { flag: 'g', description: 'Глобальный поиск (найти все совпадения)' },
  { flag: 'i', description: 'Игнорировать регистр' },
  { flag: 'm', description: 'Многострочный режим (^ и $ ищут в начале/конце строк)' },
  { flag: 's', description: 'Режим "dotall" (точка `.` совпадает с символом новой строки)' },
  { flag: 'u', description: 'Unicode (корректная обработка суррогатных пар)' },
  { flag: 'y', description: 'Липкий режим (поиск только с позиции lastIndex)' },
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
    // Maintain order gimsuy
    const newFlags = FLAGS_CONFIG.map(f => f.flag).filter(f => flagSet.has(f)).join('');
    onFlagsChange(newFlags);
  };

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        {FLAGS_CONFIG.map(({ flag, description }) => (
          <Tooltip key={flag} delayDuration={300}>
            <TooltipTrigger asChild>
                <Toggle
                size="icon"
                pressed={flags.includes(flag)}
                onPressedChange={() => handleFlagToggle(flag)}
                aria-label={description}
                className="font-mono text-base"
                variant="outline"
                >
                {flag}
                </Toggle>
            </TooltipTrigger>
            <TooltipContent>
              <p>{description}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
};
