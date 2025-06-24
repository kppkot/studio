
"use client";
import React, { useState, useEffect } from 'react';
import type { Block } from './types';
import { generateRegexFromNaturalLanguage, type NaturalLanguageRegexOutput } from '@/ai/flows/natural-language-regex-flow';
import { generateGuidedRegexPlan } from '@/ai/flows/guided-regex-flow';
import type { GuidedRegexStep } from '@/ai/flows/schemas';
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Lightbulb, Bot, Loader2, PlusCircle, CheckCircle } from 'lucide-react';
import { BLOCK_CONFIGS } from './constants';
import { BlockType } from './types';
import type { LiteralSettings } from './types';
import { reconstructPatternFromChildren } from './utils';

interface RegexWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (query: string, blocks: Block[], parentId: string | null, exampleTestText?: string, recommendedFlags?: string) => void;
  onAddSingleBlock: (block: Block) => void;
  initialParentId: string | null;
}

const RegexWizardModal: React.FC<RegexWizardModalProps> = ({ isOpen, onClose, onComplete, onAddSingleBlock, initialParentId }) => {
  const [query, setQuery] = useState('');
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [mode, setMode] = useState<'idle' | 'single' | 'guided'>('idle');

  // State for single generation
  const [singleResult, setSingleResult] = useState<NaturalLanguageRegexOutput | null>(null);

  // State for guided generation
  const [guidedSteps, setGuidedSteps] = useState<GuidedRegexStep[]>([]);
  const [addedStepIndices, setAddedStepIndices] = useState<Set<number>>(new Set());

  const { toast } = useToast();

  const resetStateAndClose = () => {
    setQuery('');
    setIsLoadingAI(false);
    setSingleResult(null);
    setGuidedSteps([]);
    setAddedStepIndices(new Set());
    setMode('idle');
    onClose();
  };

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens, but keep query if user just switches mode
    } else {
        resetStateAndClose();
    }
  }, [isOpen]);

  const handleGenerateSingle = async () => {
    if (!query.trim()) {
      toast({ title: "Запрос не может быть пустым", variant: "destructive" });
      return;
    }
    setIsLoadingAI(true);
    setMode('single');
    setSingleResult(null);
    try {
      const aiResult = await generateRegexFromNaturalLanguage({ query });
      setSingleResult(aiResult);
      toast({
        title: "AI Сгенерировал предложение!",
        description: "Проверьте предложенные блоки и объяснение.",
      });
    } catch (error) {
      console.error("AI Regex Generation Error:", error);
      toast({ title: "Ошибка AI", description: "Не удалось связаться с AI сервисом.", variant: "destructive" });
      setMode('idle');
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handleGenerateGuided = async () => {
    if (!query.trim()) {
      toast({ title: "Запрос не может быть пустым", variant: "destructive" });
      return;
    }
    setIsLoadingAI(true);
    setMode('guided');
    setGuidedSteps([]);
    setAddedStepIndices(new Set());
    try {
      const result = await generateGuidedRegexPlan({ query });
      if (result.steps.length === 0) {
        toast({ title: "AI не смог построить план", description: "Попробуйте переформулировать запрос или использовать быструю генерацию.", variant: "destructive" });
        setMode('idle');
      } else {
        setGuidedSteps(result.steps);
        toast({
            title: "AI построил пошаговый план!",
            description: "Добавляйте блоки в конструктор один за другим.",
        });
      }
    } catch (error) {
      console.error("AI Guided Generation Error:", error);
      toast({ title: "Ошибка AI", description: "Не удалось построить пошаговый план.", variant: "destructive" });
      setMode('idle');
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handleAddStep = (block: Block, index: number) => {
    onAddSingleBlock(block);
    setAddedStepIndices(prev => new Set(prev).add(index));
    toast({ title: 'Блок добавлен!', description: `Шаг ${index + 1} выполнен.` });
  };
  
  const handleCompleteSingle = () => {
    if (singleResult?.parsedBlocks && singleResult.parsedBlocks.length > 0) {
      onComplete(query, singleResult.parsedBlocks, initialParentId, singleResult.exampleTestText, singleResult.recommendedFlags);
    } else if (singleResult?.regex) {
      const fallbackBlock: Block = {
        id: 'fallback-literal-' + Date.now(),
        type: BlockType.LITERAL,
        settings: { text: singleResult.regex, isRawRegex: true } as LiteralSettings,
        children: [],
      };
      onComplete(query, [fallbackBlock], initialParentId, singleResult.exampleTestText, singleResult.recommendedFlags);
    }
    resetStateAndClose();
  };

  const getBlockPreview = (block: Block): string => {
    const config = BLOCK_CONFIGS[block.type];
    if (!config) return "Неизвестный блок";
    
    let details = "";
    switch (block.type) {
        case BlockType.LITERAL: details = `"${(block.settings as LiteralSettings).text}"`; break;
        case BlockType.CHARACTER_CLASS: 
            const pattern = reconstructPatternFromChildren(block.children) || (block.settings as any).pattern;
            details = (block.settings as any).negated ? `[^${pattern}]` : `[${pattern}]`; 
            break;
        case BlockType.QUANTIFIER: details = (block.settings as any).type; break;
        default: details = config.name;
    }
    return `${config.name}: ${details}`;
  };


  const renderContent = () => {
    if (isLoadingAI) {
      return <div className="flex flex-col items-center justify-center h-full text-muted-foreground"><Loader2 className="h-8 w-8 animate-spin mb-2" /> <p>AI думает...</p></div>;
    }

    if (mode === 'single' && singleResult) {
      return (
        <ScrollArea className="flex-1 pr-4 -mr-4 mt-2">
          <div className="space-y-3">
             <Label className="text-sm font-medium">Предложение от AI:</Label>
              <Card className="p-3 bg-muted/50">
                 <p className="text-sm font-semibold">Regex:</p>
                 <p className="font-mono text-xs bg-background p-1.5 rounded-md">/{singleResult.regex}/{singleResult.recommendedFlags || ''}</p>
              </Card>
              <div className="mt-3">
                  <Label className="text-sm font-medium">Объяснение от AI:</Label>
                  <Card className="p-3 bg-muted/30 text-xs max-h-40 overflow-y-auto">
                      <p className="whitespace-pre-wrap">{singleResult.explanation}</p>
                  </Card>
              </div>
          </div>
        </ScrollArea>
      );
    }

    if (mode === 'guided' && guidedSteps.length > 0) {
        return (
            <div className="flex-1 min-h-0 flex flex-col">
                <Label className="text-sm font-medium mb-2">Пошаговый план от AI:</Label>
                <ScrollArea className="flex-1 pr-4 -mr-4 border rounded-md p-2 bg-muted/30">
                    <div className="space-y-2">
                        {guidedSteps.map((step, index) => (
                            <Card key={index} className="p-2 flex items-center gap-3">
                                <div className="flex-shrink-0 font-bold text-primary text-lg">{index + 1}</div>
                                <div className="flex-1">
                                    <p className="text-xs text-muted-foreground">{step.explanation}</p>
                                    <p className="font-mono text-xs bg-background p-1 rounded mt-1">{getBlockPreview(step.block)}</p>
                                </div>
                                <Button size="sm" variant="outline" onClick={() => handleAddStep(step.block, index)} disabled={addedStepIndices.has(index)}>
                                    {addedStepIndices.has(index) ? <CheckCircle size={16} className="mr-2 text-green-600"/> : <PlusCircle size={16} className="mr-2"/>}
                                    {addedStepIndices.has(index) ? "Добавлено" : "Добавить"}
                                </Button>
                            </Card>
                        ))}
                    </div>
                </ScrollArea>
            </div>
        )
    }

    // Idle state content is just the textarea, which is always visible.
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) resetStateAndClose(); }}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Bot size={24}/> AI Помощник</DialogTitle>
          <DialogDescription>
            Опишите задачу на естественном языке, а затем выберите режим генерации.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-4 flex-1 min-h-0 flex flex-col">
            <Textarea
                id="naturalLanguageQuery"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-24"
                placeholder="Я хочу найти..."
                autoFocus
                disabled={isLoadingAI}
            />
           {renderContent()}
        </div>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={resetStateAndClose}>
            {mode === 'idle' ? 'Отмена' : 'Закрыть'}
          </Button>
          <div className="flex-grow"></div>
          {mode === 'idle' && (
            <div className="flex gap-2">
                 <Button onClick={handleGenerateGuided} disabled={!query.trim()}>Пошаговый конструктор</Button>
                 <Button onClick={handleGenerateSingle} disabled={!query.trim()}>Быстрая генерация</Button>
            </div>
          )}
          {mode === 'single' && singleResult && (
             <Button onClick={handleCompleteSingle} disabled={isLoadingAI || !singleResult}>Добавить в выражение</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RegexWizardModal;
