
"use client";
import React, { useState, useCallback } from 'react';
import type { Block, QuantifierSettings, CharacterClassSettings } from './types'; // Added CharacterClassSettings
import { BlockType } from './types';
import { BLOCK_CONFIGS } from './constants.tsx';
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
  | 'validation_type_choice' 
  | 'validation_basicPatterns_what'
  | 'validation_basicPatterns_length'
  | 'validation_basicPatterns_length_specify'
  | 'validation_standardFormats_what' 
  | 'validation_standardFormats_url_protocol'
  | 'validation_dateTime_dateFormat' // New for 3.3
  | 'validation_dateTime_separators' // New for 3.3
  | 'validation_dateTime_validateTime' // New for 3.3
  | 'validation_dateTime_timeFormat'   // New for 3.3
  | 'final_preview';

interface WizardFormData {
  mainCategory?: 'validation' | 'extraction' | 'replacement' | 'splitting';
  validationTypeChoice?: 'basic' | 'standard' | 'datetime'; 
  
  basicPattern_contains_digits?: boolean;
  basicPattern_contains_letters_az?: boolean;
  basicPattern_contains_letters_AZ?: boolean;
  basicPattern_contains_space?: boolean;
  basicPattern_contains_otherChars?: string;
  basicPattern_restrictLength?: 'no' | 'yes';
  basicPattern_minLength?: number;
  basicPattern_maxLength?: number;

  standardFormatChoice?: 'email' | 'url' | 'phone' | 'ip' | 'password';
  url_requireProtocol?: 'yes' | 'no';

  // New for 3.3 Date and Time
  dateFormat?: 'ddmmyyyy' | 'yyyymmdd' | 'other_date';
  dateSeparators?: ('slash' | 'hyphen' | 'dot')[];
  validateTime?: 'yes' | 'no';
  timeFormat?: '24hr' | '12hr';
}


const wizardConfig = {
  start: {
    title: "Мастер Regex: Какова ваша основная цель?",
    type: 'radio',
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
      { id: 'standard', label: "Стандартные форматы (Email, URL, Телефон и т.д.)" },
      { id: 'datetime', label: "Дата и время (ДД/ММ/ГГГГ, ЧЧ:ММ и т.д.)" },
    ],
    next: (choice: string) => {
      if (choice === 'basic') return 'validation_basicPatterns_what';
      if (choice === 'standard') return 'validation_standardFormats_what';
      if (choice === 'datetime') return 'validation_dateTime_dateFormat';
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
      return 'validation_standardFormats_what';
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
  validation_dateTime_dateFormat: {
    title: "Проверка Даты и Времени: Какой формат даты?",
    type: 'radio',
    options: [
        { id: 'ddmmyyyy', label: "ДД/ММ/ГГГГ или ДД.ММ.ГГГГ" },
        { id: 'yyyymmdd', label: "ГГГГ-ММ-ДД" },
        { id: 'other_date', label: "Другой (скоро)", disabled: true },
    ],
    next: (choice: string) => {
        if (choice === 'ddmmyyyy') return 'validation_dateTime_separators';
        if (choice === 'yyyymmdd') return 'validation_dateTime_validateTime'; // YYYY-MM-DD usually has fixed separators
        return 'validation_dateTime_dateFormat';
    }
  },
  validation_dateTime_separators: {
      title: "Проверка Даты (ДД/ММ/ГГГГ): Какие разделители разрешены?",
      description: "Выберите один или несколько разделителей.",
      type: 'checkbox',
      checkboxes: [
          { id: 'slash', label: "/ (слэш)" },
          { id: 'hyphen', label: "- (дефис)" },
          { id: 'dot', label: ". (точка)" },
      ],
      nextStep: 'validation_dateTime_validateTime',
  },
  validation_dateTime_validateTime: {
      title: "Проверка Даты и Времени: Нужно ли также проверять время?",
      type: 'radio',
      options: [
          { id: 'yes', label: "Да" },
          { id: 'no', label: "Нет" },
      ],
      next: (choice: string) => {
          if (choice === 'yes') return 'validation_dateTime_timeFormat';
          return 'final_preview';
      }
  },
  validation_dateTime_timeFormat: {
      title: "Проверка Времени: Какой формат времени?",
      type: 'radio',
      options: [
          { id: '24hr', label: "24-часовой (ЧЧ:ММ)" },
          { id: '12hr', label: "12-часовой (ЧЧ:ММ AM/PM)" },
      ],
      nextStep: 'final_preview',
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
    if (currentStepId === 'start') setFormData(prev => ({ ...prev, mainCategory: value as WizardFormData['mainCategory']}));
    else if (currentStepId === 'validation_type_choice') setFormData(prev => ({ ...prev, validationTypeChoice: value as WizardFormData['validationTypeChoice']}));
    else if (currentStepId === 'validation_standardFormats_what') setFormData(prev => ({...prev, standardFormatChoice: value as WizardFormData['standardFormatChoice']}));
    else if (currentStepId === 'validation_standardFormats_url_protocol') setFormData(prev => ({...prev, url_requireProtocol: value as WizardFormData['url_requireProtocol']}));
    else if (currentStepId === 'validation_basicPatterns_length') setFormData(prev => ({...prev, basicPattern_restrictLength: value as WizardFormData['basicPattern_restrictLength']}));
    else if (currentStepId === 'validation_dateTime_dateFormat') setFormData(prev => ({ ...prev, dateFormat: value as WizardFormData['dateFormat'] }));
    else if (currentStepId === 'validation_dateTime_validateTime') setFormData(prev => ({ ...prev, validateTime: value as WizardFormData['validateTime'] }));
    else if (currentStepId === 'validation_dateTime_timeFormat') setFormData(prev => ({ ...prev, timeFormat: value as WizardFormData['timeFormat'] }));
    else setFormData(prev => ({ ...prev, [currentStepId]: value }));
  };

  const getRadioValue = () => {
    if (currentStepId === 'start') return formData.mainCategory;
    if (currentStepId === 'validation_type_choice') return formData.validationTypeChoice;
    if (currentStepId === 'validation_standardFormats_what') return formData.standardFormatChoice;
    if (currentStepId === 'validation_standardFormats_url_protocol') return formData.url_requireProtocol;
    if (currentStepId === 'validation_basicPatterns_length') return formData.basicPattern_restrictLength;
    if (currentStepId === 'validation_dateTime_dateFormat') return formData.dateFormat;
    if (currentStepId === 'validation_dateTime_validateTime') return formData.validateTime;
    if (currentStepId === 'validation_dateTime_timeFormat') return formData.timeFormat;
    return formData[currentStepId as keyof WizardFormData] as string || '';
  }

  const handleCheckboxChange = (checkboxId: string, checked: boolean) => {
    if (currentStepId === 'validation_dateTime_separators') {
        const currentSeparators = formData.dateSeparators || [];
        let newSeparators: ('slash' | 'hyphen' | 'dot')[];
        if (checked) {
            newSeparators = [...currentSeparators, checkboxId as ('slash' | 'hyphen' | 'dot')];
        } else {
            newSeparators = currentSeparators.filter(sep => sep !== checkboxId);
        }
        setFormData(prev => ({ ...prev, dateSeparators: newSeparators }));
    } else {
        setFormData(prev => ({ ...prev, [checkboxId]: checked }));
    }
  };
  
  const handleInputChange = (inputId: string, value: string | number) => {
     setFormData(prev => ({ ...prev, [inputId]: value }));
  };

  // --- Block Generation Functions ---
  const createSequenceGroup = (children: Block[]): Block => ({
    id: generateId(), type: BlockType.GROUP, settings: {type: 'non-capturing'}, children, isExpanded: true
  });

  const createAlternation = (options: Block[][]): Block => ({
    id: generateId(), type: BlockType.ALTERNATION, children: options.map(optChildren => createSequenceGroup(optChildren)), isExpanded: true
  });
  
  const createLiteral = (text: string): Block => ({
    id: generateId(), type: BlockType.LITERAL, settings: {text}, children: [], isExpanded: false
  });

  const createCharClass = (pattern: string, negated = false): Block => ({
    id: generateId(), type: BlockType.CHARACTER_CLASS, settings: {pattern, negated} as CharacterClassSettings, children: [], isExpanded: false
  });
  
  const createQuantifier = (type: QuantifierSettings['type'], min?: number, max?: number | null, mode: QuantifierSettings['mode'] = 'greedy'): Block => ({
    id: generateId(), type: BlockType.QUANTIFIER, settings: {type, min, max, mode} as QuantifierSettings, children: [], isExpanded: false
  });


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
    return [
      { id: generateId(), type: BlockType.ANCHOR, settings: { type: '^' }, children: [], isExpanded: false },
      createCharClass('\\w._%+-'),
      createQuantifier('+'),
      createLiteral('@'),
      createCharClass('\\w.-'),
      createQuantifier('+'),
      createLiteral('\\.'), 
      createCharClass('A-Za-z'),
      createQuantifier('{n,}', 2, null),
      { id: generateId(), type: BlockType.ANCHOR, settings: { type: '$' }, children: [], isExpanded: false },
    ];
  }, []);

  const generateBlocksForURL = useCallback((): Block[] => {
    const blocks: Block[] = [];
    blocks.push({ id: generateId(), type: BlockType.ANCHOR, settings: { type: '^' }, children: [], isExpanded: false });

    if (formData.url_requireProtocol === 'yes') {
      blocks.push(createLiteral('http'));
      const sGroup = createSequenceGroup([createLiteral('s')]);
      blocks.push(sGroup); // Group for 's'
      blocks.push(createQuantifier('?')); // Make 's' optional
      blocks.push(createLiteral('://'));
    }

    const wwwGroup = createSequenceGroup([createLiteral('www\\.')]);
    blocks.push(wwwGroup);
    blocks.push(createQuantifier('?'));

    blocks.push(createCharClass('A-Za-z0-9._%+-'));
    blocks.push(createQuantifier('+'));
    blocks.push(createLiteral('\\.'));
    blocks.push(createCharClass('A-Za-z'));
    blocks.push(createQuantifier('{n,m}', 2, 6));
    
    const slashGroup = createSequenceGroup([createLiteral('/')]);
    blocks.push(slashGroup);
    blocks.push(createQuantifier('?'));
    
    blocks.push({ id: generateId(), type: BlockType.ANCHOR, settings: { type: '$' }, children: [], isExpanded: false });
    return blocks;
  }, [formData.url_requireProtocol]);


  const generateBlocksForDateTime = useCallback((): Block[] => {
    const blocks: Block[] = [];
    blocks.push({ id: generateId(), type: BlockType.ANCHOR, settings: { type: '^' }, children: [], isExpanded: false });

    let separatorPattern = "";
    if (formData.dateFormat === 'ddmmyyyy' && formData.dateSeparators && formData.dateSeparators.length > 0) {
        separatorPattern = formData.dateSeparators.map(s => {
            if (s === 'slash') return '/';
            if (s === 'hyphen') return '-';
            if (s === 'dot') return '\\.';
            return '';
        }).join('');
    } else if (formData.dateFormat === 'yyyymmdd') {
        separatorPattern = '-'; // Fixed for YYYY-MM-DD
    }
    const separatorClassBlock = separatorPattern ? createCharClass(`[${separatorPattern.replace(/\[|\]/g, '')}]`) : null;


    // Date part
    if (formData.dateFormat === 'ddmmyyyy') {
        // DD Group (0[1-9]|[12][0-9]|3[01])
        blocks.push(createSequenceGroup([createAlternation([
            [createLiteral("0"), createCharClass("1-9")],
            [createCharClass("12"), createCharClass("0-9")],
            [createLiteral("3"), createCharClass("01")]
        ])]));
        if (separatorClassBlock) blocks.push(separatorClassBlock);
        // MM Group (0[1-9]|1[012])
        blocks.push(createSequenceGroup([createAlternation([
            [createLiteral("0"), createCharClass("1-9")],
            [createLiteral("1"), createCharClass("012")]
        ])]));
        if (separatorClassBlock) blocks.push(separatorClassBlock);
        // YYYY Group ((19|20)\d\d)
        blocks.push(createSequenceGroup([
            createAlternation([[createLiteral("19")], [createLiteral("20")]]),
            createCharClass("\\d"), createQuantifier("{n}", 2, 2)
        ]));
    } else if (formData.dateFormat === 'yyyymmdd') {
        // YYYY Group ((19|20)\d\d)
         blocks.push(createSequenceGroup([
            createAlternation([[createLiteral("19")], [createLiteral("20")]]),
            createCharClass("\\d"), createQuantifier("{n}", 2, 2)
        ]));
        if (separatorClassBlock) blocks.push(separatorClassBlock);
        // MM Group (0[1-9]|1[012])
        blocks.push(createSequenceGroup([createAlternation([
            [createLiteral("0"), createCharClass("1-9")],
            [createLiteral("1"), createCharClass("012")]
        ])]));
        if (separatorClassBlock) blocks.push(separatorClassBlock);
        // DD Group (0[1-9]|[12][0-9]|3[01])
        blocks.push(createSequenceGroup([createAlternation([
            [createLiteral("0"), createCharClass("1-9")],
            [createCharClass("12"), createCharClass("0-9")],
            [createLiteral("3"), createCharClass("01")]
        ])]));
    }

    // Time part
    if (formData.validateTime === 'yes') {
        blocks.push(createCharClass("\\s")); // Space separator for time
        blocks.push(createQuantifier("?")); // Optional space

        if (formData.timeFormat === '24hr') {
            // HH Group ([01]\d|2[0-3])
            blocks.push(createSequenceGroup([createAlternation([
                [createCharClass("01"), createCharClass("\\d")],
                [createLiteral("2"), createCharClass("0-3")]
            ])]));
            blocks.push(createLiteral(":"));
            // MM Group ([0-5]\d)
            blocks.push(createSequenceGroup([createCharClass("0-5"), createCharClass("\\d")]));
        } else if (formData.timeFormat === '12hr') {
             // HH Group (0?[1-9]|1[0-2])
            blocks.push(createSequenceGroup([createAlternation([
                [createSequenceGroup([createLiteral("0"), createQuantifier("?")]), createCharClass("1-9")],
                [createLiteral("1"), createCharClass("0-2")]
            ])]));
            blocks.push(createLiteral(":"));
            // MM Group ([0-5]\d)
            blocks.push(createSequenceGroup([createCharClass("0-5"), createCharClass("\\d")]));
            blocks.push(createCharClass("\\s")); 
            blocks.push(createQuantifier("?"));
            // AM/PM Group (AM|PM) with ignore case (will be regex flag)
            blocks.push(createSequenceGroup([createAlternation([
                [createLiteral("AM")],
                [createLiteral("PM")]
            ])])); 
            // Note: Case insensitivity for AM/PM should be handled by a regex flag 'i', not directly in blocks.
        }
    }
    
    blocks.push({ id: generateId(), type: BlockType.ANCHOR, settings: { type: '$' }, children: [], isExpanded: false });
    return blocks;
  }, [formData]);


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
      else if (currentStepId === 'validation_dateTime_dateFormat') choice = formData.dateFormat;
      else if (currentStepId === 'validation_dateTime_validateTime') choice = formData.validateTime;
      
      if (choice) {
        nextStepTargetId = currentStepConfig.next(choice) as WizardStepId;
      } else {
        return; 
      }
    } else if ('nextStep' in currentStepConfig) {
      nextStepTargetId = currentStepConfig.nextStep as WizardStepId;
    }
    
    if (nextStepTargetId === 'final_preview') {
        if(formData.mainCategory === 'validation'){
            if(formData.validationTypeChoice === 'basic'){
                 setGeneratedBlocks(generateBlocksForBasicPattern());
            } else if (formData.validationTypeChoice === 'standard') {
                if(formData.standardFormatChoice === 'email') {
                    setGeneratedBlocks(generateBlocksForEmail());
                } else if (formData.standardFormatChoice === 'url') {
                    if (formData.url_requireProtocol) {
                       setGeneratedBlocks(generateBlocksForURL());
                    } else {
                         setGeneratedBlocks(generateBlocksForURL()); 
                    }
                } else {
                     setGeneratedBlocks([]); 
                }
            } else if (formData.validationTypeChoice === 'datetime') {
                setGeneratedBlocks(generateBlocksForDateTime());
            }
             else {
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
    switch (currentStepId) {
        case 'validation_type_choice': prevStep = 'start'; break;
        case 'validation_basicPatterns_what': prevStep = 'validation_type_choice'; break;
        case 'validation_basicPatterns_length': prevStep = 'validation_basicPatterns_what'; break;
        case 'validation_basicPatterns_length_specify': prevStep = 'validation_basicPatterns_length'; break;
        case 'validation_standardFormats_what': prevStep = 'validation_type_choice'; break;
        case 'validation_standardFormats_url_protocol': prevStep = 'validation_standardFormats_what'; break;
        
        case 'validation_dateTime_dateFormat': prevStep = 'validation_type_choice'; break;
        case 'validation_dateTime_separators': prevStep = 'validation_dateTime_dateFormat'; break;
        case 'validation_dateTime_validateTime': 
            if (formData.dateFormat === 'ddmmyyyy') prevStep = 'validation_dateTime_separators';
            else if (formData.dateFormat === 'yyyymmdd') prevStep = 'validation_dateTime_dateFormat';
            else prevStep = 'validation_dateTime_dateFormat'; // Fallback
            break;
        case 'validation_dateTime_timeFormat': prevStep = 'validation_dateTime_validateTime'; break;

        case 'final_preview':
            if (formData.mainCategory === 'validation') {
                if (formData.validationTypeChoice === 'basic') {
                    prevStep = formData.basicPattern_restrictLength === 'yes' ? 'validation_basicPatterns_length_specify' : 'validation_basicPatterns_length';
                } else if (formData.validationTypeChoice === 'standard') {
                    if (formData.standardFormatChoice === 'email') prevStep = 'validation_standardFormats_what';
                    else if (formData.standardFormatChoice === 'url') prevStep = 'validation_standardFormats_url_protocol';
                    else prevStep = 'validation_standardFormats_what'; 
                } else if (formData.validationTypeChoice === 'datetime') {
                    if (formData.validateTime === 'yes') prevStep = 'validation_dateTime_timeFormat';
                    else prevStep = 'validation_dateTime_validateTime';
                }
                 else {
                    prevStep = 'validation_type_choice'; 
                }
            } else {
                prevStep = 'start'; 
            }
            break;
        default: prevStep = 'start';
    }
    
    if (prevStep) {
        setCurrentStepId(prevStep);
    } else {
        setCurrentStepId('start'); 
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
    if (currentStepId === 'validation_dateTime_separators' && (!formData.dateSeparators || formData.dateSeparators.length === 0)) {
        return true; // Must select at least one separator for DD/MM/YYYY
    }
    if (currentStepId === 'final_preview' && generatedBlocks.length === 0) {
        if(formData.mainCategory === 'validation'){
            if(formData.validationTypeChoice === 'standard' && (formData.standardFormatChoice === 'phone' || formData.standardFormatChoice === 'ip' || formData.standardFormatChoice === 'password')){
                return true; 
            }
            if(formData.validationTypeChoice === 'datetime' && formData.dateFormat === 'other_date') {
                return true;
            }
        }
    }
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
                      checked={currentStepId === 'validation_dateTime_separators' ? formData.dateSeparators?.includes(cb.id as any) : !!formData[cb.id as keyof WizardFormData]}
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
                                    else if (b.type === BlockType.GROUP) {
                                      display += `: (${(b.settings as any).type || 'capturing'})`;
                                      if((b.settings as any).name) display += ` ?<${(b.settings as any).name}>`;
                                    }
                                    else if (b.type === BlockType.ALTERNATION) display += `: ( | )`;


                                    // Basic indentation for children
                                    const renderChildren = (children: Block[], level: number): string => {
                                      return children.map(child => {
                                        let childDisplay = `${BLOCK_CONFIGS[child.type]?.name || child.type}`;
                                        if (child.type === BlockType.LITERAL) childDisplay += `: "${(child.settings as any).text}"`;
                                        else if (child.type === BlockType.CHARACTER_CLASS) childDisplay += `: [${(child.settings as any).negated ? '^' : ''}${(child.settings as any).pattern}]`;
                                        // Add more types if needed for children display
                                        
                                        let nestedChildrenStr = "";
                                        if(child.children && child.children.length > 0) {
                                           nestedChildrenStr = `\n${renderChildren(child.children, level + 1)}`;
                                        }
                                        return `${'  '.repeat(level)}- ${childDisplay}${nestedChildrenStr}`;
                                      }).join('\n');
                                    }
                                    let childrenStr = "";
                                    if(b.children && b.children.length > 0) {
                                        childrenStr = `\n${renderChildren(b.children, 1)}`;
                                    }

                                    return <div key={b.id}>{display}{childrenStr}</div>;
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
