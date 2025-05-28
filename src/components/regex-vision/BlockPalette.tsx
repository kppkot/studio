"use client";
import React, { useState, useEffect, useCallback } from 'react';
import type { BlockConfig } from './types';
import { BlockType } from './types';
import { BLOCK_CONFIGS } from './constants';
import { getRegexSuggestion } from '@/ai/flows/regex-suggestion'; // AI suggestion flow
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, X, Search, Bot } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface BlockPaletteProps {
  onAddBlock: (type: BlockType, settings?: any, parentId?: string | null) => void;
  isVisible: boolean;
  onToggle: () => void;
  parentIdForNewBlock: string | null; // To add block as child
}

const BlockPalette: React.FC<BlockPaletteProps> = ({ onAddBlock, isVisible, onToggle, parentIdForNewBlock }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const { toast } = useToast();

  const fetchAiSuggestions = useCallback(async (query: string) => {
    if (!query.trim()) {
      setAiSuggestions([]);
      return;
    }
    setIsLoadingAi(true);
    try {
      const result = await getRegexSuggestion({ query });
      setAiSuggestions(result.suggestions || []);
    } catch (error) {
      console.error("Ошибка при получении AI подсказок:", error);
      toast({
        title: "Ошибка AI подсказок",
        description: "Не удалось получить подсказки от AI.",
        variant: "destructive",
      });
      setAiSuggestions([]);
    } finally {
      setIsLoadingAi(false);
    }
  }, [toast]);

  useEffect(() => {
    if (searchTerm.startsWith('/')) {
      const query = searchTerm.substring(1);
      // Debounce AI call if needed, for now direct call
      fetchAiSuggestions(query);
    } else {
      setAiSuggestions([]); // Clear AI suggestions if not a command
    }
  }, [searchTerm, fetchAiSuggestions]);

  const handleAddPredefinedBlock = (type: BlockType) => {
    onAddBlock(type, undefined, parentIdForNewBlock);
    onToggle(); 
    setSearchTerm('');
  };

  const handleAddAiSuggestion = (suggestion: string) => {
    // Add AI suggestion as a Literal block
    onAddBlock(BlockType.LITERAL, { text: suggestion }, parentIdForNewBlock);
    onToggle();
    setSearchTerm('');
  };

  const filteredBlocks = Object.entries(BLOCK_CONFIGS)
    .filter(([key, config]) =>
      config.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      key.toLowerCase().includes(searchTerm.toLowerCase())
    ) as [BlockType, BlockConfig][];

  if (!isVisible) {
    return (
      <Button
        onClick={onToggle}
        className="fixed bottom-6 right-6 bg-primary text-primary-foreground p-4 rounded-full shadow-lg hover:bg-primary/90 z-50 h-14 w-14"
        aria-label="Открыть палитру блоков"
      >
        <Plus size={24} />
      </Button>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm" onClick={onToggle} aria-hidden="true" />
      <Card className="fixed bottom-6 right-6 w-80 max-h-[calc(100vh-6rem)] flex flex-col shadow-xl z-50 border-primary">
        <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Добавить блок</CardTitle>
          <Button variant="ghost" size="icon" onClick={onToggle} className="h-8 w-8">
            <X size={18} />
          </Button>
        </CardHeader>
        <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Поиск или / для AI..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
                autoFocus
              />
            </div>
          </div>

          <ScrollArea className="flex-1 p-3">
            <div className="space-y-2">
              {isLoadingAi && <p className="text-sm text-muted-foreground p-2 text-center">Загрузка AI подсказок...</p>}
              
              {aiSuggestions.length > 0 && (
                <div className="mb-3">
                  <h4 className="text-xs font-semibold text-muted-foreground mb-1 uppercase flex items-center gap-1.5"><Bot size={14} /> AI Подсказки</h4>
                  {aiSuggestions.map((suggestion, index) => (
                    <Button
                      key={`ai-${index}`}
                      variant="ghost"
                      onClick={() => handleAddAiSuggestion(suggestion)}
                      className="w-full justify-start h-auto py-2 px-3 text-left mb-1"
                    >
                      <span className="font-mono text-xs bg-accent/20 text-accent-foreground p-1 rounded-sm mr-2 break-all">{suggestion}</span>
                    </Button>
                  ))}
                  <hr className="my-2"/>
                </div>
              )}

              {(searchTerm && !searchTerm.startsWith('/') || !aiSuggestions.length && searchTerm.startsWith('/')) && filteredBlocks.length === 0 && !isLoadingAi && (
                <p className="text-sm text-muted-foreground p-2 text-center">Блоки не найдены.</p>
              )}

              {!searchTerm.startsWith('/') && filteredBlocks.map(([type, config]) => (
                <Button
                  key={type}
                  variant="ghost"
                  onClick={() => handleAddPredefinedBlock(type)}
                  className="w-full justify-start h-auto py-2 px-3 text-left"
                >
                  <span className={cn(
                    "p-1.5 rounded-sm mr-2 flex items-center justify-center h-7 w-7",
                    "bg-primary/10 text-primary"
                  )}>
                     {typeof config.icon === 'string' ? <span className="font-mono text-xs">{config.icon}</span> : config.icon}
                  </span>
                  <span className="font-medium text-sm">{config.name}</span>
                </Button>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </>
  );
};

export default BlockPalette;
