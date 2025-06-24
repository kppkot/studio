
"use client";
import React from 'react';
import type { Block } from './types';
import type { GuidedRegexStep } from '@/ai/flows/schemas';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { BLOCK_CONFIGS } from './constants';
import { reconstructPatternFromChildren } from './utils';

interface GuidedStepsPanelProps {
  steps: GuidedRegexStep[];
  addedIndices: Set<number>;
  onAddStep: (block: Block, index: number) => void;
  onFinish: () => void;
  onCancel: () => void;
  onReset: () => void;
}

const getBlockPreview = (block: Block): string => {
    const config = BLOCK_CONFIGS[block.type];
    if (!config) return "Неизвестный блок";
    
    let details = "";
    switch (block.type) {
        case block.type.LITERAL: details = `"${(block.settings as any).text}"`; break;
        case block.type.CHARACTER_CLASS: 
            const pattern = reconstructPatternFromChildren(block.children) || (block.settings as any).pattern;
            details = (block.settings as any).negated ? `[^${pattern}]` : `[${pattern}]`; 
            break;
        case block.type.QUANTIFIER: details = (block.settings as any).type; break;
        default: details = config.name;
    }
    return details;
};

const GuidedStepsPanel: React.FC<GuidedStepsPanelProps> = ({ steps, addedIndices, onAddStep, onFinish, onCancel, onReset }) => {
  const allStepsAdded = addedIndices.size === steps.length;

  const handleResetAndFinish = () => {
    onReset();
    onFinish();
  };

  return (
    <Card className="h-full shadow-none border-0 flex flex-col">
      <CardHeader className="py-3 px-4 border-b">
        <CardTitle className="text-lg">Пошаговый план от AI</CardTitle>
      </CardHeader>
      <CardContent className="p-4 flex-1 min-h-0">
        <ScrollArea className="h-full pr-3">
          <div className="space-y-2">
            {steps.map((step, index) => (
              <Card key={index} className="p-2 flex items-center gap-3">
                <div className="flex-shrink-0 font-bold text-primary text-lg">{index + 1}</div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">{step.explanation}</p>
                  <p className="font-mono text-xs bg-muted p-1 rounded mt-1">{getBlockPreview(step.block)}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => onAddStep(step.block, index)} disabled={addedIndices.has(index)}>
                  {addedIndices.has(index) ? <CheckCircle size={16} className="mr-2 text-green-600"/> : <PlusCircle size={16} className="mr-2"/>}
                  {addedIndices.has(index) ? "Добавлено" : "Добавить"}
                </Button>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="pt-4 border-t flex justify-between">
         <Button variant="destructive" size="sm" onClick={handleResetAndFinish}>
            <RefreshCw size={16} className="mr-2"/> Очистить и завершить
        </Button>
        <Button variant="outline" size="sm" onClick={onCancel}>Отменить план</Button>
        {allStepsAdded && <Button size="sm" onClick={onFinish}>Завершить</Button>}
      </CardFooter>
    </Card>
  );
};

export default GuidedStepsPanel;
