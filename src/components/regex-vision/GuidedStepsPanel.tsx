
"use client";
import React, { useState, useEffect, useMemo } from 'react';
import type { Block, CharacterClassSettings } from './types';
import { BlockType } from './types';
import type { GuidedRegexStep } from '@/ai/flows/schemas';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, CheckCircle, RefreshCw, Bot, Loader2, Wand2 } from 'lucide-react';

interface GuidedStepsPanelProps {
  query: string;
  steps: GuidedRegexStep[];
  isLoading: boolean;
  onAddStep: (block: Block, parentId: string | null) => void;
  onFinish: () => void;
  onResetAndFinish: () => void;
  selectedBlockId: string | null;
  blocks: Block[];
  onRegeneratePlan: () => Promise<void>;
}

const GuidedStepsPanel: React.FC<GuidedStepsPanelProps> = ({
  query,
  steps,
  isLoading,
  onAddStep,
  onFinish,
  onResetAndFinish,
  selectedBlockId,
  blocks,
  onRegeneratePlan,
}) => {
  const [addedIndices, setAddedIndices] = useState<Set<number>>(new Set());
  const [isRegenerating, setIsRegenerating] = useState(false);
  
  // Reset added steps when the underlying steps array changes from the parent
  useEffect(() => {
    setAddedIndices(new Set());
  }, [steps]);

  const handleAdd = (block: Block, index: number) => {
    let parentId: string | null = null;
    if (selectedBlockId) {
        const findBlockAndParentRecursive = (
            nodes: Block[],
            targetId: string,
            currentParent: Block | null = null
        ): { block: Block | null; parent: Block | null } => {
            for (const b of nodes) {
                if (b.id === targetId) return { block: b, parent: currentParent };
                if (b.children) {
                    const found = findBlockAndParentRecursive(b.children, targetId, b);
                    if (found.block) return found;
                }
            }
            return { block: null, parent: null };
        };

        const { block: selectedBlock, parent: selectedBlockParent } = findBlockAndParentRecursive(blocks, selectedBlockId);
        
        if (selectedBlock) {
            const isSelectedBlockAContainer = [BlockType.GROUP, BlockType.ALTERNATION, BlockType.LOOKAROUND, BlockType.CONDITIONAL].includes(selectedBlock.type) ||
                (selectedBlock.type === BlockType.CHARACTER_CLASS && (!(selectedBlock.settings as CharacterClassSettings).pattern || (selectedBlock.children && selectedBlock.children.length > 0)));

            if (isSelectedBlockAContainer) {
                 // If the selected block is a container, add new blocks inside it.
                 parentId = selectedBlock.id;
            } else if (selectedBlockParent) {
                 // If the selected block is NOT a container, add new blocks as its sibling.
                 // This means adding the new block to the selected block's parent.
                 parentId = selectedBlockParent.id;
            }
        }
    }
    
    onAddStep(block, parentId);
    setAddedIndices(prev => new Set(prev).add(index));
  };
  
  const handleRegenerateClick = async () => {
    setIsRegenerating(true);
    await onRegeneratePlan();
    setIsRegenerating(false);
  };

  return (
    <Card className="h-full shadow-none border-0 flex flex-col">
      <CardHeader className="py-3 px-4 border-b">
        <CardTitle className="text-lg flex items-center gap-2"><Bot size={20} /> Пошаговый план от AI</CardTitle>
      </CardHeader>
      <CardContent className="p-4 flex-1 min-h-0">
        <ScrollArea className="h-full pr-3">
          <div className="space-y-3">
            {steps.map((step, index) => (
              <Card key={`${step.block.type}-${index}`} className="p-2.5 flex flex-col gap-2">
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 font-bold text-primary text-lg mt-0.5">{index + 1}.</div>
                    <div className="flex-1">
                      <p className="text-sm">{step.explanation}</p>
                    </div>
                </div>
                <div className="flex items-center justify-end gap-2">
                   <Button size="sm" variant="outline" onClick={() => handleAdd(step.block, index)} disabled={addedIndices.has(index)}>
                      {addedIndices.has(index) ? <CheckCircle size={16} className="mr-2 text-green-600"/> : <PlusCircle size={16} className="mr-2"/>}
                      {addedIndices.has(index) ? "Добавлено" : "Добавить"}
                    </Button>
                </div>
              </Card>
            ))}
             {isLoading && (
                <div className="flex items-center justify-center p-4 text-muted-foreground">
                    <Loader2 size={20} className="mr-2 animate-spin" />
                    <span>AI генерирует план...</span>
                </div>
             )}
             {!isLoading && steps.length === 0 && (
                <div className="flex items-center justify-center p-4 text-muted-foreground">
                    <span>План не сгенерирован. Попробуйте перестроить его.</span>
                </div>
             )}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="pt-4 border-t flex flex-col gap-3">
        {steps.length > 0 && !isLoading && (
            <div className="text-center p-3 text-sm text-green-700 dark:text-green-400 bg-green-500/10 rounded-md border border-green-500/20 w-full">
                <div className="flex items-center justify-center font-semibold">
                    <CheckCircle size={16} className="mr-2" />
                    <span>План сгенерирован!</span>
                </div>
                <p className="text-xs mt-1">Добавляйте шаги в конструктор. Если план не нравится, вы можете перестроить его.</p>
            </div>
        )}
        
        <Button onClick={handleRegenerateClick} disabled={isLoading || isRegenerating} className="w-full">
            {(isLoading || isRegenerating) ? <><Loader2 size={16} className="mr-2 animate-spin" /> Перестройка плана...</> : <><RefreshCw size={16} className="mr-2"/> Перестроить план</>}
        </Button>
        
        <div className="w-full flex justify-between gap-2">
            <Button variant="secondary" size="sm" onClick={onResetAndFinish}>Очистить и завершить</Button>
            <Button variant="outline" size="sm" onClick={onFinish}>Завершить</Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default GuidedStepsPanel;
