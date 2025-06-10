
"use client";
import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Lightbulb, AlertTriangle } from 'lucide-react';

interface PerformanceAnalyzerViewProps {
  regexString: string;
}

interface PotentialIssue {
  id: string;
  name: string;
  description: string;
  regex: RegExp; // Regex to find the problematic pattern in the user's regex
  message: string; // Explanation of why it's an issue
}

const potentialIssues: PotentialIssue[] = [
  {
    id: 'nested_quantifiers_plus',
    name: 'Вложенные квантификаторы (+,+)',
    description: 'Конструкции типа (a+)+ могут привести к экспоненциальному времени выполнения.',
    regex: /\([^()]*(?:\+\s*){2,}\)/g, // Example: (a+)+, (a+b+)+
    message: 'Обнаружены вложенные квантификаторы "+" (например, (a+)+). Это может привести к катастрофическому откату на определенных строках. Попробуйте сделать внутренний квантификатор нежадным или пересмотреть логику.',
  },
  {
    id: 'nested_quantifiers_star',
    name: 'Вложенные квантификаторы (*,*)',
    description: 'Конструкции типа (a*)* также очень опасны.',
    regex: /\([^()]*(?:\*\s*){2,}\)/g, // Example: (a*)*, (a*b*)*
    message: 'Обнаружены вложенные квантификаторы "*" (например, (a*)*). Это классический пример катастрофического отката. Рассмотрите использование атомарных групп или измените шаблон.',
  },
  {
    id: 'nested_quantifiers_mixed',
    name: 'Вложенные квантификаторы (+,*) или (*,+)',
    description: 'Смешанные вложенные квантификаторы, такие как (a+)* или (a*)+.',
    regex: /\([^()]*[\+\*]\s*\)[\+\*]/g, // Example: (a+)*, (a*)+
    message: 'Обнаружены смешанные вложенные квантификаторы (например, (a+)* или (a*)+). Это также может вызвать серьезные проблемы с производительностью. Постарайтесь избегать таких конструкций.',
  },
  {
    id: 'overlapping_alternation_quantifiers',
    name: 'Перекрывающиеся альтернативы с квантификаторами',
    description: 'Паттерны вроде (a|aa)+ или (a|a?)+.',
    regex: /\((?:[^()|]+\|)+[^()|]+\)[\+\*]/g, // Simplified: looks for (something|something_else)+/*
    message: 'Обнаружена альтернатива с квантификатором, где варианты могут перекрываться (например, (a|aa)+). Это может запутать движок и привести к избыточному откату.',
  },
  {
    id: 'dot_star_plus_in_group_quantified',
    name: 'Неограниченные .* или .+ в квантифицированной группе',
    description: 'Паттерны типа (.+)* или (.*)*',
    regex: /\((?:\.\*|\.\+)\)[\*\+]/g,
    message: 'Использование неограниченных .* или .+ внутри группы, к которой затем применяется квантификатор (например, (.*)*), часто приводит к катастрофическому откату. Уточните символы вместо точки или используйте нежадные квантификаторы.',
  },
  {
      id: 'redundant_quantifiers_same_char_class',
      name: 'Избыточные квантификаторы для одинаковых символов/классов',
      description: 'Паттерны типа a*a* или \\d+\\d*',
      // This regex is tricky to make perfect without a real parser.
      // It tries to find a character (or simple class like \d) followed by a quantifier,
      // then whitespace, then the SAME character (or class) followed by another quantifier.
      regex: /(\\?[\w.])([*+?]|{\s*\d+\s*(?:,\s*\d*\s*)?})\s*\1([*+?]|{\s*\d+\s*(?:,\s*\d*\s*)?})/g,
      message: 'Обнаружены последовательные квантификаторы для одного и того же символа или класса (например, a*a* или \\d+\\d*). Это часто избыточно и может ухудшить читаемость и производительность. Обычно их можно объединить в один квантификатор (например, a* вместо a*a*).',
  }
];

interface AnalysisWarning {
  type: string;
  message: string;
  pattern?: string; // The part of the user's regex that matched
}

const PerformanceAnalyzerView: React.FC<PerformanceAnalyzerViewProps> = ({ regexString }) => {
  const [analysisResult, setAnalysisResult] = useState<{ warnings: AnalysisWarning[] } | null>(null);

  useEffect(() => {
    if (!regexString.trim()) {
      setAnalysisResult(null);
      return;
    }

    const warnings: AnalysisWarning[] = [];
    potentialIssues.forEach(issue => {
      // Reset lastIndex for global regexes
      issue.regex.lastIndex = 0;
      let match;
      while ((match = issue.regex.exec(regexString)) !== null) {
        // Check if this specific issue type has already been added for this pattern
        // This avoids adding duplicate warnings for the same pattern if the issue regex is broad
        if (!warnings.some(w => w.type === issue.name && w.pattern === match[0])) {
            warnings.push({
                type: issue.name,
                message: issue.message,
                pattern: match[0], // The matched problematic part of the user's regex
            });
        }
      }
    });
    setAnalysisResult({ warnings });
  }, [regexString]);

  return (
    <div className="h-full flex flex-col p-1">
      <Card className="flex-1">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="text-primary" /> Анализ производительности Regex
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2 px-4 h-[calc(100%-4rem)]">
          <ScrollArea className="h-full pr-2">
            {!regexString.trim() ? (
              <div className="text-center text-muted-foreground py-10">
                <p>Введите регулярное выражение для анализа.</p>
              </div>
            ) : analysisResult && analysisResult.warnings.length > 0 ? (
              <div className="space-y-3">
                {analysisResult.warnings.map((warning, index) => (
                  <Alert key={index} variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{warning.type}</AlertTitle>
                    <AlertDescription>
                      {warning.message}
                      {warning.pattern && (
                        <p className="mt-1">
                          Обнаруженный паттерн: <code className="font-mono bg-destructive/20 px-1 py-0.5 rounded text-xs">{warning.pattern}</code>
                        </p>
                      )}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            ) : (
              <Alert variant="default">
                <Lightbulb className="h-4 w-4" />
                <AlertTitle>Проблем не обнаружено</AlertTitle>
                <AlertDescription>
                  На основе текущего набора правил, явных проблем, которые могут привести к катастрофическому откату, в вашем выражении не обнаружено. 
                  Однако, это не гарантирует оптимальную производительность во всех случаях.
                </AlertDescription>
              </Alert>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default PerformanceAnalyzerView;
