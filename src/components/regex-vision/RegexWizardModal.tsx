
"use client";
import React, { useState, useEffect } from 'react';
import type { Block } from './types';
import { generateRegexFromNaturalLanguage, type NaturalLanguageRegexOutput } from '@/ai/flows/natural-language-regex-flow';
import { generateGuidedRegexPlan } from '@/ai/flows/guided-regex-flow';
import type { GuidedRegexStep } from '@/ai/flows/schemas';
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Lightbulb, Bot, Loader2 } from 'lucide-react';
import { BlockType } from './types';
import type { LiteralSettings } from './types';

interface RegexWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (query: string, blocks: Block[], parentId: string | null, exampleTestText?: string, recommendedFlags?: string) => void;
  onGuidedPlanReady: (query: string, steps: GuidedRegexStep[]) => void;
  initialParentId: string | null;
}

const RegexWizardModal: React.FC<RegexWizardModalProps> = ({ isOpen, onClose, onComplete, onGuidedPlanReady, initialParentId }) => {
  const [query, setQuery] = useState('');
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [result, setResult] = useState<NaturalLanguageRegexOutput | null>(null);

  const { toast } = useToast();

  const resetState = () => {
    setQuery('');
    setIsLoadingAI(false);
    setResult(null);
  };
  
  const handleClose = () => {
    resetState();
    onClose();
  }

  useEffect(() => {
    if (!isOpen) {
      resetState();
    }
  }, [isOpen]);

  const handleGenerateSingle = async () => {
    if (!query.trim()) {
      toast({ title: "Запрос не может быть пустым", variant: "destructive" });
      return;
    }
    setIsLoadingAI(true);
    setResult(null);
    try {
      const aiResult = await generateRegexFromNaturalLanguage({ query });
      setResult(aiResult);
    } catch (error) {
      console.error("AI Regex Generation Error:", error);
      toast({ title: "Ошибка AI", description: "Не удалось связаться с AI сервисом.", variant: "destructive" });
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
    try {
      const planResult = await generateGuidedRegexPlan({ query });
      if (planResult.steps.length > 0) {
        onGuidedPlanReady(query, planResult.steps);
        toast({ title: "AI построил пошаговый план!", description: "Панель с шагами появилась справа." });
      } else {
        toast({ title: "AI не смог построить план", description: "Попробуйте переформулировать запрос или использовать быструю генерацию.", variant: "destructive" });
      }
    } catch (error) {
      console.error("AI Guided Generation Error:", error);
      toast({ title: "Ошибка AI", description: "Не удалось построить пошаговый план.", variant: "destructive" });
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handleCompleteSingle = () => {
    if (result?.parsedBlocks && result.parsedBlocks.length > 0) {
      onComplete(query, result.parsedBlocks, initialParentId, result.exampleTestText, result.recommendedFlags);
    } else if (result?.regex) {
      const fallbackBlock: Block = {
        id: 'fallback-literal-' + Date.now(),
        type: BlockType.LITERAL,
        settings: { text: result.regex, isRawRegex: true } as LiteralSettings,
        children: [],
      };
      onComplete(query, [fallbackBlock], initialParentId, result.exampleTestText, result.recommendedFlags);
    }
    handleClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Bot size={24}/> AI Помощник</DialogTitle>
          <DialogDescription>
            Опишите задачу на естественном языке. Вы можете сгенерировать выражение сразу или построить его пошагово.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-4">
            <Textarea
                id="naturalLanguageQuery"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-24"
                placeholder="Я хочу найти..."
                autoFocus
                disabled={isLoadingAI}
            />

           {isLoadingAI && <div className="flex items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> AI думает...</div>}
           
           {result && !isLoadingAI && (
              <div className="space-y-3 animate-in fade-in-50">
                  <p className="text-sm font-medium">Предложение от AI:</p>
                  <Card className="p-3 bg-muted/50">
                     <p className="text-sm font-semibold">Regex:</p>
                     <p className="font-mono text-xs bg-background p-1.5 rounded-md">/{result.regex}/{result.recommendedFlags || ''}</p>
                  </Card>
                  <div className="mt-3">
                      <p className="text-sm font-medium">Объяснение:</p>
                      <Card className="p-3 bg-muted/30 text-xs max-h-40 overflow-y-auto">
                          <p className="whitespace-pre-wrap">{result.explanation}</p>
                      </Card>
                  </div>
              </div>
           )}
        </div>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>Отмена</Button>
          <div className="flex-grow"></div>
           {result && !isLoadingAI ? (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setResult(null)}>Назад</Button>
              <Button onClick={handleCompleteSingle}>Добавить в выражение</Button>
            </div>
           ) : (
            <div className="flex gap-2">
                 <Button onClick={handleGenerateGuided} disabled={!query.trim() || isLoadingAI}>Пошаговый конструктор</Button>
                 <Button onClick={handleGenerateSingle} disabled={!query.trim() || isLoadingAI}>Быстрая генерация</Button>
            </div>
           )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RegexWizardModal;
