
"use client";
import React, { useState } from 'react';
import type { BlockConfig } from './types';
import { BlockType } from './types';
import { BLOCK_CONFIGS } from './constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, X, Search, AlignLeft, Milestone, Combine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface BlockPaletteProps {
  onAddBlock: (type: BlockType, settings?: any, parentId?: string | null) => void;
  isVisible: boolean;
  onToggle: () => void;
  parentIdForNewBlock: string | null;
}

interface WizardAction {
  label: string;
  type: BlockType;
  settings?: any;
  description?: string;
}

interface WizardCategory {
  name: string;
  icon: React.ReactNode;
  actions: WizardAction[];
}

const WIZARD_CATEGORIES: WizardCategory[] = [
  {
    name: "Простые элементы",
    icon: <AlignLeft size={18} className="mr-2 text-primary" />,
    actions: [
      { label: "Конкретный текст", type: BlockType.LITERAL, description: "Найти точное совпадение с введенным текстом." },
      { label: "Любая цифра (0-9)", type: BlockType.CHARACTER_CLASS, settings: { pattern: '\\d', negated: false }, description: "Соответствует одной цифровой символу." },
      { label: "Любая буква (a-z, A-Z)", type: BlockType.CHARACTER_CLASS, settings: { pattern: 'a-zA-Z', negated: false }, description: "Соответствует одной букве латинского алфавита." },
      { label: "Любой пробельный символ", type: BlockType.CHARACTER_CLASS, settings: { pattern: '\\s', negated: false }, description: "Пробел, таб, перенос строки и т.д." },
      { label: "Любой символ (.)", type: BlockType.CHARACTER_CLASS, settings: { pattern: '.', negated: false }, description: "Соответствует любому символу, кроме новой строки." },
      { label: "Пользовательский набор символов", type: BlockType.CHARACTER_CLASS, settings: { pattern: '', negated: false }, description: "Например, [aeiou] для гласных." },
    ],
  },
  {
    name: "Позиция в тексте",
    icon: <Milestone size={18} className="mr-2 text-primary" />,
    actions: [
      { label: "Начало строки/текста (^)", type: BlockType.ANCHOR, settings: { type: '^' }, description: "Указывает на начало строки или всего текста." },
      { label: "Конец строки/текста ($)", type: BlockType.ANCHOR, settings: { type: '$' }, description: "Указывает на конец строки или всего текста." },
      { label: "Граница слова (\\b)", type: BlockType.ANCHOR, settings: { type: '\\b' }, description: "Место между словесным и несловесным символом." },
      { label: "Не граница слова (\\B)", type: BlockType.ANCHOR, settings: { type: '\\B' }, description: "Любое место, не являющееся границей слова." },
    ],
  },
  {
    name: "Структура и логика",
    icon: <Combine size={18} className="mr-2 text-primary" />,
    actions: [
      { label: "Сгруппировать вместе (...)", type: BlockType.GROUP, description: "Объединяет несколько частей в одну группу." },
      { label: "Один из вариантов (или |)", type: BlockType.ALTERNATION, description: "Позволяет указать несколько альтернативных шаблонов." },
      { label: "Квантификатор (повторение)", type: BlockType.QUANTIFIER, description: "Указывает, сколько раз должен повторяться предыдущий элемент. Например, a* (ноль или более 'a')." },
      { label: "Просмотр (lookaround)", type: BlockType.LOOKAROUND, description: "Проверяет текст вокруг текущей позиции, не включая его в совпадение. Например, a(?=b)." },
    ],
  },
];


const BlockPalette: React.FC<BlockPaletteProps> = ({ onAddBlock, isVisible, onToggle, parentIdForNewBlock }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const handleAddBlockFromWizard = (type: BlockType, settings?: any) => {
    let blockSettings = settings;
    if (!settings && (type === BlockType.QUANTIFIER || type === BlockType.LOOKAROUND)) {
        blockSettings = BLOCK_CONFIGS[type]?.defaultSettings;
    }
    onAddBlock(type, blockSettings, parentIdForNewBlock);
    onToggle();
    setSearchTerm('');
  };

  const handleAddPredefinedBlock = (type: BlockType) => {
    onAddBlock(type, undefined, parentIdForNewBlock);
  };

  const filteredRawBlocks = Object.entries(BLOCK_CONFIGS)
    .filter(([key, config]) =>
      config.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      key.toLowerCase().includes(searchTerm.toLowerCase())
    ) as [BlockType, BlockConfig][];

  const showWizard = !searchTerm;
  const showFilteredBlocks = !!searchTerm;

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
      <Card className="fixed bottom-6 right-6 w-96 max-h-[calc(100vh-6rem)] grid grid-rows-[auto_1fr] shadow-xl z-50 border-primary overflow-hidden">
        <CardHeader className="py-3 px-4 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Добавить блок</CardTitle>
            <Button variant="ghost" size="icon" onClick={onToggle} className="h-8 w-8">
              <X size={18} />
            </Button>
          </div>
          <div className="relative mt-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Поиск..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
              autoFocus
            />
          </div>
        </CardHeader>
        
        <div className="overflow-y-auto">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-2">
              {showWizard && (
                <Accordion type="multiple" className="w-full" defaultValue={WIZARD_CATEGORIES.map(cat => cat.name)}>
                  {WIZARD_CATEGORIES.map((category, index) => (
                    <AccordionItem value={category.name} key={category.name}>
                      <AccordionTrigger className="text-sm font-semibold hover:no-underline py-2 px-1">
                        <div className="flex items-center">
                           {category.icon}
                           {`${index + 1}. ${category.name}`}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-1">
                        {category.actions.map(action => (
                          <Button
                            key={action.label}
                            variant="ghost"
                            onClick={() => handleAddBlockFromWizard(action.type, action.settings)}
                            className="w-full justify-start h-auto py-2.5 px-2 text-left mb-1 flex flex-col items-start"
                          >
                            <div className="flex items-center w-full">
                              <span className="font-medium text-sm">{action.label}</span>
                            </div>
                            {action.description && <p className="text-xs text-muted-foreground mt-0.5 text-left">{action.description}</p>}
                          </Button>
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}

              {showFilteredBlocks && filteredRawBlocks.length === 0 && (
                <p className="text-sm text-muted-foreground p-2 text-center">Блоки не найдены.</p>
              )}

              {showFilteredBlocks && filteredRawBlocks.map(([type, config]) => (
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
                   {type === BlockType.QUANTIFIER && <span className="text-xs text-muted-foreground ml-1">(применяется к предыдущему)</span>}
                </Button>
              ))}
            </div>
          </ScrollArea>
        </div>
      </Card>
    </>
  );
};

export default BlockPalette;
