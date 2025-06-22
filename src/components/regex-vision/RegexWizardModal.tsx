
"use client";
import React, { useState, useCallback, useEffect } from 'react';
import type { Block } from './types';
import { generateRegexFromNaturalLanguage, type NaturalLanguageRegexOutput } from '@/ai/flows/natural-language-regex-flow';
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Lightbulb, Bot, Loader2 } from 'lucide-react';
import { BLOCK_CONFIGS } from './constants';
import { BlockType } from './types';
import type { LiteralSettings } from './types';

interface RegexWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (blocks: Block[], parentId?: string | null, exampleTestText?: string) => void;
  initialParentId: string | null;
}

const RegexWizardModal: React.FC<RegexWizardModalProps> = ({ isOpen, onClose, onComplete, initialParentId }) => {
  const [query, setQuery] = useState('');
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [result, setResult] = useState<NaturalLanguageRegexOutput | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setIsLoadingAI(false);
      setResult(null);
    }
  }, [isOpen]);

  const handleGenerate = async () => {
    if (!query.trim()) {
      toast({ title: "Запрос не может быть пустым", variant: "destructive" });
      return;
    }
    setIsLoadingAI(true);
    setResult(null);
    try {
      const aiResult = await generateRegexFromNaturalLanguage({ query });
      setResult(aiResult);
       toast({
          title: "AI Сгенерировал предложение!",
          description: "Проверьте предложенные блоки и объяснение.",
      });
    } catch (error) {
      console.error("AI Regex Generation Error:", error);
      toast({
        title: "Ошибка AI",
        description: "Не удалось связаться с AI сервисом.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handleComplete = () => {
    if (result?.parsedBlocks && result.parsedBlocks.length > 0) {
      onComplete(result.parsedBlocks, initialParentId, result.exampleTestText || undefined);
    } else {
        onClose();
    }
  };
  
  const resetWizardAndClose = () => {
    setQuery('');
    setIsLoadingAI(false);
    setResult(null);
    onClose();
  }

  const renderSimpleBlockPreview = (blocks: Block[]): React.ReactNode => {
    return blocks.map(b => {
        let display = `${BLOCK_CONFIGS[b.type]?.name || b.type}`;
        if (b.type === BlockType.LITERAL) {
            display += `: "${(b.settings as LiteralSettings).text}"`;
        }
        // Add more simple cases if needed
        return <div key={b.id} className="text-xs font-mono whitespace-pre-wrap">{display}</div>;
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) resetWizardAndClose(); }}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Bot size={24}/> AI Помощник</DialogTitle>
          <DialogDescription>
            Опишите задачу на естественном языке. Например: "проверить, является ли строка валидным IPv4 адресом", "найти все email-адреса", или "найти слово 'error' без учета регистра".
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-4 flex-1 min-h-0 flex flex-col">
          <div>
            <Label htmlFor="naturalLanguageQuery" className="text-sm font-medium">Ваш запрос:</Label>
            <Textarea
                id="naturalLanguageQuery"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="mt-1 h-24"
                placeholder="Я хочу найти..."
                autoFocus
                disabled={isLoadingAI}
            />
          </div>
          <div className="text-center">
            <Button onClick={handleGenerate} disabled={isLoadingAI || !query.trim()}>
                {isLoadingAI ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Генерирую...</> : "Сгенерировать"}
            </Button>
          </div>
          
          {result && (
             <ScrollArea className="flex-1 pr-4 -mr-4 mt-2">
                <div className="space-y-3">
                   <Label className="text-sm font-medium">Предложение от AI:</Label>
                    <Card className="p-3 bg-muted/50">
                       <p className="text-sm font-semibold">Regex:</p>
                       <p className="font-mono text-xs bg-background p-1.5 rounded-md">/{result.regex}/</p>
                    </Card>

                    <div className="mt-3">
                        <Label className="text-sm font-medium">Объяснение от AI:</Label>
                        <Card className="p-3 bg-muted/30 text-xs max-h-40 overflow-y-auto">
                            <p className="whitespace-pre-wrap">{result.explanation}</p>
                        </Card>
                    </div>

                    {result.parsedBlocks && result.parsedBlocks.length > 0 && (
                        <div className="mt-3">
                             <Label className="text-sm font-medium">Сгенерированные блоки:</Label>
                             <Card className="p-3 bg-muted/30 text-xs max-h-40 overflow-y-auto">
                               {renderSimpleBlockPreview(result.parsedBlocks)}
                             </Card>
                        </div>
                    )}
                    
                     {result.exampleTestText && (
                        <div className="mt-3">
                            <Label className="text-sm font-medium">Пример текста от AI:</Label>
                            <Card className="p-3 bg-muted/30 text-xs max-h-20 overflow-y-auto">
                                <p className="whitespace-pre-wrap">{result.exampleTestText}</p>
                            </Card>
                        </div>
                    )}
                     <Alert className="mt-3">
                        <Lightbulb className="h-4 w-4" />
                        <AlertTitle>Подсказка</AlertTitle>
                        <AlertDescription>
                          AI предлагает Regex и, по возможности, его разбор на блоки. Вы можете добавить их в редактор.
                        </AlertDescription>
                    </Alert>
                </div>
            </ScrollArea>
          )}

        </div>

        <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={resetWizardAndClose}>Отмена</Button>
            <div className="flex-grow"></div>
            <Button
                onClick={handleComplete}
                disabled={isLoadingAI || !result || !result.parsedBlocks || result.parsedBlocks.length === 0}
            >
                Добавить в выражение
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RegexWizardModal;
