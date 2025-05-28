"use client";
import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { RegexMatch } from './types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, CheckCircle2, Search } from 'lucide-react';

interface TestAreaProps {
  testText: string;
  onTestTextChange: (text: string) => void;
  matches: RegexMatch[];
  generatedRegex: string;
}

const TestArea: React.FC<TestAreaProps> = ({ testText, onTestTextChange, matches, generatedRegex }) => {
  const highlightMatches = () => {
    if (!testText || matches.length === 0) {
      return <span className="whitespace-pre-wrap">{testText || "Введите текст для тестирования..."}</span>;
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
      <div className="flex flex-col gap-4">
        <div>
          <Label htmlFor="testText" className="text-sm font-medium">Тестовый текст</Label>
          <Textarea
            id="testText"
            value={testText}
            onChange={(e) => onTestTextChange(e.target.value)}
            className="mt-1 min-h-[120px] max-h-[200px] resize-y font-mono text-sm"
            placeholder="Введите текст для проверки вашего regex..."
          />
        </div>
        <Card className="flex-1">
          <CardHeader className="py-2 px-3 border-b">
            <CardTitle className="text-base">Выделенный текст</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100%_-_2.5rem)] max-h-[150px]">
              <div className="p-3 font-mono text-sm">
                {highlightMatches()}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Card className="flex flex-col">
        <CardHeader className="py-2 px-3 border-b">
          <CardTitle className="text-base">Совпадения ({matches.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex-1">
          <ScrollArea className="h-full max-h-[calc(100%_-_2rem)]"> {/* Adjust based on parent height */}
            {matches.length > 0 ? (
              <div className="space-y-2 p-3">
                {matches.map((match, index) => (
                  <div key={index} className="p-2 bg-primary/5 border border-primary/20 rounded-md text-xs">
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
                            <li key={groupIndex} className="font-mono">
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
              <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-4">
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
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default TestArea;
