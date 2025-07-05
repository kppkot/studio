
"use client";
import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { RegexMatch } from './types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, Search, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TestAreaProps {
  testText: string;
  onTestTextChange: (text: string) => void;
  matches: RegexMatch[];
  generatedRegex: string;
  highlightedGroupIndex: number; // 1-based index
  regexError: string | null;
}

const TestArea: React.FC<TestAreaProps> = ({ testText, onTestTextChange, matches, generatedRegex, highlightedGroupIndex, regexError }) => {
  
  const renderHighlightedText = () => {
    if (!testText) {
       return <span className="whitespace-pre-wrap text-muted-foreground">Введите текст для тестирования...</span>;
    }

    if (regexError) {
      return <span className="whitespace-pre-wrap">{testText}</span>;
    }
    
    const lines = testText.split('\n');
    const allMatches = matches;

    return (
         <div className="whitespace-pre-wrap">
            {lines.map((line, lineIndex) => {
                const lineStart = lines.slice(0, lineIndex).reduce((acc, l) => acc + l.length + 1, 0);
                const lineEnd = lineStart + line.length;

                const lineMatches = allMatches.filter(m => {
                    const matchStart = m.index;
                    const matchEnd = matchStart + m.match.length;
                    // Check if the match is primarily on this line.
                    // A match is on this line if its start point is within the line's bounds.
                    return matchStart >= lineStart && matchStart < lineEnd;
                });

                if (!line.trim() && lineIndex !== lines.length - 1) {
                    return <br key={`line-${lineIndex}`} />;
                }
                if (lineMatches.length === 0) {
                   return <div key={`line-${lineIndex}`} className="flex items-center gap-2"><span className="text-destructive w-4 h-4 text-xs font-bold flex-shrink-0">✗</span><span>{line}</span></div>;
                }
                
                type HighlightEvent = {
                    index: number;
                    type: 'start' | 'end';
                    className: string;
                };
                const events: HighlightEvent[] = [];

                lineMatches.forEach(m => {
                    const relativeStartIndex = m.index - lineStart;
                    events.push({ index: relativeStartIndex, type: 'start', className: 'bg-accent/30' });
                    events.push({ index: relativeStartIndex + m.match.length, type: 'end', className: 'bg-accent/30' });

                     if (highlightedGroupIndex > 0 && m.groupIndices && m.groupIndices[highlightedGroupIndex - 1]) {
                        const groupSpan = m.groupIndices[highlightedGroupIndex - 1];
                        if (groupSpan) {
                           events.push({ index: groupSpan[0] - lineStart, type: 'start', className: 'ring-1 ring-inset ring-primary' });
                           events.push({ index: groupSpan[1] - lineStart, type: 'end', className: 'ring-1 ring-inset ring-primary' });
                        }
                    }
                });

                 events.sort((a, b) => {
                    if (a.index !== b.index) return a.index - b.index;
                    if (a.type === 'end' && b.type === 'start') return -1;
                    if (a.type === 'start' && b.type === 'end') return 1;
                    return 0;
                });
                
                const parts: React.ReactNode[] = [];
                let lastIndex = 0;
                const activeClasses = new Set<string>();

                events.forEach(event => {
                    if (event.index > lastIndex) {
                        const text = line.substring(lastIndex, event.index);
                        if (activeClasses.size > 0) {
                            parts.push(<mark key={`part-${lastIndex}`} className={cn("rounded-sm", Array.from(activeClasses))}>{text}</mark>);
                        } else {
                            parts.push(<span key={`part-${lastIndex}`}>{text}</span>);
                        }
                    }
                    if (event.type === 'start') {
                        activeClasses.add(event.className);
                    } else {
                        activeClasses.delete(event.className);
                    }
                    lastIndex = event.index;
                });

                if (lastIndex < line.length) {
                    const text = line.substring(lastIndex);
                    if (activeClasses.size > 0) {
                        parts.push(<mark key="part-end" className={cn("rounded-sm", Array.from(activeClasses))}>{text}</mark>);
                    } else {
                        parts.push(<span key="part-end">{text}</span>);
                    }
                }
                
                return <div key={`line-${lineIndex}`} className="flex items-center gap-2"><span className="text-green-600 w-4 h-4 flex-shrink-0"><CheckCircle size={16}/></span><div>{parts}</div></div>;
            })}
        </div>
    );
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
          placeholder="Введите текст для проверки вашего regex (каждая строка - отдельный тест)"
        />
      </div>

      <Card className="flex-1 flex flex-col min-h-0">
        <CardHeader className="py-2 px-3 border-b">
          <CardTitle className="text-base">Результаты тестирования</CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex-1">
          <ScrollArea className="h-full">
            <div className="p-3 font-mono text-sm border-b">
               {renderHighlightedText()}
            </div>
            
            <div className="p-3">
                 {matches.length > 0 && !regexError ? (
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
