
"use client";
import React, { useState, useEffect } from 'react';
import type { Block } from './types';
import { generateRegexFromNaturalLanguage, type NaturalLanguageRegexOutput } from '@/ai/flows/natural-language-regex-flow';
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
  onStartGuidedMode: (query: string, exampleTestText: string) => void;
  onCompleteQuickGen: (query: string, blocks: Block[], parentId: string | null, exampleTestText?: string, recommendedFlags?: string) => void;
  initialParentId: string | null;
}

type WizardMode = 'choice' | 'quick-gen-result' | 'guided-context';

const RegexWizardModal: React.FC<RegexWizardModalProps> = ({ isOpen, onClose, onStartGuidedMode, onCompleteQuickGen, initialParentId }) => {
  const [query, setQuery] = useState('');
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [mode, setMode] = useState<WizardMode>('choice');
  const [quickGenResult, setQuickGenResult] = useState<NaturalLanguageRegexOutput | null>(null);
  const [guidedContextText, setGuidedContextText] = useState<string>('');
  const { toast } = useToast();

  const resetState = () => {
    setQuery('');
    setIsLoadingAI(false);
    setQuickGenResult(null);
    setGuidedContextText('');
    setMode('choice');
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
      setMode('quick-gen-result');
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
    setGuidedContextText('');
    try {
      // We only need the example text, but the flow gives us everything.
      const aiResult = await generateRegexFromNaturalLanguage({ query });
      if (aiResult.exampleTestText) {
        setGuidedContextText(aiResult.exampleTestText);
        setMode('guided-context');
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

  const handleConfirmGuidedStart = () => {
    if (!query.trim() || !guidedContextText.trim()) {
       toast({ title: "Контекст не может быть пустым", variant: "destructive" });
       return;
    }
    onStartGuidedMode(query, guidedContextText);
    handleClose();
  };

  const handleCompleteQuickGen = () => {
    if (quickGenResult?.parsedBlocks && quickGenResult.parsedBlocks.length > 0) {
      onCompleteQuickGen(query, quickGenResult.parsedBlocks, initialParentId, quickGenResult.exampleTestText, quickGenResult.recommendedFlags);
    } else if (quickGenResult?.regex) {
      const fallbackBlock: Block = {
        id: 'fallback-literal-' + Date.now(),
        type: BlockType.LITERAL,
        settings: { text: quickGenResult.regex, isRawRegex: true } as LiteralSettings,
        children: [],
      };
      onCompleteQuickGen(query, [fallbackBlock], initialParentId, quickGenResult.exampleTestText, quickGenResult.recommendedFlags);
    }
    handleClose();
  };
  
  const isInputDisabled = isLoadingAI || mode !== 'choice';

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
                disabled={isInputDisabled}
            />

           {isLoadingAI && <div className="flex items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> AI думает...</div>}
           
           {mode === 'quick-gen-result' && quickGenResult && !isLoadingAI && (
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

           {mode === 'guided-context' && !isLoadingAI && (
             <div className="space-y-2 animate-in fade-in-50">
                 <Label htmlFor="guidedContext" className="text-sm font-medium">Контекст для пошагового плана</Label>
                 <Textarea
                    id="guidedContext"
                    value={guidedContextText}
                    onChange={(e) => setGuidedContextText(e.target.value)}
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
           {mode === 'choice' && <Button variant="outline" onClick={handleClose}>Отмена</Button>}
           
           {mode !== 'choice' && !isLoadingAI && (
                <Button variant="outline" onClick={() => setMode('choice')}>Назад</Button>
           )}

            <div className="flex justify-end gap-2">
                {isLoadingAI && <Button disabled className="w-full"><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Обработка...</Button>}
                
                {mode === 'choice' && !isLoadingAI && (
                    <>
                        <Button variant="outline" onClick={handlePreAnalysisForGuided} disabled={!query.trim()}>Пошаговый конструктор</Button>
                        <Button onClick={handleGenerateQuick} disabled={!query.trim()}>Быстрая генерация</Button>
                    </>
                )}

                {mode === 'quick-gen-result' && !isLoadingAI && (
                    <Button onClick={handleCompleteQuickGen}>Добавить в выражение</Button>
                )}

                {mode === 'guided-context' && !isLoadingAI && (
                     <Button onClick={handleConfirmGuidedStart}>Создать пошаговый план</Button>
                )}
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RegexWizardModal;
