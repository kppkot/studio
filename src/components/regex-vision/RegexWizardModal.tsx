
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
import { Bot, Loader2 } from 'lucide-react';
import { BlockType } from './types';
import type { LiteralSettings } from './types';
import { Label } from '../ui/label';

interface RegexWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (query: string, blocks: Block[], parentId: string | null, exampleTestText?: string, recommendedFlags?: string) => void;
  onGuidedPlanReady: (query: string, steps: GuidedRegexStep[], exampleTestText: string) => void;
  initialParentId: string | null;
}

// State for the two-step guided flow
interface StagedForGuidedResult {
  explanation: string;
  exampleTestText: string;
}

const RegexWizardModal: React.FC<RegexWizardModalProps> = ({ isOpen, onClose, onComplete, onGuidedPlanReady, initialParentId }) => {
  const [query, setQuery] = useState('');
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [quickGenResult, setQuickGenResult] = useState<NaturalLanguageRegexOutput | null>(null);
  const [stagedForGuided, setStagedForGuided] = useState<StagedForGuidedResult | null>(null);
  const { toast } = useToast();

  const resetState = () => {
    setQuery('');
    setIsLoadingAI(false);
    setQuickGenResult(null);
    setStagedForGuided(null);
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

  const handleGenerateQuick = async () => {
    if (!query.trim()) {
      toast({ title: "Запрос не может быть пустым", variant: "destructive" });
      return;
    }
    setIsLoadingAI(true);
    setQuickGenResult(null);
    try {
      const aiResult = await generateRegexFromNaturalLanguage({ query });
      setQuickGenResult(aiResult);
    } catch (error) {
      console.error("AI Regex Generation Error:", error);
      toast({ title: "Ошибка AI", description: "Не удалось связаться с AI сервисом.", variant: "destructive" });
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handlePreAnalysisForGuided = async () => {
    if (!query.trim()) {
      toast({ title: "Запрос не может быть пустым", variant: "destructive" });
      return;
    }
    setIsLoadingAI(true);
    setStagedForGuided(null);
    try {
      const aiResult = await generateRegexFromNaturalLanguage({ query });
      if (aiResult.exampleTestText && aiResult.explanation) {
        setStagedForGuided({
          explanation: aiResult.explanation,
          exampleTestText: aiResult.exampleTestText,
        });
      } else {
        toast({ title: "Ошибка AI", description: "AI не смог сгенерировать пример текста.", variant: "destructive" });
      }
    } catch (error) {
      console.error("AI Guided Pre-analysis Error:", error);
      toast({ title: "Ошибка AI", description: "Не удалось сгенерировать контекст.", variant: "destructive" });
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handleGenerateGuidedSteps = async () => {
    if (!query.trim() || !stagedForGuided) return;
    setIsLoadingAI(true);
    try {
      const planResult = await generateGuidedRegexPlan({ 
        query,
        exampleTestText: stagedForGuided.exampleTestText,
      });
      if (planResult.steps.length > 0) {
        onGuidedPlanReady(query, planResult.steps, stagedForGuided.exampleTestText);
        toast({ title: "AI построил пошаговый план!", description: "Панель с шагами появилась справа." });
        handleClose();
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

  const handleCompleteQuickGen = () => {
    if (quickGenResult?.parsedBlocks && quickGenResult.parsedBlocks.length > 0) {
      onComplete(query, quickGenResult.parsedBlocks, initialParentId, quickGenResult.exampleTestText, quickGenResult.recommendedFlags);
    } else if (quickGenResult?.regex) {
      const fallbackBlock: Block = {
        id: 'fallback-literal-' + Date.now(),
        type: BlockType.LITERAL,
        settings: { text: quickGenResult.regex, isRawRegex: true } as LiteralSettings,
        children: [],
      };
      onComplete(query, [fallbackBlock], initialParentId, quickGenResult.exampleTestText, quickGenResult.recommendedFlags);
    }
    handleClose();
  };

  const renderFooter = () => {
    if (isLoadingAI) {
      return <Button disabled className="w-full"><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Обработка...</Button>;
    }
    if (quickGenResult) {
      return (
        <div className="w-full flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setQuickGenResult(null)}>Назад</Button>
          <Button onClick={handleCompleteQuickGen}>Добавить в выражение</Button>
        </div>
      );
    }
    if (stagedForGuided) {
      return (
        <div className="w-full flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setStagedForGuided(null)}>Назад</Button>
          <Button onClick={handleGenerateGuidedSteps}>Создать пошаговый план</Button>
        </div>
      );
    }
    return (
      <div className="w-full flex justify-end gap-2">
        <Button variant="outline" onClick={handlePreAnalysisForGuided} disabled={!query.trim()}>Пошаговый конструктор</Button>
        <Button onClick={handleGenerateQuick} disabled={!query.trim()}>Быстрая генерация</Button>
      </div>
    );
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
                disabled={isLoadingAI || !!quickGenResult || !!stagedForGuided}
            />

           {isLoadingAI && <div className="flex items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> AI думает...</div>}
           
           {quickGenResult && !isLoadingAI && (
              <div className="space-y-3 animate-in fade-in-50">
                  <p className="text-sm font-medium">Предложение от AI:</p>
                  <Card className="p-3 bg-muted/50">
                     <p className="text-sm font-semibold">Regex:</p>
                     <p className="font-mono text-xs bg-background p-1.5 rounded-md">/{quickGenResult.regex}/{quickGenResult.recommendedFlags || ''}</p>
                  </Card>
                  <div className="mt-3">
                      <p className="text-sm font-medium">Объяснение:</p>
                      <Card className="p-3 bg-muted/30 text-xs max-h-40 overflow-y-auto">
                          <p className="whitespace-pre-wrap">{quickGenResult.explanation}</p>
                      </Card>
                  </div>
              </div>
           )}

           {stagedForGuided && !isLoadingAI && (
             <div className="space-y-2 animate-in fade-in-50">
                 <Label htmlFor="guidedContext" className="text-sm font-medium">Контекст для AI</Label>
                 <Textarea
                    id="guidedContext"
                    value={stagedForGuided.exampleTestText}
                    onChange={(e) => setStagedForGuided(prev => prev ? { ...prev, exampleTestText: e.target.value } : null)}
                    className="font-mono text-xs h-28"
                    placeholder="Введите или отредактируйте пример текста"
                 />
                 <p className="text-xs text-muted-foreground px-1">
                    Вы можете отредактировать этот текст. AI будет использовать его как основу для построения пошагового плана.
                 </p>
             </div>
           )}
        </div>

        <DialogFooter className="pt-4 border-t flex-col sm:flex-row sm:justify-between sm:space-x-2">
          <Button variant="outline" onClick={handleClose}>Отмена</Button>
          {renderFooter()}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RegexWizardModal;
