
"use client";
import React, { useState, useEffect } from 'react';
import type { Block } from './types';
import { BlockType } from './types';
import type { GuidedRegexStep } from '@/ai/flows/schemas';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, CheckCircle, RefreshCw, Bot, Loader2, Wand2 } from 'lucide-react';
import { generateNextGuidedStep, regenerateGuidedStep } from '@/ai/flows/guided-regex-flow';
import { useToast } from '@/hooks/use-toast';

interface GuidedStepsPanelProps {
  query: string;
  exampleTestText: string;
  initialSteps: GuidedRegexStep[];
  onAddStep: (block: Block, parentId: string | null) => void;
  onFinish: () => void;
  onResetAndFinish: () => void;
  selectedBlockId: string | null;
  blocks: Block[];
}

const GuidedStepsPanel: React.FC<GuidedStepsPanelProps> = ({
  query,
  exampleTestText,
  initialSteps,
  onAddStep,
  onFinish,
  onResetAndFinish,
  selectedBlockId,
  blocks,
}) => {
  const [steps, setSteps] = useState<GuidedRegexStep[]>(initialSteps);
  const [addedIndices, setAddedIndices] = useState<Set<number>>(new Set());
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [isPlanComplete, setIsPlanComplete] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const lastStep = steps[steps.length - 1];
    if (lastStep?.isFinalStep) {
        setIsPlanComplete(true);
    } else {
        setIsPlanComplete(false);
    }
  }, [steps]);


  const handleAdd = (block: Block, index: number) => {
    let parentId: string | null = null;
    if (selectedBlockId) {
        const findBlockRecursive = (searchBlocks: Block[], id: string): Block | null => {
            for (const b of searchBlocks) {
                if (b.id === id) return b;
                if (b.children) {
                    const found = findBlockRecursive(b.children, id);
                    if (found) return found;
                }
            }
            return null;
        };
        const selectedBlock = findBlockRecursive(blocks, selectedBlockId);
        if (selectedBlock && [BlockType.GROUP, BlockType.ALTERNATION, BlockType.LOOKAROUND, BlockType.CONDITIONAL, BlockType.CHARACTER_CLASS].includes(selectedBlock.type)) {
            parentId = selectedBlockId;
        }
    }
    
    onAddStep(block, parentId);
    setAddedIndices(prev => new Set(prev).add(index));
  };

  const handleNextStep = async () => {
    setIsLoadingNext(true);
    try {
      const newStep = await generateNextGuidedStep({
        query,
        exampleTestText,
        existingSteps: steps,
      });
      setSteps(prev => [...prev, newStep]);
      if (newStep.isFinalStep) {
          toast({ title: "План завершен!", description: "AI считает, что это был последний необходимый шаг." });
      }
    } catch (error) {
      console.error("Failed to generate next step:", error);
      toast({ title: "Ошибка AI", description: "Не удалось сгенерировать следующий шаг.", variant: "destructive" });
    } finally {
      setIsLoadingNext(false);
    }
  };
  
  const handleRegenerate = async (indexToRegen: number) => {
    setRegeneratingIndex(indexToRegen);
    try {
        const stepToRegenerate = steps[indexToRegen];
        const stepsSoFar = steps.slice(0, indexToRegen);

        const newStep = await regenerateGuidedStep({
            query,
            exampleTestText,
            stepsSoFar,
            stepToRegenerate
        });

        setSteps(prev => {
            const newSteps = [...prev];
            newSteps[indexToRegen] = newStep;
            return newSteps;
        });
        // Allow re-adding the new step
        setAddedIndices(prev => {
            const newAdded = new Set(prev);
            newAdded.delete(indexToRegen);
            return newAdded;
        });

    } catch (error) {
      console.error("Failed to regenerate step:", error);
      toast({ title: "Ошибка AI", description: "Не удалось перегенерировать шаг.", variant: "destructive" });
    } finally {
        setRegeneratingIndex(null);
    }
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
              <Card key={`${step.block.id}-${index}`} className="p-2.5 flex flex-col gap-2">
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 font-bold text-primary text-lg mt-0.5">{index + 1}.</div>
                    <div className="flex-1">
                      <p className="text-sm">{step.explanation}</p>
                    </div>
                </div>
                <div className="flex items-center justify-end gap-2">
                   <Button size="sm" variant="ghost" onClick={() => handleRegenerate(index)} disabled={regeneratingIndex !== null || isLoadingNext}>
                       {regeneratingIndex === index ? (
                           <><Loader2 size={16} className="mr-2 animate-spin"/> Перегенерация...</>
                       ) : (
                           <><RefreshCw size={16} className="mr-2"/> Перегенерировать шаг</>
                       )}
                   </Button>
                   <Button size="sm" variant="outline" onClick={() => handleAdd(step.block, index)} disabled={addedIndices.has(index)}>
                      {addedIndices.has(index) ? <CheckCircle size={16} className="mr-2 text-green-600"/> : <PlusCircle size={16} className="mr-2"/>}
                      {addedIndices.has(index) ? "Добавлено" : "Добавить"}
                    </Button>
                </div>
              </Card>
            ))}
             {isLoadingNext && (
                <div className="flex items-center justify-center p-4 text-muted-foreground">
                    <Loader2 size={20} className="mr-2 animate-spin" />
                    <span>AI генерирует следующий шаг...</span>
                </div>
             )}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="pt-4 border-t flex flex-col gap-3">
        {isPlanComplete ? (
            <div className="text-center p-3 text-sm text-green-700 dark:text-green-400 bg-green-500/10 rounded-md border border-green-500/20 w-full">
                <div className="flex items-center justify-center font-semibold">
                    <CheckCircle size={16} className="mr-2" />
                    <span>План завершен!</span>
                </div>
                <p className="text-xs mt-1">AI считает, что выражение готово. Вы можете перегенерировать шаги или завершить работу.</p>
            </div>
        ) : (
            <Button onClick={handleNextStep} disabled={isLoadingNext || regeneratingIndex !== null} className="w-full">
                {isLoadingNext ? <><Loader2 size={16} className="mr-2 animate-spin" /> Загрузка...</> : <><Wand2 size={16} className="mr-2"/> Сгенерировать следующий шаг</>}
            </Button>
        )}
        <div className="w-full flex justify-between gap-2">
            <Button variant="secondary" size="sm" onClick={onResetAndFinish}>Очистить и завершить</Button>
            <Button variant="outline" size="sm" onClick={onFinish}>Завершить план</Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default GuidedStepsPanel;
