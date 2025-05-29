
"use client";
import React, { useState, useCallback } from 'react';
import type { Block } from './types';
import { BlockType } from './types';
import { BLOCK_CONFIGS } from './constants';
import { generateId } from './utils';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Lightbulb } from 'lucide-react';

interface RegexWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (blocks: Block[]) => void;
}

type WizardStepId = 
  | 'start'
  | 'validation_basicPatterns_what'
  | 'validation_basicPatterns_length'
  | 'validation_basicPatterns_length_specify'
  | 'validation_standardFormats_what' // Placeholder for future
  // ... more steps for other scenarios
  | 'final_preview'; // A step to show generated regex/blocks before adding

interface WizardFormData {
  mainCategory?: 'validation' | 'extraction' | 'replacement' | 'splitting';
  
  // For Basic Patterns (Scenario 3.1)
  basicPattern_contains_digits?: boolean;
  basicPattern_contains_letters_az?: boolean;
  basicPattern_contains_letters_AZ?: boolean;
  basicPattern_contains_space?: boolean;
  basicPattern_contains_otherChars?: string;
  basicPattern_restrictLength?: 'no' | 'yes';
  basicPattern_minLength?: number;
  basicPattern_maxLength?: number;

  // ... more form data fields for other scenarios
}

// --- Configuration for Wizard Steps (based on spec 3.1) ---
const wizardConfig = {
  start: {
    title: "Мастер Regex: Какова ваша основная цель?",
    options: [
      { id: 'validation', label: "Валидация: проверить формат строки, соответствие шаблону (email, номер, дата и т.п.)." },
      { id: 'extraction', label: "Извлечение/Поиск: найти или выделить данные из текста по шаблону." , disabled: true},
      { id: 'replacement', label: "Замена/Трансформация: заменить или форматировать части строки.", disabled: true },
      { id: 'splitting', label: "Разделение: разбить текст по разделителю (CSV, пробелы, и т.д.).", disabled: true },
    ],
    next: (choice: string) => {
      if (choice === 'validation') return 'validation_basicPatterns_what'; // Start with basic patterns for now
      // Later, add a step for validation type choice: validation_standardFormats_what or validation_basicPatterns_what
      return 'start'; // fallback
    }
  },
  validation_basicPatterns_what: {
    title: "Проверка простых шаблонов: Что должно быть в строке?",
    description: "Выберите один или несколько типов символов, которые должна содержать строка.",
    type: 'checkbox',
    checkboxes: [
      { id: 'basicPattern_contains_digits', label: "Цифры (0-9)" },
      { id: 'basicPattern_contains_letters_az', label: "Буквы (a-z)" },
      { id: 'basicPattern_contains_letters_AZ', label: "Большие буквы (A-Z)" },
      { id: 'basicPattern_contains_space', label: "Пробелы" },
    ],
    otherCharsInput: { id: 'basicPattern_contains_otherChars', label: "Другие символы (укажите):" },
    nextStep: 'validation_basicPatterns_length'
  },
  validation_basicPatterns_length: {
    title: "Проверка простых шаблонов: Нужно ли ограничить длину строки?",
    type: 'radio',
    options: [
      { id: 'no', label: "Нет, любая длина" },
      { id: 'yes', label: "Да, указать минимум и максимум" },
    ],
    next: (choice: string) => {
      if (choice === 'yes') return 'validation_basicPatterns_length_specify';
      return 'final_preview'; // If no length restriction, go to preview/generate
    }
  },
  validation_basicPatterns_length_specify: {
    title: "Проверка простых шаблонов: Укажите длину строки",
    type: 'inputs',
    inputs: [
      { id: 'basicPattern_minLength', label: "Минимальное число символов:", inputType: 'number', defaultValue: 1 },
      { id: 'basicPattern_maxLength', label: "Максимальное число символов (необязательно):", inputType: 'number' },
    ],
    nextStep: 'final_preview'
  },
  final_preview: {
    title: "Предпросмотр и добавление",
    type: 'preview', // Special type to show generated blocks/regex and 'Add' button
  }
  // ... more step configurations
};
// --- End Wizard Configuration ---


const RegexWizardModal: React.FC<RegexWizardModalProps> = ({ isOpen, onClose, onComplete }) => {
  const [currentStepId, setCurrentStepId] = useState<WizardStepId>('start');
  const [formData, setFormData] = useState<WizardFormData>({});
  const [generatedBlocks, setGeneratedBlocks] = useState<Block[]>([]);

  const currentStepConfig = wizardConfig[currentStepId as keyof typeof wizardConfig];

  const handleRadioChange = (value: string) => {
    setFormData(prev => ({ ...prev, [currentStepId]: value })); // Store selection for current step
  };

  const handleCheckboxChange = (checkboxId: string, checked: boolean) => {
    setFormData(prev => ({ ...prev, [checkboxId]: checked }));
  };
  
  const handleInputChange = (inputId: string, value: string | number) => {
     setFormData(prev => ({ ...prev, [inputId]: value }));
  };

  const generateBlocksForBasicPattern = useCallback((): Block[] => {
    const blocks: Block[] = [];
    let patternChars = '';
    if (formData.basicPattern_contains_digits) patternChars += '\\d';
    if (formData.basicPattern_contains_letters_az) patternChars += 'a-z';
    if (formData.basicPattern_contains_letters_AZ) patternChars += 'A-Z';
    if (formData.basicPattern_contains_space) patternChars += '\\s';
    if (formData.basicPattern_contains_otherChars) {
      // Basic escaping for chars in custom set. More robust escaping might be needed.
      patternChars += formData.basicPattern_contains_otherChars.replace(/[\]\-\^]/g, '\\$&');
    }

    if (!patternChars) return []; // Nothing selected to match

    // Start Anchor
    blocks.push({
      id: generateId(),
      type: BlockType.ANCHOR,
      settings: { type: '^' },
      children: [],
      isExpanded: false
    });
    
    const charClassBlock: Block = {
      id: generateId(),
      type: BlockType.CHARACTER_CLASS,
      settings: { pattern: patternChars, negated: false },
      children: [],
      isExpanded: false
    };

    let quantifierType: QuantifierSettings['type'] = '+'; // Default to one or more
    let min: number | undefined = undefined;
    let max: number | null | undefined = undefined;

    if (formData.basicPattern_restrictLength === 'no') {
      // Stays as '+' (one or more of the class)
    } else if (formData.basicPattern_restrictLength === 'yes') {
      min = typeof formData.basicPattern_minLength === 'number' ? formData.basicPattern_minLength : 1;
      max = typeof formData.basicPattern_maxLength === 'number' ? formData.basicPattern_maxLength : null;

      if (min !== undefined && max === null) {
        quantifierType = '{n,}';
      } else if (min !== undefined && max !== undefined && min === max) {
        quantifierType = '{n}';
      } else if (min !== undefined && max !== undefined) {
        quantifierType = '{n,m}';
      }
    }
    
    // If there's a specific quantifier from length restrictions, group the char class and apply quantifier
    if (formData.basicPattern_restrictLength === 'yes') {
        blocks.push(charClassBlock); // Add char class first
        blocks.push({ // Then the quantifier
            id: generateId(),
            type: BlockType.QUANTIFIER,
            settings: { type: quantifierType, min, max, mode: 'greedy' },
            children: [],
            isExpanded: false
        });
    } else { // No specific length, just "one or more" of the class
        blocks.push(charClassBlock);
        blocks.push({
            id: generateId(),
            type: BlockType.QUANTIFIER,
            settings: { type: '+', mode: 'greedy' }, // Default to one or more
            children: [],
            isExpanded: false
        });
    }


    // End Anchor
    blocks.push({
      id: generateId(),
      type: BlockType.ANCHOR,
      settings: { type: '$' },
      children: [],
      isExpanded: false
    });

    return blocks;
  }, [formData]);


  const handleNext = () => {
    if (!currentStepConfig) return;

    if (currentStepId === 'final_preview') {
        if (generatedBlocks.length > 0) {
          onComplete(generatedBlocks);
        } else {
          // Maybe show a toast? Or disable "Add" if no blocks
        }
        return;
    }
    
    let nextStepTargetId: WizardStepId | undefined = undefined;

    if ('next' in currentStepConfig && typeof currentStepConfig.next === 'function') {
      const choice = formData[currentStepId as keyof WizardFormData] as string; // Assuming radio choice stored by stepId
      nextStepTargetId = currentStepConfig.next(choice) as WizardStepId;
    } else if ('nextStep' in currentStepConfig) {
      nextStepTargetId = currentStepConfig.nextStep as WizardStepId;
    }
    
    if (nextStepTargetId === 'final_preview') {
        // Determine which generator function to call based on path taken
        // For now, only basicPattern
        if(formData.mainCategory === 'validation' && wizardConfig[currentStepId as keyof typeof wizardConfig]?.title?.startsWith("Проверка простых шаблонов")){
            const blocks = generateBlocksForBasicPattern();
            setGeneratedBlocks(blocks);
        } else {
            setGeneratedBlocks([]); // Clear if no generator for this path yet
        }
    }


    if (nextStepTargetId) {
      setCurrentStepId(nextStepTargetId);
    } else {
      // This case should ideally not happen if wizard is configured correctly
      console.warn("Wizard: No next step defined for", currentStepId);
      onClose(); 
    }
  };

  const handleBack = () => {
    // Basic back logic - needs to be smarter for complex paths
    // For now, a simple stack or hardcoded paths might work for linear flows
    if (currentStepId === 'validation_basicPatterns_length_specify') setCurrentStepId('validation_basicPatterns_length');
    else if (currentStepId === 'validation_basicPatterns_length') setCurrentStepId('validation_basicPatterns_what');
    else if (currentStepId === 'validation_basicPatterns_what') setCurrentStepId('start');
    else if (currentStepId === 'final_preview') {
        // Determine previous step before final_preview based on formData or path
        // This is a simplification, real back logic would need to trace the path
        if(formData.basicPattern_restrictLength === 'yes') setCurrentStepId('validation_basicPatterns_length_specify');
        else setCurrentStepId('validation_basicPatterns_length');
    }
    else setCurrentStepId('start'); // Default back to start
    setGeneratedBlocks([]); // Clear preview on back
  };

  const resetWizard = () => {
    setCurrentStepId('start');
    setFormData({});
    setGeneratedBlocks([]);
    onClose();
  }

  if (!isOpen || !currentStepConfig) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) resetWizard(); }}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{currentStepConfig.title}</DialogTitle>
          {currentStepConfig.description && (
            <DialogDescription>{currentStepConfig.description}</DialogDescription>
          )}
        </DialogHeader>
        
        <ScrollArea className="flex-1 pr-4 -mr-4 py-2">
          <div className="space-y-6">
            {currentStepConfig.type === 'radio' && currentStepConfig.options && (
              <RadioGroup 
                value={formData[currentStepId as keyof WizardFormData] as string || ''} 
                onValueChange={handleRadioChange}
              >
                {currentStepConfig.options.map(opt => (
                  <div key={opt.id} className="flex items-center space-x-2 p-2 border rounded-md hover:bg-muted/50 has-[:checked]:bg-accent/20 has-[:checked]:border-accent">
                    <RadioGroupItem value={opt.id} id={`${currentStepId}-${opt.id}`} disabled={opt.disabled}/>
                    <Label htmlFor={`${currentStepId}-${opt.id}`} className="flex-1 cursor-pointer py-1 text-sm">
                      {opt.label}
                      {opt.disabled && <span className="text-xs text-muted-foreground ml-2">(скоро)</span>}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}

            {currentStepConfig.type === 'checkbox' && currentStepConfig.checkboxes && (
              <div className="space-y-3">
                {currentStepConfig.checkboxes.map(cb => (
                  <div key={cb.id} className="flex items-center space-x-3 p-2 border rounded-md hover:bg-muted/50">
                    <Checkbox 
                      id={`${currentStepId}-${cb.id}`} 
                      checked={!!formData[cb.id as keyof WizardFormData]}
                      onCheckedChange={(checked) => handleCheckboxChange(cb.id, !!checked)}
                    />
                    <Label htmlFor={`${currentStepId}-${cb.id}`} className="flex-1 cursor-pointer text-sm font-normal">
                      {cb.label}
                    </Label>
                  </div>
                ))}
                {currentStepConfig.otherCharsInput && (
                  <div className="flex items-center space-x-3 p-2 border rounded-md">
                     <Checkbox 
                      id={`${currentStepId}-${currentStepConfig.otherCharsInput.id}-enable`} 
                      checked={formData[currentStepConfig.otherCharsInput.id as keyof WizardFormData] !== undefined}
                      onCheckedChange={(checked) => {
                        if (checked) {
                            handleInputChange(currentStepConfig.otherCharsInput!.id, ''); // Initialize with empty string
                        } else {
                            const newFormData = {...formData};
                            delete newFormData[currentStepConfig.otherCharsInput!.id as keyof WizardFormData];
                            setFormData(newFormData);
                        }
                      }}
                    />
                    <Label htmlFor={`${currentStepId}-${currentStepConfig.otherCharsInput.id}-enable`} className="text-sm font-normal">
                        {currentStepConfig.otherCharsInput.label}
                    </Label>
                    {formData[currentStepConfig.otherCharsInput.id as keyof WizardFormData] !== undefined && (
                         <Input 
                            id={`${currentStepId}-${currentStepConfig.otherCharsInput.id}`}
                            value={formData[currentStepConfig.otherCharsInput.id as keyof WizardFormData] as string || ''}
                            onChange={(e) => handleInputChange(currentStepConfig.otherCharsInput!.id, e.target.value)}
                            className="h-8 flex-1"
                            placeholder='например, _-!'
                        />
                    )}
                  </div>
                )}
              </div>
            )}
            
            {currentStepConfig.type === 'inputs' && currentStepConfig.inputs && (
              <div className="space-y-4">
                {currentStepConfig.inputs.map(input => (
                  <div key={input.id}>
                    <Label htmlFor={`${currentStepId}-${input.id}`} className="text-sm font-medium">
                      {input.label}
                    </Label>
                    <Input 
                      id={`${currentStepId}-${input.id}`}
                      type={input.inputType}
                      value={formData[input.id as keyof WizardFormData] as string || (input.defaultValue !== undefined ? String(input.defaultValue) : '')}
                      onChange={(e) => handleInputChange(input.id, input.inputType === 'number' ? parseInt(e.target.value) || 0 : e.target.value)}
                      className="mt-1 h-9"
                      min={input.inputType === 'number' ? "0" : undefined}
                    />
                  </div>
                ))}
              </div>
            )}

            {currentStepId === 'final_preview' && (
                <div className="space-y-3">
                    <Label className="text-sm font-medium">Сгенерированные блоки Regex:</Label>
                    {generatedBlocks.length > 0 ? (
                        <Card className="p-3 bg-muted/50 max-h-60 overflow-y-auto">
                            <pre className="text-xs font-mono whitespace-pre-wrap">
                                {generatedBlocks.map(b => {
                                    let display = `${BLOCK_CONFIGS[b.type]?.name || b.type}`;
                                    if (b.type === BlockType.LITERAL) display += `: "${(b.settings as any).text}"`;
                                    if (b.type === BlockType.CHARACTER_CLASS) display += `: [${(b.settings as any).negated ? '^' : ''}${(b.settings as any).pattern}]`;
                                    if (b.type === BlockType.QUANTIFIER) display += `: ${(b.settings as any).type} (min: ${(b.settings as any).min}, max: ${(b.settings as any).max}, mode: ${(b.settings as any).mode})`;
                                    if (b.type === BlockType.ANCHOR) display += `: ${(b.settings as any).type}`;
                                    return <div key={b.id}>{display}</div>;
                                })}
                            </pre>
                        </Card>
                    ) : (
                        <p className="text-sm text-muted-foreground">Нет блоков для отображения. Возможно, не все параметры были выбраны.</p>
                    )}
                    <Alert>
                        <Lightbulb className="h-4 w-4" />
                        <AlertTitle>Подсказка</AlertTitle>
                        <AlertDescription>
                            Это базовый набор блоков. После добавления вы сможете их детальнее настроить, сгруппировать или добавить другие элементы.
                        </AlertDescription>
                    </Alert>
                </div>
            )}

          </div>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t">
            {currentStepId !== 'start' && (
                 <Button variant="outline" onClick={handleBack}>Назад</Button>
            )}
            <div className="flex-grow"></div> {/* Spacer */}
          <Button 
            onClick={handleNext} 
            disabled={
                (currentStepConfig.type === 'radio' && !formData[currentStepId as keyof WizardFormData]) ||
                (currentStepId === 'final_preview' && generatedBlocks.length === 0)
            }
          >
            {currentStepId === 'final_preview' ? "Добавить в выражение" : "Далее"}
          </Button>
          <DialogClose asChild>
            <Button variant="ghost" onClick={resetWizard}>Отмена</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RegexWizardModal;

    