
"use client";
import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { RegexMatch } from './types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TestAreaProps {
  testText: string;
  onTestTextChange: (text: string) => void;
  matches: RegexMatch[];
  generatedRegex: string;
  highlightedGroupIndex: number; // 1-based index
}

const TestArea: React.FC<TestAreaProps> = ({ testText, onTestTextChange, matches, generatedRegex, highlightedGroupIndex }) => {
  const highlightMatches = () => {
    if (!testText) {
       return <span className="whitespace-pre-wrap text-muted-foreground">Введите текст для тестирования...</span>;
    }
    if (matches.length === 0) {
      return <span className="whitespace-pre-wrap">{testText}</span>;
    }

    let lastIndex = 0;
    const parts: JSX.Element[] = [];

    matches.forEach((match, i) => {
      if (match.index > lastIndex) {
        parts.push(<span key={`text-${i}`}>{testText.substring(lastIndex, match.index)}</span>);
      }
      parts.push(
        <mark key={`match-${i}`} className="bg-accent/30 text-accent-foreground px-0.5 rounded-sm">
          {match.match}
        </mark>
      );
      lastIndex = match.index + match.match.length;
    });

    if (lastIndex < testText.length) {
      parts.push(<span key="text-end">{testText.substring(lastIndex)}</span>);
    }
    return <div className="whitespace-pre-wrap">{parts}</div>;
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <div>
        <Label htmlFor="testText" className="text-sm font-medium">Тестовый текст</Label>
        <Textarea
          id="testText"
          value={testText}
          onChange={(e) => onTestTextChange(e.target.value)}
          className="mt-1 min-h-[120px] max-h-[300px] resize-y font-mono text-sm"
          placeholder="Введите текст для проверки вашего regex..."
        />
      </div>

      <Card className="flex-1 flex flex-col min-h-0">
        <CardHeader className="py-2 px-3 border-b">
          <CardTitle className="text-base">Результаты тестирования</CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex-1">
          <ScrollArea className="h-full">
            <div className="p-3 font-mono text-sm border-b">
               {highlightMatches()}
            </div>
            
            <div className="p-3">
                 {matches.length > 0 ? (
                  <div className="space-y-2 text-xs">
                     <h4 className="font-semibold text-sm mb-2 text-primary">Найдено совпадений: {matches.length}</h4>
                    {matches.map((match, index) => (
                      <div key={index} className="p-2 bg-primary/5 border border-primary/20 rounded-md">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-primary">Совпадение #{index + 1}</span>
                          <span className="text-muted-foreground">Индекс: {match.index}</span>
                        </div>
                        <div className="font-mono bg-background p-1.5 rounded border break-all">
                          "{match.match}"
                        </div>
                        {match.groups.length > 0 && (
                          <div className="mt-1.5">
                            <span className="text-muted-foreground">Группы:</span>
                            <ul className="list-disc list-inside ml-1 mt-0.5 space-y-0.5">
                              {match.groups.map((group, groupIndex) => (
                                <li
                                  key={groupIndex}
                                  className={cn(
                                    "font-mono transition-all p-1 rounded-md",
                                    (groupIndex + 1) === highlightedGroupIndex && "bg-primary/20 ring-1 ring-primary"
                                  )}
                                >
                                  <span className="text-muted-foreground">{groupIndex + 1}:</span> "{group ?? <span className="italic">не определено</span>}"
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center text-muted-foreground p-4">
                    {generatedRegex && testText ? (
                      <>
                        <AlertCircle size={32} className="mb-2 opacity-50" />
                        <p className="font-medium">Совпадений не найдено</p>
                        <p className="text-xs">Попробуйте изменить regex или тестовый текст.</p>
                      </>
                    ) : (
                      <>
                        <Search size={32} className="mb-2 opacity-50" />
                        <p className="font-medium">Готово к тестированию</p>
                        <p className="text-xs">Введите regex и тестовый текст, чтобы увидеть совпадения.</p>
                      </>
                    )}
                  </div>
                )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default TestArea;
