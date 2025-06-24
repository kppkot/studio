"use client";
import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Lightbulb, Bot, Loader2, RefreshCw } from 'lucide-react';
import { analyzeRegex } from '@/ai/flows/analyze-regex-flow';
import { useToast } from '@/hooks/use-toast';

interface AnalysisPanelProps {
  originalQuery: string;
  generatedRegex: string;
  testText: string;
  errorContext?: string;
  isVisible: boolean;
}

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ originalQuery, generatedRegex, testText, errorContext, isVisible }) => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();

  const handleAnalyzeClick = useCallback(async () => {
    setIsAnalyzing(true);
    setAnalysis(null);
    try {
      const result = await analyzeRegex({
        originalQuery: originalQuery || "Цель не была указана (например, из библиотеки или ручной ввод).",
        generatedRegex,
        testText,
        errorContext: errorContext || "Нет ошибок от движка.",
      });
      setAnalysis(result.analysis);
    } catch (error) {
      console.error("Analysis AI Error:", error);
      toast({
        title: "Ошибка анализа",
        description: "Не удалось получить анализ от AI.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [originalQuery, generatedRegex, testText, errorContext, toast]);

  if (!isVisible) {
    return null;
  }

  return (
    <Card className="mt-2 shadow-md border-amber-500/30 bg-amber-500/5">
      <CardHeader className="py-2 px-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <Bot size={18} /> AI Анализ и Помощь
          </CardTitle>
          <Button onClick={handleAnalyzeClick} disabled={isAnalyzing} size="sm">
            {isAnalyzing ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Анализирую...</>
            ) : (
              <><Lightbulb className="mr-2 h-4 w-4" /> Объяснить, почему это не работает</>
            )}
          </Button>
        </div>
      </CardHeader>
      {analysis && (
        <CardContent className="p-3 pt-2">
          <Alert variant="default" className="bg-background">
             <AlertTitle className="font-semibold">Разбор от AI</AlertTitle>
             <AlertDescription className="whitespace-pre-wrap text-sm">
                {analysis}
             </AlertDescription>
          </Alert>
          <div className="mt-3 text-right">
              <Button variant="outline" disabled>
                  <RefreshCw size={16} className="mr-2"/>
                  Попробовать исправить (скоро)
              </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default AnalysisPanel;
