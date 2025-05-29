
"use client";
import React, { useState, useCallback } from 'react';
import type { Block, QuantifierSettings } from './types'; // Added QuantifierSettings
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Lightbulb } from 'lucide-react';

interface RegexWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (blocks: Block[]) => void;
}

type WizardStepId = 
  | 'start'
  | 'validation_type_choice' // New step
  | 'validation_basicPatterns_what'
  | 'validation_basicPatterns_length'
  | 'validation_basicPatterns_length_specify'
  | 'validation_standardFormats_what' // New step
  | 'validation_standardFormats_url_protocol' // New step for URL
  // ... more steps for other scenarios
  | 'final_preview';

interface WizardFormData {
  mainCategory?: 'validation' | 'extraction' | 'replacement' | 'splitting';
  validationTypeChoice?: 'basic' | 'standard'; // New form data
  
  // For Basic Patterns (Scenario 3.1)
  basicPattern_contains_digits?: boolean;
  basicPattern_contains_letters_az?: boolean;
  basicPattern_contains_letters_AZ?: boolean;
  basicPattern_contains_space?: boolean;
  basicPattern_contains_otherChars?: string;
  basicPattern_restrictLength?: 'no' | 'yes';
  basicPattern_minLength?: number;
  basicPattern_maxLength?: number;

  // For Standard Formats (Scenario 3.2)
  standardFormatChoice?: 'email' | 'url' | 'phone' | 'ip' | 'password'; // New
  url_requireProtocol?: 'yes' | 'no'; // New
}


const wizardConfig = {
  start: {
    title: "Мастер Regex: Какова ваша основная цель?",
    options: [
      { id: 'validation', label: "Валидация: проверить формат строки, соответствие шаблону." },
      { id: 'extraction', label: "Извлечение/Поиск: найти или выделить данные из текста." , disabled: true},
      { id: 'replacement', label: "Замена/Трансформация: заменить или форматировать части строки.", disabled: true },
      { id: 'splitting', label: "Разделение: разбить текст по разделителю.", disabled: true },
    ],
    next: (choice: string) => {
      if (choice === 'validation') return 'validation_type_choice'; 
      return 'start'; 
    }
  },
  validation_type_choice: {
    title: "Валидация: Какой тип проверки вам нужен?",
    type: 'radio',
    options: [
      { id: 'basic', label: "Простые шаблоны (цифры, буквы, длина и т.д.)" },
      { id: 'standard', label: "Стандартные форматы (Email, URL, дата и т.д.)" },
    ],
    next: (choice: string) => {
      if (choice === 'basic') return 'validation_basicPatterns_what';
      if (choice === 'standard') return 'validation_standardFormats_what';
      return 'validation_type_choice';
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
      return 'final_preview'; 
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
  validation_standardFormats_what: {
    title: "Проверка стандартных форматов: Что вы хотите проверить?",
    type: 'radio',
    options: [
      { id: 'email', label: "Email (электронная почта)" },
      { id: 'url', label: "URL (веб-адрес)" },
      { id: 'phone', label: "Телефон", disabled: true },
      { id: 'ip', label: "IP-адрес (IPv4/IPv6)", disabled: true },
      { id: 'password', label: "Пароль (проверка сложности)", disabled: true },
    ],
    next: (choice: string) => {
      if (choice === 'email') return 'final_preview';
      if (choice === 'url') return 'validation_standardFormats_url_protocol';
      return 'validation_standardFormats_what'; // fallback
    }
  },
  validation_standardFormats_url_protocol: {
    title: "Проверка URL: Требуется протокол http(s)?",
    type: 'radio',
    options: [
      { id: 'yes', label: "Да, http или https обязателен" },
      { id: 'no', label: "Нет, протокол не обязателен" },
    ],
    nextStep: 'final_preview'
  },
  final_preview: {
    title: "Предпросмотр и добавление",
    type: 'preview',
  }
};


const RegexWizardModal: React.FC<RegexWizardModalProps> = ({ isOpen, onClose, onComplete }) => {
  const [currentStepId, setCurrentStepId] = useState<WizardStepId>('start');
  const [formData, setFormData] = useState<WizardFormData>({});
  const [generatedBlocks, setGeneratedBlocks] = useState<Block[]>([]);

  const currentStepConfig = wizardConfig[currentStepId as keyof typeof wizardConfig];

  const handleRadioChange = (value: string) => {
    // For mainCategory, validationTypeChoice, standardFormatChoice, url_requireProtocol
    if (currentStepId === 'start') setFormData(prev => ({ ...prev, mainCategory: value as WizardFormData['mainCategory']}));
    else if (currentStepId === 'validation_type_choice') setFormData(prev => ({ ...prev, validationTypeChoice: value as WizardFormData['validationTypeChoice']}));
    else if (currentStepId === 'validation_standardFormats_what') setFormData(prev => ({...prev, standardFormatChoice: value as WizardFormData['standardFormatChoice']}));
    else if (currentStepId === 'validation_standardFormats_url_protocol') setFormData(prev => ({...prev, url_requireProtocol: value as WizardFormData['url_requireProtocol']}));
    else if (currentStepId === 'validation_basicPatterns_length') setFormData(prev => ({...prev, basicPattern_restrictLength: value as WizardFormData['basicPattern_restrictLength']}));
    else setFormData(prev => ({ ...prev, [currentStepId]: value }));
  };

  const getRadioValue = () => {
    if (currentStepId === 'start') return formData.mainCategory;
    if (currentStepId === 'validation_type_choice') return formData.validationTypeChoice;
    if (currentStepId === 'validation_standardFormats_what') return formData.standardFormatChoice;
    if (currentStepId === 'validation_standardFormats_url_protocol') return formData.url_requireProtocol;
    if (currentStepId === 'validation_basicPatterns_length') return formData.basicPattern_restrictLength;
    return formData[currentStepId as keyof WizardFormData] as string || '';
  }

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
      patternChars += formData.basicPattern_contains_otherChars.replace(/[\]\-\^]/g, '\\$&');
    }

    if (!patternChars) return [];

    blocks.push({ id: generateId(), type: BlockType.ANCHOR, settings: { type: '^' }, children: [], isExpanded: false });
    
    const charClassBlock: Block = {
      id: generateId(), type: BlockType.CHARACTER_CLASS,
      settings: { pattern: patternChars, negated: false }, children: [], isExpanded: false
    };

    let quantifierType: QuantifierSettings['type'] = '+';
    let min: number | undefined = undefined;
    let max: number | null | undefined = undefined;

    if (formData.basicPattern_restrictLength === 'yes') {
      min = typeof formData.basicPattern_minLength === 'number' ? formData.basicPattern_minLength : 1;
      max = typeof formData.basicPattern_maxLength === 'number' ? formData.basicPattern_maxLength : null;

      if (min !== undefined && max === null) quantifierType = '{n,}';
      else if (min !== undefined && max !== undefined && min === max) quantifierType = '{n}';
      else if (min !== undefined && max !== undefined) quantifierType = '{n,m}';
    }
    
    blocks.push(charClassBlock);
    blocks.push({
      id: generateId(), type: BlockType.QUANTIFIER,
      settings: { type: quantifierType, min, max, mode: 'greedy' } as QuantifierSettings,
      children: [], isExpanded: false
    });

    blocks.push({ id: generateId(), type: BlockType.ANCHOR, settings: { type: '$' }, children: [], isExpanded: false });
    return blocks;
  }, [formData]);

  const generateBlocksForEmail = useCallback((): Block[] => {
    // /^[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}$/
    // Blocks: ANCHOR ^, CHARACTER_CLASS [\w._%+-], QUANTIFIER +, LITERAL @, CHARACTER_CLASS [\w.-], QUANTIFIER +, LITERAL \., CHARACTER_CLASS [A-Za-z], QUANTIFIER {min:2, max:null}, ANCHOR $
    return [
      { id: generateId(), type: BlockType.ANCHOR, settings: { type: '^' }, children: [], isExpanded: false },
      { id: generateId(), type: BlockType.CHARACTER_CLASS, settings: { pattern: '\\w._%+-', negated: false }, children: [], isExpanded: false },
      { id: generateId(), type: BlockType.QUANTIFIER, settings: { type: '+', mode: 'greedy' } as QuantifierSettings, children: [], isExpanded: false },
      { id: generateId(), type: BlockType.LITERAL, settings: { text: '@' }, children: [], isExpanded: false },
      { id: generateId(), type: BlockType.CHARACTER_CLASS, settings: { pattern: '\\w.-', negated: false }, children: [], isExpanded: false },
      { id: generateId(), type: BlockType.QUANTIFIER, settings: { type: '+', mode: 'greedy' } as QuantifierSettings, children: [], isExpanded: false },
      { id: generateId(), type: BlockType.LITERAL, settings: { text: '\\.' }, children: [], isExpanded: false }, // Escaped dot
      { id: generateId(), type: BlockType.CHARACTER_CLASS, settings: { pattern: 'A-Za-z', negated: false }, children: [], isExpanded: false },
      { id: generateId(), type: BlockType.QUANTIFIER, settings: { type: '{n,}', min: 2, max: null, mode: 'greedy'} as QuantifierSettings, children: [], isExpanded: false },
      { id: generateId(), type: BlockType.ANCHOR, settings: { type: '$' }, children: [], isExpanded: false },
    ];
  }, []);

  const generateBlocksForURL = useCallback((): Block[] => {
    // /^https?:\/\/(www\.)?[A-Za-z0-9._%+-]+\.[A-Za-z]{2,6}\/?$/ (if protocol yes)
    // /^(www\.)?[A-Za-z0-9._%+-]+\.[A-Za-z]{2,6}\/?$/ (if protocol no)
    const blocks: Block[] = [];
    blocks.push({ id: generateId(), type: BlockType.ANCHOR, settings: { type: '^' }, children: [], isExpanded: false });

    if (formData.url_requireProtocol === 'yes') {
      blocks.push({ id: generateId(), type: BlockType.LITERAL, settings: { text: 'http' }, children: [], isExpanded: false });
      blocks.push({ id: generateId(), type: BlockType.LITERAL, settings: { text: 's' }, children: [], isExpanded: false });
      blocks.push({ id: generateId(), type: BlockType.QUANTIFIER, settings: { type: '?', mode: 'greedy' } as QuantifierSettings, children: [], isExpanded: false });
      blocks.push({ id: generateId(), type: BlockType.LITERAL, settings: { text: '://' }, children: [], isExpanded: false });
    }

    // (www\.)? -> GROUP (non-capturing) containing LITERAL 'www.' and QUANTIFIER '?'
    // The structure for (?:www\.)? : GROUP(non-capturing, children: [LITERAL 'www.', QUANTIFIER '?'])
    // Actually, the '?' should apply to the group itself if it's (www\.)?
    // (?:www\.)? -> non-capturing group with "www." inside, and a quantifier '?' applied to the group.
    // So, a group block followed by a quantifier block.
     blocks.push({ 
      id: generateId(), 
      type: BlockType.GROUP, 
      settings: { type: 'non-capturing'}, 
      children: [
        { id: generateId(), type: BlockType.LITERAL, settings: { text: 'www\\.' }, children: [], isExpanded: false } // Escaped dot
      ], 
      isExpanded: false 
    });
    blocks.push({ id: generateId(), type: BlockType.QUANTIFIER, settings: { type: '?', mode: 'greedy' } as QuantifierSettings, children: [], isExpanded: false });


    blocks.push({ id: generateId(), type: BlockType.CHARACTER_CLASS, settings: { pattern: 'A-Za-z0-9._%+-', negated: false }, children: [], isExpanded: false });
    blocks.push({ id: generateId(), type: BlockType.QUANTIFIER, settings: { type: '+', mode: 'greedy' } as QuantifierSettings, children: [], isExpanded: false });
    blocks.push({ id: generateId(), type: BlockType.LITERAL, settings: { text: '\\.' }, children: [], isExpanded: false }); // Escaped dot
    blocks.push({ id: generateId(), type: BlockType.CHARACTER_CLASS, settings: { pattern: 'A-Za-z', negated: false }, children: [], isExpanded: false });
    blocks.push({ id: generateId(), type: BlockType.QUANTIFIER, settings: { type: '{n,m}', min: 2, max: 6, mode: 'greedy' } as QuantifierSettings, children: [], isExpanded: false });
    blocks.push({ id: generateId(), type: BlockType.LITERAL, settings: { text: '/' }, children: [], isExpanded: false });
    blocks.push({ id: generateId(), type: BlockType.QUANTIFIER, settings: { type: '?', mode: 'greedy' } as QuantifierSettings, children: [], isExpanded: false });
    blocks.push({ id: generateId(), type: BlockType.ANCHOR, settings: { type: '$' }, children: [], isExpanded: false });
    return blocks;
  }, [formData.url_requireProtocol]);


  const handleNext = () => {
    if (!currentStepConfig) return;

    if (currentStepId === 'final_preview') {
        if (generatedBlocks.length > 0) {
          onComplete(generatedBlocks);
        }
        return;
    }
    
    let nextStepTargetId: WizardStepId | undefined = undefined;
    let choice: string | undefined = undefined;

    if ('next' in currentStepConfig && typeof currentStepConfig.next === 'function') {
      if (currentStepId === 'start') choice = formData.mainCategory;
      else if (currentStepId === 'validation_type_choice') choice = formData.validationTypeChoice;
      else if (currentStepId === 'validation_basicPatterns_length') choice = formData.basicPattern_restrictLength;
      else if (currentStepId === 'validation_standardFormats_what') choice = formData.standardFormatChoice;
      
      if (choice) {
        nextStepTargetId = currentStepConfig.next(choice) as WizardStepId;
      } else {
         // If no choice is made for a radio group, stay on the current step or handle as error
        return; 
      }
    } else if ('nextStep' in currentStepConfig) {
      nextStepTargetId = currentStepConfig.nextStep as WizardStepId;
    }
    
    if (nextStepTargetId === 'final_preview') {
        if(formData.mainCategory === 'validation'){
            if(formData.validationTypeChoice === 'basic'){
                 const blocks = generateBlocksForBasicPattern();
                 setGeneratedBlocks(blocks);
            } else if (formData.validationTypeChoice === 'standard') {
                if(formData.standardFormatChoice === 'email') {
                    const blocks = generateBlocksForEmail();
                    setGeneratedBlocks(blocks);
                } else if (formData.standardFormatChoice === 'url') {
                    // Make sure url_requireProtocol is set before generating
                    if (formData.url_requireProtocol) {
                       const blocks = generateBlocksForURL();
                       setGeneratedBlocks(blocks);
                    } else {
                        // This case implies that the next step (validation_standardFormats_url_protocol)
                        // was supposed to set url_requireProtocol, but we landed in final_preview too soon.
                        // This should not happen if flow is correct.
                        // For now, if url_requireProtocol is not set, we'll generate URL without protocol as a fallback
                        // or we ensure that the flow requires that step.
                        // The current config correctly leads to validation_standardFormats_url_protocol first.
                        // So, this 'else' block for generating URL in final_preview directly from standardFormatChoice === 'url'
                        // and an undefined url_requireProtocol is mostly defensive / shouldn't be hit.
                         const blocks = generateBlocksForURL(); // Will use undefined url_requireProtocol which might be handled by generateBlocksForURL
                         setGeneratedBlocks(blocks);
                    }
                } else {
                     setGeneratedBlocks([]); // Placeholder for other standard formats
                }
            } else {
                 setGeneratedBlocks([]);
            }
        } else {
            setGeneratedBlocks([]); 
        }
    }


    if (nextStepTargetId) {
      setCurrentStepId(nextStepTargetId);
    } else {
      console.warn("Wizard: No next step defined for", currentStepId);
      onClose(); 
    }
  };

  const handleBack = () => {
    let prevStep: WizardStepId | null = null;
    // This logic needs to be robust for all paths.
    switch (currentStepId) {
        case 'validation_type_choice': prevStep = 'start'; break;
        case 'validation_basicPatterns_what': prevStep = 'validation_type_choice'; break;
        case 'validation_basicPatterns_length': prevStep = 'validation_basicPatterns_what'; break;
        case 'validation_basicPatterns_length_specify': prevStep = 'validation_basicPatterns_length'; break;
        case 'validation_standardFormats_what': prevStep = 'validation_type_choice'; break;
        case 'validation_standardFormats_url_protocol': prevStep = 'validation_standardFormats_what'; break;
        case 'final_preview':
            if (formData.mainCategory === 'validation') {
                if (formData.validationTypeChoice === 'basic') {
                    prevStep = formData.basicPattern_restrictLength === 'yes' ? 'validation_basicPatterns_length_specify' : 'validation_basicPatterns_length';
                } else if (formData.validationTypeChoice === 'standard') {
                    if (formData.standardFormatChoice === 'email') prevStep = 'validation_standardFormats_what';
                    else if (formData.standardFormatChoice === 'url') prevStep = 'validation_standardFormats_url_protocol';
                    else prevStep = 'validation_standardFormats_what'; // fallback
                } else {
                    prevStep = 'validation_type_choice'; // fallback
                }
            } else {
                prevStep = 'start'; // General fallback
            }
            break;
        default: prevStep = 'start';
    }
    
    if (prevStep) {
        setCurrentStepId(prevStep);
    } else {
        setCurrentStepId('start'); // Default back to start if logic fails
    }
    setGeneratedBlocks([]); 
  };

  const resetWizard = () => {
    setCurrentStepId('start');
    setFormData({});
    setGeneratedBlocks([]);
    onClose();
  }

  if (!isOpen || !currentStepConfig) return null;

  const isNextDisabled = () => {
    if (currentStepConfig.type === 'radio' && !getRadioValue()) {
      return true;
    }
    if (currentStepId === 'final_preview' && generatedBlocks.length === 0) {
        // Disable if on final_preview and no blocks could be generated (e.g. bad path or incomplete form for current preview logic)
        // This can happen if a path to final_preview doesn't have a corresponding block generator implemented yet.
        if(formData.mainCategory === 'validation' && formData.validationTypeChoice === 'standard'){
            if(formData.standardFormatChoice === 'phone' || formData.standardFormatChoice === 'ip' || formData.standardFormatChoice === 'password'){
                return true; // These are not implemented yet
            }
        }
    }
    // Add other conditions for disabling next if needed
    return false;
  }


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
                value={getRadioValue()} 
                onValueChange={handleRadioChange}
              >
                {currentStepConfig.options.map(opt => (
                  <div key={opt.id} className="flex items-center space-x-2 p-2 border rounded-md hover:bg-muted/50 has-[:checked]:bg-accent/20 has-[:checked]:border-accent data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed" data-disabled={opt.disabled}>
                    <RadioGroupItem value={opt.id} id={`${currentStepId}-${opt.id}`} disabled={opt.disabled}/>
                    <Label htmlFor={`${currentStepId}-${opt.id}`} className={`flex-1 py-1 text-sm ${opt.disabled ? 'cursor-not-allowed text-muted-foreground' : 'cursor-pointer'}`}>
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
                            handleInputChange(currentStepConfig.otherCharsInput!.id, ''); 
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
                                    else if (b.type === BlockType.CHARACTER_CLASS) display += `: [${(b.settings as any).negated ? '^' : ''}${(b.settings as any).pattern}]`;
                                    else if (b.type === BlockType.QUANTIFIER) {
                                        const qs = b.settings as QuantifierSettings;
                                        display += `: ${qs.type}`;
                                        if (qs.min !== undefined) display += ` (min: ${qs.min}`;
                                        if (qs.max !== undefined && qs.max !== null) display += `, max: ${qs.max}`;
                                        if (qs.min !== undefined) display += `)`;
                                        display += `, ${qs.mode}`;
                                    }
                                    else if (b.type === BlockType.ANCHOR) display += `: ${(b.settings as any).type}`;
                                    else if (b.type === BlockType.GROUP) display += `: (${(b.settings as any).type})`;

                                    return <div key={b.id}>{display}</div>;
                                })}
                            </pre>
                        </Card>
                    ) : (
                        <p className="text-sm text-muted-foreground">Нет блоков для отображения. Возможно, путь Мастера еще не полностью реализован или не все параметры были выбраны.</p>
                    )}
                    <Alert>
                        <Lightbulb className="h-4 w-4" />
                        <AlertTitle>Подсказка</AlertTitle>
                        <AlertDescription>
                            Это базовый набор блоков. После добавления вы сможете их детальнее настроить, сгруппировать или добавить другие элементы в основном редакторе.
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
            <div className="flex-grow"></div>
            <Button 
                onClick={handleNext} 
                disabled={isNextDisabled()}
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

    